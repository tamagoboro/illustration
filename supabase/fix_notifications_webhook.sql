-- Webhook（notifications → discord-notify / profiles → new-signup-discord）を、失敗しても元の操作を止めない形に作り直す
--
-- 症状: いいね・コメント・フォローなど「通知が作られる操作」がすべて失敗する。
--   ERROR: 22P02: invalid input syntax for type integer: "{}"
--   CONTEXT: PL/pgSQL function supabase_functions.http_request() ...
-- 原因: Supabase の Database Webhook が使う関数 supabase_functions.http_request() が、このプロジェクトでは
--       引数を正しく読めずにエラーになる。トリガーの中のエラーなので、元の操作（いいね等）ごと取り消されていた。
-- 対応: その関数を使うのをやめ、自前の関数 public.send_webhook() で送る。
--       ・送信に失敗しても、例外を握りつぶして元の操作は必ず成功させる（通知がDiscordに届かないだけで済む）
--       ・合言葉（x-webhook-secret）は、今のトリガーに入っている値をそのまま引き継ぐ（このファイルには書かない）
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。書き換える所は無い。何度実行しても壊れない。

-- 送信用の関数。引数: [0] 送信先URL, [1] 合言葉
-- 送る中身は Database Webhook と同じ形（type / table / schema / record / old_record）
create or replace function public.send_webhook()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  begin
    perform net.http_post(
      url := tg_argv[0],
      body := jsonb_build_object(
        'type', tg_op,
        'table', tg_table_name,
        'schema', tg_table_schema,
        'record', to_jsonb(new),
        'old_record', null
      ),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', tg_argv[1]),
      timeout_milliseconds := 5000
    );
  exception when others then
    -- 送信の失敗で、いいね・登録などの元の操作を止めない
    raise warning 'send_webhook failed (%): %', tg_argv[0], sqlerrm;
  end;
  return new;
end;
$function$;

revoke all on function public.send_webhook() from public, anon, authenticated;

do $$
declare
  t record;
  v_secret text;
begin
  -- 今のトリガーから合言葉を取り出す（http_request 版・send_webhook 版のどちらからでも）
  select coalesce(
           substring(pg_get_triggerdef(tr.oid) from '"x-webhook-secret"\s*:\s*"([^"]+)"'),
           substring(pg_get_triggerdef(tr.oid) from 'send_webhook\(''[^'']*'', ''([^'']+)''\)')
         )
    into v_secret
  from pg_trigger tr
  where tr.tgrelid in ('public.notifications'::regclass, 'public.profiles'::regclass)
    and not tr.tgisinternal
    and pg_get_triggerdef(tr.oid) ~ '(http_request|send_webhook)'
  order by 1 nulls last
  limit 1;

  if v_secret is null then
    raise exception '合言葉（x-webhook-secret）を今のトリガーから読み取れませんでした';
  end if;

  -- 壊れる関数（supabase_functions.http_request）を使っているトリガーを外す
  for t in
    select c.relname, tr.tgname
    from pg_trigger tr
    join pg_class c on c.oid = tr.tgrelid
    join pg_proc p on p.oid = tr.tgfoid
    join pg_namespace n on n.oid = p.pronamespace
    where tr.tgrelid in ('public.notifications'::regclass, 'public.profiles'::regclass)
      and not tr.tgisinternal
      and n.nspname = 'supabase_functions'
      and p.proname = 'http_request'
  loop
    execute format('drop trigger %I on public.%I', t.tgname, t.relname);
  end loop;

  drop trigger if exists discord_notify_webhook on public.notifications;
  execute format(
    'create trigger discord_notify_webhook after insert on public.notifications
       for each row execute function public.send_webhook(%L, %L)',
    'https://drawker.com/api/webhooks/discord-notify', v_secret
  );

  drop trigger if exists "DiscordDrawker" on public.profiles;
  execute format(
    'create trigger "DiscordDrawker" after insert on public.profiles
       for each row execute function public.send_webhook(%L, %L)',
    'https://drawker.com/api/webhooks/new-signup-discord', v_secret
  );
end $$;

-- 確認用: いま付いているWebhookのトリガーを一覧する
select c.relname as table_name, tr.tgname as trigger_name, p.proname as function_name
from pg_trigger tr
join pg_class c on c.oid = tr.tgrelid
join pg_proc p on p.oid = tr.tgfoid
where not tr.tgisinternal and p.proname in ('http_request', 'send_webhook');

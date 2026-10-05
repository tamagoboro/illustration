-- 合意内容の控え：いつもの内容（テンプレート）・同意後の進み具合と支払いの記録・納期前のお知らせ
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。何度実行しても壊れない。
-- 前提: add_agreements.sql を実行済みであること。

-- ============================================================
-- 1. いつもの内容（クリエイターごとに1つ）
-- ============================================================
-- 支払い方法・修正回数・キャンセルの扱いなど、毎回同じになりやすい項目を保存しておき、控えを作るときに最初から入れる。
create table if not exists public.agreement_templates (
  user_id uuid primary key references auth.users(id) on delete cascade,
  template jsonb not null default '{}'::jsonb check (octet_length(template::text) <= 20000),
  updated_at timestamptz not null default now()
);

alter table public.agreement_templates enable row level security;

drop policy if exists "Users can manage their agreement template" on public.agreement_templates;
create policy "Users can manage their agreement template" on public.agreement_templates
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 2. 同意後の進み具合と支払いの記録
-- ============================================================
-- kind（だれが記録できるか）
--   paid              依頼者      … 支払いました
--   payment_confirmed クリエイター … 入金を確認しました
--   started           クリエイター … 制作を始めました
--   draft             クリエイター … ラフ・途中経過を提出しました
--   delivered         クリエイター … 納品しました
--   received          依頼者      … 受け取りました（取引完了）
--   note              どちらも    … メモ
-- 記録は消せない・直せない（あとから「言った・言わない」にならないように）。追加は add_agreement_event() からだけ。
create table if not exists public.agreement_events (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('paid', 'payment_confirmed', 'started', 'draft', 'delivered', 'received', 'note')),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists agreement_events_agreement_idx on public.agreement_events (agreement_id, created_at);

alter table public.agreement_events enable row level security;

drop policy if exists "Parties can view agreement events" on public.agreement_events;
create policy "Parties can view agreement events" on public.agreement_events
  for select to authenticated
  using (exists (
    select 1 from agreements a
    where a.id = agreement_id and (a.creator_id = auth.uid() or a.client_id = auth.uid())
  ));

revoke insert, update, delete on public.agreement_events from anon, authenticated;

create or replace function public.add_agreement_event(p_id uuid, p_kind text, p_note text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_row agreements%rowtype;
  v_is_creator boolean;
  v_is_client boolean;
  v_label text;
  v_other uuid;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = 'P0001';
  end if;
  select * into v_row from agreements where id = p_id for update;
  if not found then
    raise exception '控えが見つかりません' using errcode = 'P0001';
  end if;
  v_is_creator := v_row.creator_id = v_uid;
  v_is_client := v_row.client_id = v_uid;
  if not (v_is_creator or v_is_client) then
    raise exception 'この控えの当事者だけが記録できます' using errcode = 'P0001';
  end if;
  if v_row.status <> 'agreed' then
    raise exception '同意済みの控えにだけ、進み具合を記録できます' using errcode = 'P0001';
  end if;
  if p_kind in ('paid', 'received') and not v_is_client then
    raise exception 'この記録は依頼者だけがつけられます' using errcode = 'P0001';
  end if;
  if p_kind in ('payment_confirmed', 'started', 'draft', 'delivered') and not v_is_creator then
    raise exception 'この記録はクリエイターだけがつけられます' using errcode = 'P0001';
  end if;
  if p_kind not in ('paid', 'payment_confirmed', 'started', 'draft', 'delivered', 'received', 'note') then
    raise exception '記録の種類が正しくありません' using errcode = 'P0001';
  end if;
  if p_kind = 'note' and v_note is null then
    raise exception 'メモを入力してください' using errcode = 'P0001';
  end if;
  if p_kind <> 'note' and exists (select 1 from agreement_events where agreement_id = p_id and kind = 'received') then
    raise exception 'この取引は完了しています' using errcode = 'P0001';
  end if;

  insert into agreement_events (agreement_id, actor_id, kind, note) values (p_id, v_uid, p_kind, v_note);

  v_label := case p_kind
    when 'paid' then '💴 依頼者が「支払いました」と記録しました'
    when 'payment_confirmed' then '✅ クリエイターが入金を確認しました'
    when 'started' then '🎨 制作が始まりました'
    when 'draft' then '✏️ ラフ・途中経過が提出されました'
    when 'delivered' then '📦 納品されました。受け取りを確認してください'
    when 'received' then '🎉 依頼者が受け取りを確認しました（取引完了）'
    else '📝 控えにメモが追加されました'
  end;
  v_other := case when v_is_creator then v_row.client_id else v_row.creator_id end;
  perform notify_agreement(v_other, v_label, '「' || v_row.title || '」' || coalesce('：' || left(v_note, 60), ''), p_id);
end;
$function$;

revoke all on function public.add_agreement_event(uuid, text, text) from public, anon;
grant execute on function public.add_agreement_event(uuid, text, text) to authenticated;

-- ============================================================
-- 3. 納期前のお知らせ
-- ============================================================
-- /api/cron/agreement-reminders（毎日1回、Vercelが自動で呼ぶ）が、納期の3日前になった同意済みの控えを探して双方に通知する。
-- 同じ控えに2回送らないよう、送った日時を覚えておく。
alter table public.agreements add column if not exists deadline_reminded_at timestamptz;

notify pgrst, 'reload schema';

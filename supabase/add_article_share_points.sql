-- 記事をXでシェアすると50pt（1記事につき1回）
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。何度実行しても壊れない。
-- 前提: add_articles.sql を実行済みであること。
--
-- ・article_shares … 誰がどの記事のシェアでポイントを受け取ったか（1人1記事1回）。本人だけが読める。
-- ・ポイントの付与は claim_article_share() の中だけで行う。テーブルにはクライアントから書き込めない。
--   「Xでシェア」ボタンを押したことだけを記録する（実際に投稿したかどうかは確認できない）。

create table if not exists public.article_shares (
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_id, user_id)
);

alter table public.article_shares enable row level security;

drop policy if exists "Users can view their own article shares" on public.article_shares;
create policy "Users can view their own article shares" on public.article_shares
  for select to authenticated using (auth.uid() = user_id);

revoke insert, update, delete on public.article_shares from anon, authenticated;

-- シェアのポイントを受け取る。その記事ですでに受け取っていれば claimed = false（何度呼んでも二重付与されない）
create or replace function public.claim_article_share(p_article_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_points constant integer := 50;
  v_inserted integer;
  v_balance integer;
begin
  if v_uid is null then
    raise exception 'ログインが必要です';
  end if;
  if not exists (select 1 from articles where id = p_article_id and status = 'published') then
    raise exception '記事が見つかりません';
  end if;

  insert into article_shares (article_id, user_id) values (p_article_id, v_uid)
    on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    insert into user_points (user_id, balance) values (v_uid, v_points)
      on conflict (user_id) do update set balance = user_points.balance + v_points, updated_at = now();
    insert into point_transactions (user_id, amount, reason)
      values (v_uid, v_points, 'article_share:' || p_article_id::text);
  end if;

  select balance into v_balance from user_points where user_id = v_uid;

  return jsonb_build_object('claimed', v_inserted > 0, 'points', case when v_inserted > 0 then v_points else 0 end, 'balance', coalesce(v_balance, 0));
end;
$function$;

revoke all on function public.claim_article_share(uuid) from public, anon;
grant execute on function public.claim_article_share(uuid) to authenticated;

notify pgrst, 'reload schema';

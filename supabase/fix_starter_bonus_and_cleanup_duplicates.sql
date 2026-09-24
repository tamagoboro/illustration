-- ① grant_starter_bonus の二重付与を防ぐ
-- ② 重複しているインデックス・ポリシーを整理する
-- 現行定義は schema_functions.sql / schema_policies.sql を参照。


-- ============================================================
-- ① grant_starter_bonus
-- ============================================================
-- 「付与済みか確認 → 付与」の間にロックも一意制約が無く、同じユーザーの同時実行
-- （ボタン連打・複数タブ）で100ptが二重に付く可能性があった。
--   ・user_points の自分の行を FOR UPDATE でロックして、同じユーザーの実行を直列化する
--   ・念のため、point_transactions にも「starter_bonus は1ユーザー1件」の一意インデックスを張る
create or replace function public.grant_starter_bonus()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_balance integer;
begin
  if uid is null then
    raise exception 'ログインが必要です';
  end if;

  insert into user_points (user_id, balance)
  values (uid, 0)
  on conflict (user_id) do nothing;

  -- 同じユーザーの同時実行はここで待たされ、先の実行がコミットされたあとに下の確認へ進む
  perform 1 from user_points where user_id = uid for update;

  if not exists (select 1 from point_transactions where user_id = uid and reason = 'starter_bonus') then
    update user_points set balance = balance + 100, updated_at = now() where user_id = uid;
    insert into point_transactions (user_id, amount, reason) values (uid, 100, 'starter_bonus');
  end if;

  select balance into current_balance from user_points where user_id = uid;
  return current_balance;
end;
$$;

-- 既に二重付与された行があると一意インデックスを作れないので、その場合は作成をスキップして知らせる
do $$
begin
  if exists (
    select 1 from point_transactions
    where reason = 'starter_bonus'
    group by user_id
    having count(*) > 1
  ) then
    raise notice 'starter_bonus が重複しているユーザーがいるため、一意インデックスの作成をスキップしました。先に重複行を確認してください。';
  else
    create unique index if not exists point_transactions_starter_bonus_uniq
      on public.point_transactions (user_id) where reason = 'starter_bonus';
  end if;
end $$;


-- ============================================================
-- ② 重複インデックスの削除（残す側が同じ列を同じ順で覆っているもの）
-- ============================================================
-- 重複していると、書き込みのたびに両方を更新するだけで、検索は速くならない。
-- 主キー・ユニーク制約由来のインデックスは対象外（消せないし消さない）。

-- estimate_forms(user_id, sort_order): 完全に同じ
drop index if exists public.idx_estimate_forms_user_sort;        -- 残す: estimate_forms_user_id_idx
-- favorite_creators(user_id): 完全に同じ
drop index if exists public.idx_favorite_creators_user;          -- 残す: favorite_creators_user_idx
-- point_transactions: (user_id) は (user_id, created_at desc) に含まれる
drop index if exists public.idx_point_transactions_user;         -- 残す: point_transactions_user_idx
-- post_comments(post_id): 完全に同じ
drop index if exists public.idx_post_comments_post;              -- 残す: post_comments_post_id_idx
-- posts(created_at desc): 完全に同じ
drop index if exists public.idx_posts_created_at;                -- 残す: posts_created_at_idx
-- posts(user_id): 完全に同じ
drop index if exists public.idx_posts_user;                      -- 残す: posts_user_id_idx
-- profiles(is_public): 一覧は is_public = true で絞るので、部分インデックスだけで足りる
drop index if exists public.idx_profiles_is_public;              -- 残す: profiles_is_public_idx（where is_public = true）
-- referrals(referrer_id): 完全に同じ
drop index if exists public.idx_referrals_referrer;              -- 残す: referrals_referrer_idx
-- reviews(creator_id): (creator_id, created_at desc) に含まれる
drop index if exists public.idx_reviews_creator;                 -- 残す: reviews_creator_idx


-- ============================================================
-- ② 重複ポリシーの整理
-- ============================================================
-- portfolio_items には「誰でも閲覧」が3本、「本人が全操作」が3本あり、内容は実質同じだった。
-- ポリシーはORで評価されるので、まとめても権限は変わらない。新しい2本を先に作ってから古い6本を消す。
create policy "Public can view portfolio items"
  on public.portfolio_items as permissive for select to public
  using (true);

create policy "Owners manage own portfolio items"
  on public.portfolio_items as permissive for all to public
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Allow public read access on portfolio_items" on public.portfolio_items;
drop policy if exists "Public Read Portfolio Items" on public.portfolio_items;
drop policy if exists "誰でもポートフォリオを閲覧可能" on public.portfolio_items;
drop policy if exists "Allow individual user portfolio access" on public.portfolio_items;
drop policy if exists "Owner All Portfolio Items" on public.portfolio_items;
drop policy if exists "本人のみポートフォリオを作成・更新・削除可" on public.portfolio_items;

-- analytics_logs の「本人だけ閲覧」も同じ内容が2本あった
drop policy if exists "Allow creator to read own analytics" on public.analytics_logs;
-- 残す: "creators can view own analytics"

notify pgrst, 'reload schema';

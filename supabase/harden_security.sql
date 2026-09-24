-- セキュリティ強化（いいね数の改ざん・依頼の不正更新・ログの荒らし・ポイント稼ぎ）。
-- 現行定義は schema_functions.sql / schema_policies.sql を参照。
--
-- 【適用順】先にこのSQLをSupabaseで実行 → 続けてアプリ（increment_likes の呼び出しを削除した版）をデプロイ。
-- 逆順（アプリが先）だと、デプロイ〜SQL実行の間だけ「いいね数」が更新されないだけで壊れはしない。
-- SQLが先でも、古いアプリは increment_likes が空振りするだけ（コンソールにエラーが出る程度）。
--
-- ロール判定について: PostgREST経由のアクセスは current_user が anon / authenticated になる。
-- SQL Editor・security definer関数の内部・service_role は別のロールなので、ガードの対象外になる。


-- ============================================================
-- 1. いいね数（profiles.likes_count）を favorite_creators から自動集計する
-- ============================================================
-- これまで increment_likes を誰でも（未ログインでも）呼べて、任意のクリエイターの数を改ざんできた。
-- 数の正は favorite_creators の行数にし、トリガーだけが更新する。自分自身へのお気に入りは数えない。

create or replace function public.sync_profile_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.user_id <> new.creator_id then
      update profiles set likes_count = coalesce(likes_count, 0) + 1
      where user_id = new.creator_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.user_id <> old.creator_id then
      update profiles set likes_count = greatest(coalesce(likes_count, 0) - 1, 0)
      where user_id = old.creator_id;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_profile_likes_count on public.favorite_creators;
create trigger trg_sync_profile_likes_count
  after insert or delete on public.favorite_creators
  for each row execute function public.sync_profile_likes_count();

-- APIからの直接UPDATE/INSERTで likes_count を書き換えられないようにする
-- （profiles の更新ポリシーは列を制限していないため）。
-- この関数は security definer にしないこと（current_user がAPIのロールのままである必要がある）。
create or replace function public.protect_profile_likes_count()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.likes_count := 0;
    else
      new.likes_count := old.likes_count;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_likes_count on public.profiles;
create trigger trg_protect_profile_likes_count
  before insert or update on public.profiles
  for each row execute function public.protect_profile_likes_count();

-- 既存の値を実際のお気に入り数に揃える。
-- 注意: 過去に未ログインのいいねや改ざんで増えていた分は、ここで実数に戻る（表示が減るクリエイターが出る）。
-- 実数への補正が不要なら、この update 2文をコメントアウトして実行する。
update profiles p
set likes_count = c.n
from (
  select creator_id, count(*)::integer as n
  from favorite_creators
  where user_id <> creator_id
  group by creator_id
) c
where p.user_id = c.creator_id
  and p.likes_count is distinct from c.n;

update profiles
set likes_count = 0
where coalesce(likes_count, 0) <> 0
  and user_id not in (
    select creator_id from favorite_creators where user_id <> creator_id
  );

-- 旧RPCは誰にも実行させず、念のため中身も空にする（アプリ更新前の古い画面が呼んでもエラーになるだけ）。
create or replace function public.increment_likes(target_user_id uuid, is_liking boolean)
returns void
language sql
security definer
set search_path = public
as $$
  select;
$$;
revoke execute on function public.increment_likes(uuid, boolean) from public, anon, authenticated;


-- ============================================================
-- 2. requests の書き込みを列ごとに制限する
-- ============================================================
-- これまでは依頼者もクリエイターも全列を更新でき、依頼者が自分で status を accepted にしたり、
-- INSERT時に status / creator_response を好きに指定したりできた。
--   INSERT: status は必ず pending、creator_response は空にする
--   UPDATE: 依頼内容の列は誰も変更不可
--           クリエイター … status を accepted / declined にする・creator_response を書く（cancelled済みは不可）
--           依頼者       … pending の依頼を cancelled にするだけ
-- security definer にしないこと（current_user 判定のため）。

create or replace function public.guard_requests_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_creator boolean;
  v_is_client boolean;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.creator_response := null;
    return new;
  end if;

  v_is_creator := v_uid is not null and v_uid = old.creator_id;
  v_is_client  := v_uid is not null and v_uid = old.client_id;

  if new.creator_id is distinct from old.creator_id
     or new.client_id is distinct from old.client_id
     or new.content is distinct from old.content
     or new.budget is distinct from old.budget
     or new.client_contact_url is distinct from old.client_contact_url
     or new.image_urls is distinct from old.image_urls
     or new.usage_type is distinct from old.usage_type
     or new.reference_url is distinct from old.reference_url
     or new.size_spec is distinct from old.size_spec
     or new.desired_deadline is distinct from old.desired_deadline
     or new.created_at is distinct from old.created_at then
    raise exception 'リクエストの内容は変更できません';
  end if;

  if new.status is distinct from old.status
     or new.creator_response is distinct from old.creator_response then
    if v_is_creator and new.status in ('accepted', 'declined') and old.status <> 'cancelled' then
      null; -- クリエイターの返信
    elsif v_is_client and new.status = 'cancelled' and old.status = 'pending'
          and new.creator_response is not distinct from old.creator_response then
      null; -- 依頼者の取り下げ
    else
      raise exception 'この操作は許可されていません';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_requests_write on public.requests;
create trigger trg_guard_requests_write
  before insert or update on public.requests
  for each row execute function public.guard_requests_write();


-- ============================================================
-- 3. analytics_logs への匿名INSERTを限定する
-- ============================================================
-- これまで with check (true) で、任意の event_type・巨大な metadata を誰でも書き込めた。
-- アプリが実際に送る3種類だけ許可し、metadata のサイズと creator_id の有無を制限する。
-- 匿名のPV計測という仕組み上、PVの水増し自体は完全には防げない（急上昇バッジは参考値）。

drop policy if exists "Allow public insert to analytics_logs" on public.analytics_logs;
create policy "analytics_logs limited insert"
  on public.analytics_logs as permissive for insert to anon, authenticated
  with check (
    creator_id is not null
    and event_type in ('pv', 'estimate_calc', 'favorite')
    and octet_length(coalesce(metadata, '{}'::jsonb)::text) <= 2000
  );


-- ============================================================
-- 4. ポイントの不正取得を防ぐ
-- ============================================================
-- (a) レビューポイント: 自分へのレビューは不可。付与は「同じクリエイターへ1回だけ」
--     （レビューを消して書き直しても、point_transactions に履歴が残るので再付与されない）。
drop policy if exists "Logged in users can post their own review" on public.reviews;
create policy "Logged in users can post their own review"
  on public.reviews as permissive for insert to public
  with check (auth.uid() = reviewer_id and reviewer_id <> creator_id);

create or replace function public.grant_review_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reviewer_id = new.creator_id then
    return new;
  end if;

  if exists (
    select 1 from point_transactions
    where user_id = new.reviewer_id
      and reason = 'review_posted:' || new.creator_id
  ) then
    return new;
  end if;

  insert into user_points (user_id, balance) values (new.reviewer_id, 50)
    on conflict (user_id) do update set balance = user_points.balance + 50;

  insert into point_transactions (user_id, amount, reason)
    values (new.reviewer_id, 50, 'review_posted:' || new.creator_id);

  return new;
end;
$$;

-- (b) 紹介ボーナス: 1人の紹介者がボーナスをもらえるのは max_rewarded_referrals 人まで。
--     上限を超えた紹介は、紹介行もポイントも作らない（新規ユーザー側のボーナスも付かない）。
--     メール確認を自動で通している（auto_confirm_user）ため、複数アカウントでの量産を抑える目的。
create or replace function public.handle_new_user_referral()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  referrer uuid;
  bonus integer := 50;
  max_rewarded_referrals integer := 10;
begin
  begin
    referrer := (new.raw_user_meta_data->>'referred_by')::uuid;
  exception when others then
    referrer := null;
  end;

  if referrer is null or referrer = new.id then
    return new;
  end if;

  if not exists (select 1 from auth.users where id = referrer) then
    return new;
  end if;

  if (select count(*) from referrals where referrer_id = referrer) >= max_rewarded_referrals then
    return new;
  end if;

  insert into referrals (referrer_id, referred_id, bonus_awarded)
  values (referrer, new.id, bonus)
  on conflict (referred_id) do nothing;

  -- on conflict で0件だった場合（重複紹介など）はポイントを付与しない
  if found then
    insert into user_points (user_id, balance) values (referrer, bonus)
      on conflict (user_id) do update set balance = user_points.balance + bonus, updated_at = now();
    insert into point_transactions (user_id, amount, reason) values (referrer, bonus, 'referral_bonus:referrer');

    insert into user_points (user_id, balance) values (new.id, bonus)
      on conflict (user_id) do update set balance = user_points.balance + bonus, updated_at = now();
    insert into point_transactions (user_id, amount, reason) values (new.id, bonus, 'referral_bonus:referred');
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';

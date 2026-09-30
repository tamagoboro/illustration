-- フォロー機能
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。
-- 何度実行しても壊れないように、if not exists / create or replace / drop ... if exists で書いている。
--
-- ■ フォロー
--   creator_follows … 誰が誰をフォローしているか。
--   「お気に入り」は比較・保存用のブックマーク、「フォロー」は新着を通知で受け取るためのもの、という役割分担。
--   フォロワーの一覧（誰がフォローしているか）は公開せず、人数だけを get_follower_count() で返す。
--
-- ■ フォロワーへの通知（notifications に行を追加し、サイト内の通知ベルに表示される）
--   ・受付再開         … 既存の notify_favorites_on_reopen を拡張し、お気に入り登録者＋フォロワーへ（重複なし）
--   ・フィードへの投稿 … 同じクリエイターの投稿通知は3時間に1回まで（連投で通知が溢れないように）
--   ・キャンペーン開始 … campaign_enabled が false→true になった時。24時間に1回まで
--   ※ 作品（portfolio_items）の追加は通知しない。ダッシュボードの保存が「全削除→入れ直し」のため、
--     保存のたびに全フォロワーへ通知が飛んでしまうため。

-- ============================================================
-- 1. フォロー
-- ============================================================

create table if not exists public.creator_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  creator_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (follower_id, creator_id),
  constraint creator_follows_not_self check (follower_id <> creator_id)
);

create index if not exists creator_follows_creator_idx on public.creator_follows (creator_id);

alter table public.creator_follows enable row level security;

drop policy if exists "Users can view their own follows" on public.creator_follows;
create policy "Users can view their own follows" on public.creator_follows
  for select to authenticated using (follower_id = auth.uid());

drop policy if exists "Users can follow" on public.creator_follows;
create policy "Users can follow" on public.creator_follows
  for insert to authenticated with check (follower_id = auth.uid());

drop policy if exists "Users can unfollow" on public.creator_follows;
create policy "Users can unfollow" on public.creator_follows
  for delete to authenticated using (follower_id = auth.uid());

-- フォロワー数（誰がフォローしているかは返さない）
create or replace function public.get_follower_count(p_creator_id uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*)::integer from creator_follows where creator_id = p_creator_id;
$$;

grant execute on function public.get_follower_count(uuid) to anon, authenticated;

-- ============================================================
-- 2. フォロワーへの通知
-- ============================================================

-- 受付再開：お気に入り登録者とフォロワーの両方へ（両方している人には1通だけ）
create or replace function public.notify_favorites_on_reopen()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if old.status is distinct from new.status
     and new.status = 'available'
     and old.status in ('busy', 'stopped') then
    insert into notifications (user_id, type, title, body, link_url)
    select
      t.user_id,
      'favorite_creator_available',
      coalesce(nullif(new.display_name, ''), 'クリエイター') || 'さんが受付を再開しました',
      null,
      '/creator/' || new.user_id::text
    from (
      select fc.user_id from favorite_creators fc where fc.creator_id = new.user_id
      union
      select f.follower_id from creator_follows f where f.creator_id = new.user_id
    ) t
    where t.user_id <> new.user_id;
  end if;
  return new;
end;
$function$;

-- フィードへの新規投稿
create or replace function public.notify_followers_on_new_post()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text;
  v_body text;
begin
  select coalesce(nullif(display_name, ''), 'クリエイター') into v_name
  from profiles where user_id = new.user_id;

  v_body := case
    when coalesce(trim(new.content), '') = '' then '画像を投稿しました'
    when char_length(new.content) > 60 then left(new.content, 60) || '…'
    else new.content
  end;

  insert into notifications (user_id, type, title, body, link_url)
  select
    f.follower_id,
    'follow_new_post',
    coalesce(v_name, 'クリエイター') || 'さんがフィードに投稿しました',
    v_body,
    '/feed'
  from creator_follows f
  where f.creator_id = new.user_id
    and not exists (
      select 1 from notifications n
      where n.user_id = f.follower_id
        and n.type = 'follow_new_post'
        and n.title = coalesce(v_name, 'クリエイター') || 'さんがフィードに投稿しました'
        and n.created_at > now() - interval '3 hours'
    );
  return new;
end;
$function$;

drop trigger if exists trg_notify_followers_on_new_post on public.posts;
create trigger trg_notify_followers_on_new_post
  after insert on public.posts
  for each row execute function public.notify_followers_on_new_post();

-- キャンペーン開始
create or replace function public.notify_followers_on_campaign()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_link text := '/creator/' || new.user_id::text;
begin
  if coalesce(old.campaign_enabled, false) = false and new.campaign_enabled = true then
    insert into notifications (user_id, type, title, body, link_url)
    select
      f.follower_id,
      'follow_campaign',
      coalesce(nullif(new.display_name, ''), 'クリエイター') || 'さんがキャンペーンを開始しました',
      nullif(new.campaign_label, ''),
      v_link
    from creator_follows f
    where f.creator_id = new.user_id
      and not exists (
        select 1 from notifications n
        where n.user_id = f.follower_id
          and n.type = 'follow_campaign'
          and n.link_url = v_link
          and n.created_at > now() - interval '24 hours'
      );
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_notify_followers_on_campaign on public.profiles;
create trigger trg_notify_followers_on_campaign
  after update of campaign_enabled on public.profiles
  for each row execute function public.notify_followers_on_campaign();

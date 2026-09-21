-- 通知システムの土台。新着リクエスト・リクエストへの返答・お気に入りクリエイターの
-- 受付再開などを通知するための共通テーブル。
--
-- 通知はユーザーが直接INSERTするものではなく、システム（トリガー／RPC）が作るものなので、
-- 一般ユーザー向けのINSERTポリシーはあえて用意しない（なりすまし通知の防止）。

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on notifications (user_id, created_at desc);

alter table notifications enable row level security;

drop policy if exists "users can view own notifications" on notifications;
create policy "users can view own notifications"
  on notifications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can update own notifications" on notifications;
create policy "users can update own notifications"
  on notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users can delete own notifications" on notifications;
create policy "users can delete own notifications"
  on notifications for delete
  to authenticated
  using (auth.uid() = user_id);

-- お気に入り登録しているクリエイターが「受注停止中/相談受付中」から
-- 「即対応可」に切り替わったら、お気に入り登録している全員へ通知する。
create or replace function notify_favorites_on_reopen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status
     and new.status = 'available'
     and old.status in ('busy', 'stopped') then
    insert into notifications (user_id, type, title, body, link_url)
    select
      fc.user_id,
      'favorite_creator_available',
      coalesce(new.display_name, 'クリエイター') || 'さんが受付を再開しました',
      null,
      '/creator/' || new.user_id::text
    from favorite_creators fc
    where fc.creator_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_favorites_on_reopen on profiles;
create trigger trg_notify_favorites_on_reopen
  after update on profiles
  for each row
  execute function notify_favorites_on_reopen();

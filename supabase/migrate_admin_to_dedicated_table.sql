-- profiles.is_admin をやめて、専用の admins テーブルに管理者フラグを移す。
--
-- 理由1（自己昇格の防止）: profiles には「本人は自分の行を更新できる」RLSポリシーが
-- 既にあり、行レベルセキュリティは列単位で制限できないため、is_admin列を
-- 追加しただけでは悪意のあるユーザーがAPI経由で自分の is_admin を
-- true に書き換えられてしまう
--   （例: supabase.from('profiles').update({ is_admin: true }).eq('user_id', 自分のid) ）。
--
-- 理由2（情報漏えいの防止）: 多くのページが profiles を select('*') で
-- 公開取得しているため、is_admin列があるとブラウザの通信内容から
-- 「誰が管理者か」が誰でも見えてしまう。
--
-- admins テーブルは書き込みポリシーを一切用意しないため、APIからは
-- 誰であっても増減できず、Supabase SQL Editor（管理者権限）からのみ操作できる。
-- SELECTも「自分の行だけ」に限定し、他人が管理者かどうかも分からないようにする。

create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;

drop policy if exists "admins_select_self" on admins;
create policy "admins_select_self"
  on admins for select
  using (auth.uid() = user_id);

-- 既に is_admin = true を設定していた場合は admins テーブルへ引き継ぐ
insert into admins (user_id)
select user_id from profiles where is_admin = true
on conflict (user_id) do nothing;

-- icon_rings の書き込み権限を admins テーブル参照に切り替え
drop policy if exists "icon_rings_admin_write" on icon_rings;
create policy "icon_rings_admin_write"
  on icon_rings for all
  using (exists (select 1 from admins where admins.user_id = auth.uid()))
  with check (exists (select 1 from admins where admins.user_id = auth.uid()));

-- storage(rings/ 配下)の権限も admins テーブル参照に切り替え
drop policy if exists "icon_rings_admin_upload" on storage.objects;
create policy "icon_rings_admin_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'portfolios'
    and (storage.foldername(name))[1] = 'rings'
    and exists (select 1 from admins where admins.user_id = auth.uid())
  );

drop policy if exists "icon_rings_admin_update" on storage.objects;
create policy "icon_rings_admin_update"
  on storage.objects for update
  using (
    bucket_id = 'portfolios'
    and (storage.foldername(name))[1] = 'rings'
    and exists (select 1 from admins where admins.user_id = auth.uid())
  );

drop policy if exists "icon_rings_admin_delete" on storage.objects;
create policy "icon_rings_admin_delete"
  on storage.objects for delete
  using (
    bucket_id = 'portfolios'
    and (storage.foldername(name))[1] = 'rings'
    and exists (select 1 from admins where admins.user_id = auth.uid())
  );

-- is_admin 列はもう使わないので削除する
alter table profiles drop column if exists is_admin;

-- 実行後、自分を管理者にするには以下を実行してください:
--   insert into admins (user_id) values ('自分のuser_id') on conflict (user_id) do nothing;

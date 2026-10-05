-- 緊急メンテナンスの切り替え（ページ単位）
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。何度実行しても壊れない。
--
-- ・area    … 対象のページ（画面側 lib/maintenance.ts の MAINTENANCE_AREAS と同じ名前）
--               estimate … 見積もりフォーム作成 / wanted … 募集ボード / feed … フィード / agreement_new … 控えの作成
-- ・enabled … true のあいだ、そのページは「緊急メンテナンス中」の画面になる（管理者だけは中身を見られる）
-- 読むのは誰でもできる（ログインしていない人にもメンテナンス画面を出すため）。切り替えは管理者だけ。

create table if not exists public.maintenance_flags (
  area text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.maintenance_flags (area)
values ('estimate'), ('wanted'), ('feed'), ('agreement_new')
on conflict (area) do nothing;

alter table public.maintenance_flags enable row level security;

drop policy if exists "anyone can view maintenance flags" on public.maintenance_flags;
create policy "anyone can view maintenance flags" on public.maintenance_flags
  for select to anon, authenticated
  using (true);

drop policy if exists "admins can update maintenance flags" on public.maintenance_flags;
create policy "admins can update maintenance flags" on public.maintenance_flags
  for update to authenticated
  using (exists (select 1 from admins where admins.user_id = auth.uid()))
  with check (exists (select 1 from admins where admins.user_id = auth.uid()));

grant select on public.maintenance_flags to anon, authenticated;
grant update on public.maintenance_flags to authenticated;

notify pgrst, 'reload schema';

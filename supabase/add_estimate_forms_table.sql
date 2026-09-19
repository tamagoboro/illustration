-- 1人のクリエイターが複数の見積もりフォームを持てるようにするテーブル
-- 既存の profiles.form_config（1人1フォーム）は後方互換のため残したまま、
-- 新規・追加のフォームはすべてこちらのテーブルで管理する
create table if not exists estimate_forms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'ご依頼・お仕事申請フォーム',
  description text not null default '',
  theme_color text not null default '#ec4899',
  is_accepting boolean not null default true,
  fields jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estimate_forms_user_id_idx on estimate_forms(user_id, sort_order);

alter table estimate_forms enable row level security;

-- 公開プロフィールページから誰でも閲覧できる（依頼者が見積もりフォームを使うため）
drop policy if exists "Public can view estimate forms" on estimate_forms;
create policy "Public can view estimate forms"
  on estimate_forms for select
  using (true);

-- 自分のフォームだけ作成・更新・削除できる
drop policy if exists "Owners can insert their own forms" on estimate_forms;
create policy "Owners can insert their own forms"
  on estimate_forms for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owners can update their own forms" on estimate_forms;
create policy "Owners can update their own forms"
  on estimate_forms for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owners can delete their own forms" on estimate_forms;
create policy "Owners can delete their own forms"
  on estimate_forms for delete
  using (auth.uid() = user_id);

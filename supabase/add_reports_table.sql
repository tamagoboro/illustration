-- 無断転載・著作権侵害などを閲覧者が運営に通報できる機能。
-- プロフィール単位、または個別の作品単位で通報できるようにする。

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('profile', 'portfolio_item')),
  target_id text not null,
  creator_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  comment text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists reports_status_idx on reports (status, created_at desc);
create index if not exists reports_creator_id_idx on reports (creator_id);

alter table reports enable row level security;

-- 匿名・ログイン中どちらの訪問者でも通報を送信できる（reporter_idは自分のIDかnullのみ許可）
drop policy if exists "anyone can submit a report" on reports;
create policy "anyone can submit a report"
  on reports for insert
  to authenticated, anon
  with check (reporter_id is null or reporter_id = auth.uid());

-- 通報の閲覧・対応は管理者のみ
drop policy if exists "admins can view reports" on reports;
create policy "admins can view reports"
  on reports for select
  to authenticated
  using (exists (select 1 from admins where admins.user_id = auth.uid()));

drop policy if exists "admins can update reports" on reports;
create policy "admins can update reports"
  on reports for update
  to authenticated
  using (exists (select 1 from admins where admins.user_id = auth.uid()))
  with check (exists (select 1 from admins where admins.user_id = auth.uid()));

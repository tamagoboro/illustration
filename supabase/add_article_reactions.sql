-- 記事への「いいね」と「コメント」
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。何度実行しても壊れない。
-- 前提: add_articles.sql を実行済みであること。
--
-- ・article_likes    … 誰がどの記事にいいねしたか（1人1記事1回）
-- ・article_comments … 記事へのコメント（500文字まで）
-- どちらも、読むのは誰でもできる。書き込みはログインした本人だけ。
-- 削除は、自分の分は本人が、コメントは管理者も削除できる。
-- 記事を削除すると、その記事のいいね・コメントも一緒に消える。

create table if not exists public.article_likes (
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_id, user_id)
);

alter table public.article_likes enable row level security;

drop policy if exists "Anyone can read article likes" on public.article_likes;
create policy "Anyone can read article likes" on public.article_likes
  for select to public using (true);

drop policy if exists "Users can like articles" on public.article_likes;
create policy "Users can like articles" on public.article_likes
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can unlike articles" on public.article_likes;
create policy "Users can unlike articles" on public.article_likes
  for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.article_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists article_comments_article_idx on public.article_comments (article_id, created_at);

alter table public.article_comments enable row level security;

drop policy if exists "Anyone can read article comments" on public.article_comments;
create policy "Anyone can read article comments" on public.article_comments
  for select to public using (true);

drop policy if exists "Users can comment on articles" on public.article_comments;
create policy "Users can comment on articles" on public.article_comments
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users and admins can delete article comments" on public.article_comments;
create policy "Users and admins can delete article comments" on public.article_comments
  for delete to authenticated
  using (auth.uid() = user_id or exists (select 1 from admins a where a.user_id = auth.uid()));

notify pgrst, 'reload schema';

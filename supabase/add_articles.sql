-- 記事（/articles）
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。何度実行しても壊れない。
--
-- 管理者が書く読みもの（イラストの基礎知識・依頼の受け方・プラットフォーム紹介など）。
--   slug        … URLの末尾（/articles/<slug>）。英小文字・数字・ハイフン
--   category    … lib/articles.ts の ARTICLE_CATEGORIES のどれか
--   body        … 本文（Markdown）。画像・動画・リンクカードは画面側で描画する
--   status      … draft（下書き：管理者だけが見られる）/ published（公開）
--   published_at… 初めて公開した日時（一覧の並び順・記事に表示する日付）
-- 読めるのは「公開中の記事は誰でも」「下書きは管理者だけ」。書けるのは管理者だけ。
-- 記事の画像は portfolios バケットの articles/ に置く（管理者のアップロードは add_admin_image_moderation.sql で許可済み）。

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 300),
  category text not null default 'basics',
  cover_image_url text,
  body text not null default '' check (char_length(body) <= 100000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists articles_published_idx on public.articles (status, published_at desc);

alter table public.articles enable row level security;

drop policy if exists "Anyone can read published articles" on public.articles;
create policy "Anyone can read published articles" on public.articles
  for select to public
  using (status = 'published' or exists (select 1 from admins a where a.user_id = auth.uid()));

drop policy if exists "Admins can insert articles" on public.articles;
create policy "Admins can insert articles" on public.articles
  for insert to authenticated
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

drop policy if exists "Admins can update articles" on public.articles;
create policy "Admins can update articles" on public.articles
  for update to authenticated
  using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

drop policy if exists "Admins can delete articles" on public.articles;
create policy "Admins can delete articles" on public.articles
  for delete to authenticated
  using (exists (select 1 from admins a where a.user_id = auth.uid()));

-- 更新日時と、初めて公開した日時を自動で入れる
create or replace function public.touch_article()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_touch_article on public.articles;
create trigger trg_touch_article
  before insert or update on public.articles
  for each row execute function public.touch_article();

notify pgrst, 'reload schema';

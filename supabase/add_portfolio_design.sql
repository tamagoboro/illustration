-- ポートフォリオページのデザイン設定（背景・カバー画像・YouTube動画）
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。何度実行しても壊れない。
-- 本人が profiles を更新する既存のポリシーで読み書きできるので、新しいポリシーは不要。
--
-- ・page_background … 背景。{ "type": "preset" | "color" | "image", "value": "sky" / "#ffe4e6" / 画像URL, "overlay": 0〜80 }
--   overlay は背景の上に重ねる白いベールの濃さ（%）。画像の背景でも文字が読みやすくなるようにする。
-- ・cover_image_url … ページ上部の大きなカバー画像（未設定なら1枚目の作品をぼかして使う）
-- ・portfolio_videos … YouTube動画（最大6本）。[{ "youtubeId": "xxxxxxxxxxx", "title": "メイキング" }]

alter table public.profiles
  add column if not exists page_background jsonb not null default '{"type":"preset","value":"sky","overlay":0}'::jsonb,
  add column if not exists cover_image_url text,
  add column if not exists portfolio_videos jsonb not null default '[]'::jsonb;

alter table public.profiles drop constraint if exists profiles_portfolio_videos_check;
alter table public.profiles
  add constraint profiles_portfolio_videos_check
  check (jsonb_typeof(portfolio_videos) = 'array' and jsonb_array_length(portfolio_videos) <= 6);

alter table public.profiles drop constraint if exists profiles_page_background_check;
alter table public.profiles
  add constraint profiles_page_background_check
  check (jsonb_typeof(page_background) = 'object' and page_background->>'type' in ('preset', 'color', 'image'));

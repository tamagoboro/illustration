-- 料金表（おしながき）の画像
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。
-- 何度実行しても壊れないように、if not exists で書いている。
--
-- 料金メニューを、文字で1項目ずつ入力する（profiles.menu_items）代わりに、
-- 手持ちの料金表の画像を載せるだけでも掲載できるようにする。
--   price_menu_images … 料金表の画像URL（portfolios バケット。最大3枚）。
--     入っているときは、クリエイターページの「料金」に文字のメニューの代わりにこの画像を表示する。
--     空のときは、これまでどおり menu_items を表示する。
-- 金額での絞り込み・並び替えは、これまでどおり price_min（参考最低価格）を使う。
alter table public.profiles
  add column if not exists price_menu_images text[] not null default '{}'::text[];

notify pgrst, 'reload schema';

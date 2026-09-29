-- 作品サムネイルの「見せたい位置」をクリエイター自身が指定できるようにする。
--
-- 背景: 一覧・クリエイターページのサムネイルは object-fit: cover で正方形に切り抜いて
-- 表示しているため、縦長のイラストだと自動的に中央（多くの場合は顔より下）が切り抜かれ、
-- 「首から下しか写っていない」ような表示になってしまうケースがあった。
--
-- focal_x / focal_y は、画像の中で「常に見えるようにしたい点」を0〜100（%）で表す
-- （CSSのobject-positionにそのまま使う値。50/50が中央＝これまでの見た目と同じ）。
alter table public.portfolio_items
  add column if not exists focal_x smallint not null default 50,
  add column if not exists focal_y smallint not null default 50;

alter table public.portfolio_items drop constraint if exists portfolio_items_focal_x_range;
alter table public.portfolio_items drop constraint if exists portfolio_items_focal_y_range;
alter table public.portfolio_items
  add constraint portfolio_items_focal_x_range check (focal_x between 0 and 100),
  add constraint portfolio_items_focal_y_range check (focal_y between 0 and 100);

notify pgrst, 'reload schema';

-- ホームページのサムネイル表示用ビュー。
--
-- これまでは各クリエイターの「先頭1枚」を得るために portfolio_items を
-- 全件（全クリエイター分の全作品）取得してからJS側で絞り込んでいたため、
-- 作品数が増えるほどホームページの読み込みが重くなっていた。
-- このビューはDB側で「クリエイターごとの先頭1枚」だけに絞り込むので、
-- 転送されるデータ量が大幅に減る。

create or replace view first_portfolio_thumbnails as
select distinct on (user_id) user_id, image_url
from portfolio_items
order by user_id, sort_order asc;

grant select on first_portfolio_thumbnails to anon, authenticated;

-- first_portfolio_thumbnails はセキュリティ定義者権限で動作するため、
-- portfolio_items 側のRLSに関わらず全クリエイターの作品が見えてしまう。
-- 非公開プロフィール(is_public = false)の作品が漏れないよう、
-- ビュー自体に「公開プロフィールのみ」の条件を明示しておく。
create or replace view first_portfolio_thumbnails as
select distinct on (pi.user_id) pi.user_id, pi.image_url
from portfolio_items pi
join profiles p on p.user_id = pi.user_id
where p.is_public = true
order by pi.user_id, pi.sort_order asc;

grant select on first_portfolio_thumbnails to anon, authenticated;

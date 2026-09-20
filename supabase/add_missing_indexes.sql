-- user_id / creator_id のような「絞り込みによく使う列」は、主キーでない限り
-- Postgresが自動でインデックスを作ってくれるわけではない。
-- これが無いと、そのテーブルの行数が増えるほど検索が遅くなる
-- （＝サイトがだんだん重くなる、の典型的な原因の1つ）。
-- IF NOT EXISTS を使っているので、複数回実行しても安全。

create index if not exists idx_portfolio_items_user_sort on portfolio_items(user_id, sort_order);
create index if not exists idx_estimate_forms_user_sort on estimate_forms(user_id, sort_order);

create index if not exists idx_reviews_creator on reviews(creator_id);
create index if not exists idx_reviews_reviewer on reviews(reviewer_id);

create index if not exists idx_favorite_creators_user on favorite_creators(user_id);
create index if not exists idx_favorite_creators_creator on favorite_creators(creator_id);

create index if not exists idx_posts_created_at on posts(created_at desc);
create index if not exists idx_posts_user on posts(user_id);
create index if not exists idx_post_likes_post on post_likes(post_id);
create index if not exists idx_post_likes_user on post_likes(user_id);
create index if not exists idx_post_comments_post on post_comments(post_id);

create index if not exists idx_user_icon_rings_user on user_icon_rings(user_id);
create index if not exists idx_point_transactions_user on point_transactions(user_id);
create index if not exists idx_referrals_referrer on referrals(referrer_id);

create index if not exists idx_profiles_is_public on profiles(is_public);

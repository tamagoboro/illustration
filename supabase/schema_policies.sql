-- 現行DB（public）のRLS有効化・ポリシー・インデックス。supabase/export_current_schema.sql の②で書き出したもの（記録用）。
-- 主キー・ユニーク制約由来のインデックスは含まない。DBを変更したらこの記録も更新すること。

alter table public.admins enable row level security;
alter table public.analytics_logs enable row level security;
alter table public.creator_forms enable row level security;
alter table public.custom_page_settings enable row level security;
alter table public.estimate_forms enable row level security;
alter table public.favorite_creators enable row level security;
alter table public.favorites enable row level security;
alter table public.icon_rings enable row level security;
alter table public.notifications enable row level security;
alter table public.page_blocks enable row level security;
alter table public.point_transactions enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.posts enable row level security;
alter table public.profiles enable row level security;
alter table public.referrals enable row level security;
alter table public.reports enable row level security;
alter table public.requests enable row level security;
alter table public.reviews enable row level security;
alter table public.user_icon_rings enable row level security;
alter table public.user_points enable row level security;

create policy "Allow creator to read own analytics" on public.analytics_logs as PERMISSIVE for SELECT to public
  using ((auth.uid() = creator_id));
create policy "Allow individual user portfolio access" on public.portfolio_items as PERMISSIVE for ALL to public
  using ((auth.uid() = user_id));
create policy "Allow public insert to analytics_logs" on public.analytics_logs as PERMISSIVE for INSERT to public
  with check (true);
create policy "Allow public read access on portfolio_items" on public.portfolio_items as PERMISSIVE for SELECT to public
  using (true);
create policy "Anyone can view reviews" on public.reviews as PERMISSIVE for SELECT to public
  using (true);
create policy "Anyone can view who owns which ring" on public.user_icon_rings as PERMISSIVE for SELECT to public
  using (true);
create policy "Authenticated delete likes" on public.post_likes as PERMISSIVE for DELETE to public
  using ((auth.uid() = user_id));
create policy "Authenticated delete own comments" on public.post_comments as PERMISSIVE for DELETE to public
  using ((auth.uid() = user_id));
create policy "Authenticated delete own posts" on public.posts as PERMISSIVE for DELETE to public
  using ((auth.uid() = user_id));
create policy "Authenticated insert comments" on public.post_comments as PERMISSIVE for INSERT to public
  with check ((auth.uid() = user_id));
create policy "Authenticated insert likes" on public.post_likes as PERMISSIVE for INSERT to public
  with check ((auth.uid() = user_id));
create policy "Authenticated insert posts" on public.posts as PERMISSIVE for INSERT to public
  with check ((auth.uid() = user_id));
create policy "Authenticated update own posts" on public.posts as PERMISSIVE for UPDATE to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));
create policy "Logged in users can post their own review" on public.reviews as PERMISSIVE for INSERT to public
  with check ((auth.uid() = reviewer_id));
create policy "Owner All Page Blocks" on public.page_blocks as PERMISSIVE for ALL to public
  using ((auth.uid() = user_id));
create policy "Owner All Page Settings" on public.custom_page_settings as PERMISSIVE for ALL to public
  using ((auth.uid() = user_id));
create policy "Owner All Portfolio Items" on public.portfolio_items as PERMISSIVE for ALL to public
  using ((auth.uid() = user_id));
create policy "Owners can delete their own forms" on public.estimate_forms as PERMISSIVE for DELETE to public
  using ((auth.uid() = user_id));
create policy "Owners can insert their own forms" on public.estimate_forms as PERMISSIVE for INSERT to public
  with check ((auth.uid() = user_id));
create policy "Owners can update their own forms" on public.estimate_forms as PERMISSIVE for UPDATE to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));
create policy "Public Read Page Blocks" on public.page_blocks as PERMISSIVE for SELECT to public
  using (true);
create policy "Public Read Page Settings" on public.custom_page_settings as PERMISSIVE for SELECT to public
  using (true);
create policy "Public Read Portfolio Items" on public.portfolio_items as PERMISSIVE for SELECT to public
  using (true);
create policy "Public can view estimate forms" on public.estimate_forms as PERMISSIVE for SELECT to public
  using (true);
create policy "Public profiles are viewable by everyone." on public.profiles as PERMISSIVE for SELECT to public
  using (true);
create policy "Public read comments" on public.post_comments as PERMISSIVE for SELECT to public
  using (true);
create policy "Public read likes" on public.post_likes as PERMISSIVE for SELECT to public
  using (true);
create policy "Public read posts" on public.posts as PERMISSIVE for SELECT to public
  using (true);
create policy "Users can add their own favorites" on public.favorite_creators as PERMISSIVE for INSERT to public
  with check ((auth.uid() = user_id));
create policy "Users can delete their own review" on public.reviews as PERMISSIVE for DELETE to public
  using ((auth.uid() = reviewer_id));
create policy "Users can insert their own profile." on public.profiles as PERMISSIVE for INSERT to public
  with check ((auth.uid() = user_id));
create policy "Users can remove their own favorites" on public.favorite_creators as PERMISSIVE for DELETE to public
  using ((auth.uid() = user_id));
create policy "Users can update own profile." on public.profiles as PERMISSIVE for UPDATE to public
  using ((auth.uid() = user_id));
create policy "Users can update their own review" on public.reviews as PERMISSIVE for UPDATE to public
  using ((auth.uid() = reviewer_id))
  with check ((auth.uid() = reviewer_id));
create policy "Users can view referrals involving them" on public.referrals as PERMISSIVE for SELECT to public
  using (((auth.uid() = referrer_id) OR (auth.uid() = referred_id)));
create policy "Users can view their own favorites" on public.favorite_creators as PERMISSIVE for SELECT to public
  using ((auth.uid() = user_id));
create policy "Users can view their own transactions" on public.point_transactions as PERMISSIVE for SELECT to public
  using ((auth.uid() = user_id));
create policy "Users can view their own wallet" on public.user_points as PERMISSIVE for SELECT to public
  using ((auth.uid() = user_id));
create policy "admins can update reports" on public.reports as PERMISSIVE for UPDATE to authenticated
  using ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))))
  with check ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
create policy "admins can view reports" on public.reports as PERMISSIVE for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
create policy "anyone can submit a report" on public.reports as PERMISSIVE for INSERT to anon, authenticated
  with check (((reporter_id IS NULL) OR (reporter_id = auth.uid())));
create policy "clients can send requests" on public.requests as PERMISSIVE for INSERT to authenticated
  with check ((client_id = auth.uid()));
create policy "creators can view own analytics" on public.analytics_logs as PERMISSIVE for SELECT to public
  using ((auth.uid() = creator_id));
create policy "parties can update their requests" on public.requests as PERMISSIVE for UPDATE to authenticated
  using (((auth.uid() = creator_id) OR (auth.uid() = client_id)))
  with check (((auth.uid() = creator_id) OR (auth.uid() = client_id)));
create policy "parties can view their requests" on public.requests as PERMISSIVE for SELECT to authenticated
  using (((auth.uid() = creator_id) OR (auth.uid() = client_id)));
create policy "users can create their own notifications" on public.notifications as PERMISSIVE for INSERT to authenticated
  with check ((auth.uid() = user_id));
create policy "users can delete own notifications" on public.notifications as PERMISSIVE for DELETE to authenticated
  using ((auth.uid() = user_id));
create policy "users can update own notifications" on public.notifications as PERMISSIVE for UPDATE to authenticated
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));
create policy "users can view own notifications" on public.notifications as PERMISSIVE for SELECT to authenticated
  using ((auth.uid() = user_id));
create policy "ユーザーは自分のお気に入りのみ操作可能" on public.favorites as PERMISSIVE for ALL to public
  using ((auth.uid() = user_id));
create policy "本人のみポートフォリオを作成・更新・削除可" on public.portfolio_items as PERMISSIVE for ALL to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));
create policy "誰でもポートフォリオを閲覧可能" on public.portfolio_items as PERMISSIVE for SELECT to public
  using (true);
create policy admins_select_self on public.admins as PERMISSIVE for SELECT to public
  using ((auth.uid() = user_id));
create policy icon_rings_admin_write on public.icon_rings as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))))
  with check ((EXISTS ( SELECT 1
   FROM admins
  WHERE (admins.user_id = auth.uid()))));
create policy icon_rings_select_all on public.icon_rings as PERMISSIVE for SELECT to public
  using (true);

CREATE INDEX analytics_logs_event_creator_created_idx ON public.analytics_logs USING btree (event_type, creator_id, created_at DESC);
CREATE INDEX estimate_forms_user_id_idx ON public.estimate_forms USING btree (user_id, sort_order);
CREATE INDEX favorite_creators_user_idx ON public.favorite_creators USING btree (user_id);
CREATE INDEX idx_estimate_forms_user_sort ON public.estimate_forms USING btree (user_id, sort_order);
CREATE INDEX idx_favorite_creators_creator ON public.favorite_creators USING btree (creator_id);
CREATE INDEX idx_favorite_creators_user ON public.favorite_creators USING btree (user_id);
CREATE INDEX idx_point_transactions_user ON public.point_transactions USING btree (user_id);
CREATE INDEX idx_portfolio_items_user_sort ON public.portfolio_items USING btree (user_id, sort_order);
CREATE INDEX idx_post_comments_post ON public.post_comments USING btree (post_id);
CREATE INDEX idx_post_likes_post ON public.post_likes USING btree (post_id);
CREATE INDEX idx_post_likes_user ON public.post_likes USING btree (user_id);
CREATE INDEX idx_posts_created_at ON public.posts USING btree (created_at DESC);
CREATE INDEX idx_posts_user ON public.posts USING btree (user_id);
CREATE INDEX idx_profiles_is_public ON public.profiles USING btree (is_public);
CREATE INDEX idx_referrals_referrer ON public.referrals USING btree (referrer_id);
CREATE INDEX idx_reviews_creator ON public.reviews USING btree (creator_id);
CREATE INDEX idx_reviews_reviewer ON public.reviews USING btree (reviewer_id);
CREATE INDEX idx_user_icon_rings_user ON public.user_icon_rings USING btree (user_id);
CREATE INDEX notifications_user_id_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX point_transactions_user_idx ON public.point_transactions USING btree (user_id, created_at DESC);
CREATE INDEX post_comments_post_id_idx ON public.post_comments USING btree (post_id);
CREATE INDEX posts_created_at_idx ON public.posts USING btree (created_at DESC);
CREATE INDEX posts_user_id_idx ON public.posts USING btree (user_id);
CREATE INDEX profiles_is_public_idx ON public.profiles USING btree (is_public) WHERE (is_public = true);
CREATE INDEX referrals_referrer_idx ON public.referrals USING btree (referrer_id);
CREATE INDEX reports_creator_id_idx ON public.reports USING btree (creator_id);
CREATE INDEX reports_status_idx ON public.reports USING btree (status, created_at DESC);
CREATE INDEX requests_client_id_idx ON public.requests USING btree (client_id, created_at DESC);
CREATE INDEX requests_creator_id_idx ON public.requests USING btree (creator_id, created_at DESC);
CREATE INDEX reviews_creator_idx ON public.reviews USING btree (creator_id, created_at DESC);

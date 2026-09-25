-- 現行DB（public）の関数・トリガー関数の定義。supabase/export_current_schema.sql の①で書き出したもの（記録用）。
-- get_public_creator_badges は add_get_public_creator_badges.sql が正なのでここには含めていない。
-- どのトリガーがどの関数を呼ぶかは schema_triggers.md を参照。DBを変更したらこの記録も更新すること。
-- 最終確認: harden_security.sql / remove_duplicate_request_notifications.sql /
--           fix_starter_bonus_and_cleanup_duplicates.sql の適用後。

CREATE OR REPLACE FUNCTION public.admin_adjust_points(p_user_id uuid, p_amount integer, p_reason text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_new_balance integer;
begin
  if not exists (select 1 from admins where admins.user_id = auth.uid()) then
    raise exception '管理者のみ実行できます';
  end if;

  insert into user_points (user_id, balance) values (p_user_id, greatest(p_amount, 0))
    on conflict (user_id) do update
      set balance = greatest(user_points.balance + p_amount, 0)
    returning balance into v_new_balance;

  insert into point_transactions (user_id, amount, reason)
    values (p_user_id, p_amount, coalesce(p_reason, 'admin_adjust'));

  return v_new_balance;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_find_user_by_email(p_email text)
 RETURNS TABLE(user_id uuid, email text, display_name text, avatar_url text, balance integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from admins where admins.user_id = auth.uid()) then
    raise exception '管理者のみ実行できます';
  end if;

  return query
  select u.id, u.email::text, p.display_name, p.avatar_url, coalesce(up.balance, 0)
  from auth.users u
  left join profiles p on p.user_id = u.id
  left join user_points up on up.user_id = u.id
  where u.email = p_email;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_get_creator_pv_stats()
 RETURNS TABLE(user_id uuid, display_name text, is_public boolean, status text, pv_7d bigint, pv_30d bigint, pv_total bigint, inquiry_30d bigint, new_favorites_7d bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from admins where admins.user_id = auth.uid()) then
    raise exception '権限がありません';
  end if;

  return query
  select
    p.user_id,
    p.display_name,
    p.is_public,
    p.status,
    count(*) filter (where a.event_type = 'pv' and a.created_at >= now() - interval '7 days')::bigint as pv_7d,
    count(*) filter (where a.event_type = 'pv' and a.created_at >= now() - interval '30 days')::bigint as pv_30d,
    count(*) filter (where a.event_type = 'pv')::bigint as pv_total,
    count(*) filter (where a.event_type = 'estimate_calc' and a.created_at >= now() - interval '30 days')::bigint as inquiry_30d,
    count(*) filter (where a.event_type = 'favorite' and a.created_at >= now() - interval '7 days')::bigint as new_favorites_7d
  from profiles p
  left join analytics_logs a on a.creator_id = p.user_id
  group by p.user_id, p.display_name, p.is_public, p.status
  order by pv_30d desc, pv_7d desc;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_grant_ring(p_user_id uuid, p_ring_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from admins where admins.user_id = auth.uid()) then
    raise exception '管理者のみ実行できます';
  end if;

  if not exists (select 1 from icon_rings where id = p_ring_id) then
    raise exception '存在しないリングです';
  end if;

  if exists (select 1 from user_icon_rings where user_id = p_user_id and ring_id = p_ring_id) then
    raise exception 'すでに所持しています';
  end if;

  insert into user_icon_rings (user_id, ring_id) values (p_user_id, p_ring_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_list_users(p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(user_id uuid, display_name text, avatar_url text, has_dashboard_setup boolean, is_public boolean, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from admins where admins.user_id = auth.uid()) then
    raise exception '管理者のみ実行できます';
  end if;

  return query
  select p.user_id, p.display_name, p.avatar_url, p.has_dashboard_setup, p.is_public, p.updated_at
  from profiles p
  order by p.updated_at desc nulls last
  limit p_limit offset p_offset;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_search_users(p_query text)
 RETURNS TABLE(user_id uuid, email text, display_name text, avatar_url text, balance integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from admins where admins.user_id = auth.uid()) then
    raise exception '管理者のみ実行できます';
  end if;

  return query
  select u.id, u.email::text, p.display_name, p.avatar_url, coalesce(up.balance, 0)
  from auth.users u
  left join profiles p on p.user_id = u.id
  left join user_points up on up.user_id = u.id
  where
    (p.display_name ilike '%' || p_query || '%')
    or (u.id::text = p_query)
  order by p.display_name nulls last
  limit 20;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_account_type(p_user_id uuid, p_is_creator boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from admins where admins.user_id = auth.uid()) then
    raise exception '管理者のみ実行できます';
  end if;

  update profiles
  set has_dashboard_setup = p_is_creator
  where user_id = p_user_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_confirm_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.email_confirmed_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_request_rate_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  recent_count integer;
  pending_count integer;
begin
  select count(*) into recent_count
  from requests
  where client_id = new.client_id
    and creator_id = new.creator_id
    and created_at >= now() - interval '24 hours';

  if recent_count > 0 then
    raise exception '同じクリエイターへのリクエストは24時間以内に1件までです。返信をお待ちいただくか、時間をおいて再度お試しください。';
  end if;

  select count(*) into pending_count
  from requests
  where client_id = new.client_id
    and status = 'pending';

  if pending_count >= 5 then
    raise exception '未回答のリクエストが5件に達しています。返信を待つか、不要なリクエストを取り下げてから送信してください。';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.equip_ring(p_ring_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'ログインが必要です';
  end if;

  if p_ring_id is not null and not exists (
    select 1 from user_icon_rings where user_id = uid and ring_id = p_ring_id
  ) then
    raise exception 'このリングは所持していません';
  end if;

  insert into user_points (user_id, equipped_ring_id)
  values (uid, p_ring_id)
  on conflict (user_id) do update set equipped_ring_id = p_ring_id, updated_at = now();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.grant_review_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.reviewer_id = new.creator_id then
    return new;
  end if;

  if exists (
    select 1 from point_transactions
    where user_id = new.reviewer_id
      and reason = 'review_posted:' || new.creator_id
  ) then
    return new;
  end if;

  insert into user_points (user_id, balance) values (new.reviewer_id, 50)
    on conflict (user_id) do update set balance = user_points.balance + 50;

  insert into point_transactions (user_id, amount, reason)
    values (new.reviewer_id, 50, 'review_posted:' || new.creator_id);

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.grant_starter_bonus()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  current_balance integer;
begin
  if uid is null then
    raise exception 'ログインが必要です';
  end if;

  insert into user_points (user_id, balance)
  values (uid, 0)
  on conflict (user_id) do nothing;

  -- 同じユーザーの同時実行はここで待たされ、先の実行がコミットされたあとに下の確認へ進む
  perform 1 from user_points where user_id = uid for update;

  if not exists (select 1 from point_transactions where user_id = uid and reason = 'starter_bonus') then
    update user_points set balance = balance + 100, updated_at = now() where user_id = uid;
    insert into point_transactions (user_id, amount, reason) values (uid, 100, 'starter_bonus');
  end if;

  select balance into current_balance from user_points where user_id = uid;
  return current_balance;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    display_name,
    status,
    tastes,
    price_min,
    lead_time_days,
    updated_at
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', ''),
    'available',
    '{}'::text[], -- integer ではなく正しい text[] 型の空配列
    NULL,         -- integer カラムには NULL をセット
    NULL,         -- integer カラムには NULL をセット
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user_referral()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  referrer uuid;
  bonus integer := 50;
  max_rewarded_referrals integer := 10;
begin
  begin
    referrer := (new.raw_user_meta_data->>'referred_by')::uuid;
  exception when others then
    referrer := null;
  end;

  if referrer is null or referrer = new.id then
    return new;
  end if;

  if not exists (select 1 from auth.users where id = referrer) then
    return new;
  end if;

  if (select count(*) from referrals where referrer_id = referrer) >= max_rewarded_referrals then
    return new;
  end if;

  insert into referrals (referrer_id, referred_id, bonus_awarded)
  values (referrer, new.id, bonus)
  on conflict (referred_id) do nothing;

  -- on conflict で0件だった場合（重複紹介など）はポイントを付与しない
  if found then
    insert into user_points (user_id, balance) values (referrer, bonus)
      on conflict (user_id) do update set balance = user_points.balance + bonus, updated_at = now();
    insert into point_transactions (user_id, amount, reason) values (referrer, bonus, 'referral_bonus:referrer');

    insert into user_points (user_id, balance) values (new.id, bonus)
      on conflict (user_id) do update set balance = user_points.balance + bonus, updated_at = now();
    insert into point_transactions (user_id, amount, reason) values (new.id, bonus, 'referral_bonus:referred');
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_likes(target_user_id uuid, is_liking boolean)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_admins_on_new_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into notifications (user_id, type, title, body, link_url)
  select
    a.user_id,
    'new_report',
    '🚨 新しい通報がありました',
    case
      when new.target_type = 'profile' then 'プロフィール全体 / ' || new.reason
      else '作品 / ' || new.reason
    end,
    '/admin/reports'
  from admins a;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_author_on_post_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_author uuid;
begin
  select user_id into v_author from posts where id = new.post_id;

  if v_author is null or v_author = new.user_id then
    return new;
  end if;

  insert into notifications (user_id, type, title, body, link_url)
  values (
    v_author,
    'post_comment',
    '💬 投稿にコメントが届きました',
    left(new.content, 60),
    '/feed'
  );
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_author_on_post_like()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_author uuid;
begin
  select user_id into v_author from posts where id = new.post_id;

  if v_author is null or v_author = new.user_id then
    return new;
  end if;

  insert into notifications (user_id, type, title, body, link_url)
  values (
    v_author,
    'post_like',
    '❤️ 投稿にいいねがつきました',
    null,
    '/feed'
  );
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_client_on_request_response()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.status = 'pending' and new.status in ('accepted', 'declined') then
    insert into notifications (user_id, type, title, body, link_url)
    values (
      new.client_id,
      'request_response',
      case
        when new.status = 'accepted' then '✅ リクエストが承諾されました'
        else '📮 リクエストへの返信が届きました'
      end,
      new.creator_response,
      '/rewards'
    );
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_creator_on_new_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into notifications (user_id, type, title, body, link_url)
  values (
    new.creator_id,
    'new_request',
    '📩 新しいリクエストが届きました',
    left(new.content, 80),
    '/dashboard/requests'
  );
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_creator_on_new_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into notifications (user_id, type, title, body, link_url)
  values (
    new.creator_id,
    'new_review',
    '⭐ 新しいレビューが届きました',
    '★' || new.rating || case
      when new.comment is not null and length(trim(new.comment)) > 0
        then '　' || left(new.comment, 60)
      else ''
    end,
    '/creator/' || new.creator_id
  );
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_favorites_on_reopen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.status is distinct from new.status
     and new.status = 'available'
     and old.status in ('busy', 'stopped') then
    insert into notifications (user_id, type, title, body, link_url)
    select
      fc.user_id,
      'favorite_creator_available',
      coalesce(new.display_name, 'クリエイター') || 'さんが受付を再開しました',
      null,
      '/creator/' || new.user_id::text
    from favorite_creators fc
    where fc.creator_id = new.user_id;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_referrer_on_new_referral()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into notifications (user_id, type, title, body, link_url)
  values (
    new.referrer_id,
    'referral_signup',
    '🎁 紹介リンクから新しい登録がありました',
    '紹介ボーナスとして' || new.bonus_awarded || 'ptを獲得しました！',
    '/rewards'
  );
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.purchase_ring(p_ring_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_cost integer;
  v_available_from timestamptz;
  v_available_until timestamptz;
  v_balance integer;
begin
  if v_uid is null then
    raise exception 'ログインが必要です';
  end if;

  select cost, available_from, available_until
    into v_cost, v_available_from, v_available_until
    from icon_rings where id = p_ring_id;

  if v_cost is null then
    raise exception '存在しないリングです';
  end if;

  if v_available_from is not null and now() < v_available_from then
    raise exception 'このリングはまだ購入できません';
  end if;

  if v_available_until is not null and now() > v_available_until then
    raise exception 'このリングは購入可能期間を過ぎています';
  end if;

  if exists (select 1 from user_icon_rings where user_id = v_uid and ring_id = p_ring_id) then
    raise exception 'すでに所持しているリングです';
  end if;

  select balance into v_balance from user_points where user_id = v_uid for update;
  v_balance := coalesce(v_balance, 0);

  if v_balance < v_cost then
    raise exception 'ポイントが不足しています';
  end if;

  insert into user_points (user_id, balance) values (v_uid, -v_cost)
    on conflict (user_id) do update set balance = user_points.balance - v_cost;

  insert into user_icon_rings (user_id, ring_id) values (v_uid, p_ring_id);

  insert into point_transactions (user_id, amount, reason)
    values (v_uid, -v_cost, 'purchase_ring:' || p_ring_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_requests_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_is_creator boolean;
  v_is_client boolean;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.creator_response := null;
    return new;
  end if;

  v_is_creator := v_uid is not null and v_uid = old.creator_id;
  v_is_client  := v_uid is not null and v_uid = old.client_id;

  if new.creator_id is distinct from old.creator_id
     or new.client_id is distinct from old.client_id
     or new.content is distinct from old.content
     or new.budget is distinct from old.budget
     or new.client_contact_url is distinct from old.client_contact_url
     or new.image_urls is distinct from old.image_urls
     or new.usage_type is distinct from old.usage_type
     or new.reference_url is distinct from old.reference_url
     or new.size_spec is distinct from old.size_spec
     or new.desired_deadline is distinct from old.desired_deadline
     or new.created_at is distinct from old.created_at then
    raise exception 'リクエストの内容は変更できません';
  end if;

  if new.status is distinct from old.status
     or new.creator_response is distinct from old.creator_response then
    if v_is_creator and new.status in ('accepted', 'declined') and old.status <> 'cancelled' then
      null; -- クリエイターの返信
    elsif v_is_client and new.status = 'cancelled' and old.status = 'pending'
          and new.creator_response is not distinct from old.creator_response then
      null; -- 依頼者の取り下げ
    else
      raise exception 'この操作は許可されていません';
    end if;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.protect_profile_likes_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.likes_count := 0;
    else
      new.likes_count := old.likes_count;
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_profile_likes_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    if new.user_id <> new.creator_id then
      update profiles set likes_count = coalesce(likes_count, 0) + 1
      where user_id = new.creator_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.user_id <> old.creator_id then
      update profiles set likes_count = greatest(coalesce(likes_count, 0) - 1, 0)
      where user_id = old.creator_id;
    end if;
  end if;
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$function$
;

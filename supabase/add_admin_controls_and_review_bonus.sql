-- 1. アイコンリングの公開・購入可能期間
--    available_from / available_until が null の場合は無期限（従来通り）。
--    期間外でも「すでに持っている人」は装着し続けられる（アプリ側でフィルタするのは
--    未所持ユーザー向けのショップ表示のみで、所有権(user_icon_rings)自体には触れないため）。
alter table icon_rings add column if not exists available_from timestamptz;
alter table icon_rings add column if not exists available_until timestamptz;

-- purchase_ring: 期間外の新規購入をサーバー側でも防ぐ（クライアント側の表示制御だけに頼らない）
create or replace function purchase_ring(p_ring_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- 2. 管理者による特定ユーザーへのポイント操作・アイコンリング付与
--    いずれも呼び出し元が admins テーブルに登録されているかをDB側で必ず確認する
--    （クライアント側の管理者判定はUI表示の都合でしかなく、実際の権限チェックはここで行う）。

-- メールアドレスからユーザーを検索する（管理画面の検索用。admin以外は実行不可）
create or replace function admin_find_user_by_email(p_email text)
returns table(user_id uuid, email text, display_name text, avatar_url text, balance integer)
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- 指定ユーザーのポイント残高を増減する（p_amountはマイナスも可）。残高は0未満にはならない。
create or replace function admin_adjust_points(p_user_id uuid, p_amount integer, p_reason text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- 指定ユーザーに、購入させずにアイコンリングの所有権を直接付与する
create or replace function admin_grant_ring(p_user_id uuid, p_ring_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- 3. クリエイターへのレビュー投稿で50pt付与（初回投稿時のみ。編集時は再付与しない）
--    upsert(onConflict: creator_id,reviewer_id) が更新扱いになった場合は
--    AFTER INSERT トリガーが発火しないため、自然に「初回のみ」が保証される。
create or replace function grant_review_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_points (user_id, balance) values (new.reviewer_id, 50)
    on conflict (user_id) do update set balance = user_points.balance + 50;

  insert into point_transactions (user_id, amount, reason)
    values (new.reviewer_id, 50, 'review_posted:' || new.creator_id);

  return new;
end;
$$;

drop trigger if exists trg_grant_review_points on reviews;
create trigger trg_grant_review_points
  after insert on reviews
  for each row
  execute function grant_review_points();

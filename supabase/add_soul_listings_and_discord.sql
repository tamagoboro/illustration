-- 魂募集イラスト ＋ Discord通知
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。
-- 前提: add_follows.sql を先に実行済みであること（フォロー通知のトリガーを creator_follows に付けるため）。
-- 何度実行しても壊れないように、if not exists / create or replace / drop ... if exists で書いている。
--
-- ■ 魂募集（soul_listings）
--   クリエイターが「魂（中の人・演者）」を募集しているキャラクターイラストを掲載する。画像は1枚。
--   応募は既存の「リクエスト」を使い、requests.soul_listing_id でどの募集への応募かを記録する
--   （クリエイターの受信箱・送信制限・通知の仕組みをそのまま使える）。
--
-- ■ Discord通知
--   notifications に行が追加されると、Supabase の Database Webhook で
--   /api/webhooks/discord-notify が呼ばれ、クリエイターが設定した Discord の Webhook に送る。
--   ・discord_webhooks … Webhook URL を「暗号化した状態で」保存する。RLSで誰も読めず、
--     サーバー（service_role）だけが読み書きする。復号の鍵はDBではなくVercelの環境変数にある。
--   ・notification_settings … Discordに送る通知の種類（本人が画面から自由に変えられる）。

-- ============================================================
-- 1. 魂募集
-- ============================================================

create table if not exists public.soul_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,                              -- キャラクター名
  image_url text not null,                          -- イラスト（1枚）
  description text not null default '',             -- 詳細文章
  target_audience text not null default '',         -- どんな人向けか
  prices jsonb not null default '[]'::jsonb,        -- [{ "label": "立ち絵のみ", "price": 30000 }, ...]
  commercial_use text not null default 'allowed',   -- allowed / not_allowed / negotiable
  starts_at date,                                   -- 掲載開始日（空なら即日）
  ends_at date,                                     -- 掲載終了日（空なら無期限）
  is_closed boolean not null default false,         -- 決まった等で手動で募集を締め切った
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint soul_listings_commercial_use_check check (commercial_use in ('allowed', 'not_allowed', 'negotiable')),
  constraint soul_listings_period_check check (starts_at is null or ends_at is null or starts_at <= ends_at),
  constraint soul_listings_title_length check (char_length(title) between 1 and 60),
  constraint soul_listings_prices_is_array check (jsonb_typeof(prices) = 'array')
);

create index if not exists soul_listings_user_idx on public.soul_listings (user_id, sort_order);

alter table public.soul_listings enable row level security;

-- 掲載期間外のものも含めて読めるが、画面側で期間内のものだけを表示する
drop policy if exists "Anyone can view soul listings" on public.soul_listings;
create policy "Anyone can view soul listings" on public.soul_listings
  for select to public using (true);

drop policy if exists "Creators can add their soul listings" on public.soul_listings;
create policy "Creators can add their soul listings" on public.soul_listings
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Creators can update their soul listings" on public.soul_listings;
create policy "Creators can update their soul listings" on public.soul_listings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Creators can delete their soul listings" on public.soul_listings;
create policy "Creators can delete their soul listings" on public.soul_listings
  for delete to authenticated using (user_id = auth.uid());

drop trigger if exists set_soul_listings_updated_at on public.soul_listings;
create trigger set_soul_listings_updated_at
  before update on public.soul_listings
  for each row execute function public.update_updated_at_column();

-- 応募＝どの魂募集へのリクエストか
alter table public.requests
  add column if not exists soul_listing_id uuid references public.soul_listings (id) on delete set null;

-- 既存の guard_requests_write に soul_listing_id を追加（送信後は変更不可、他人の募集には紐付けられない）
create or replace function public.guard_requests_write()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
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
    if new.soul_listing_id is not null and not exists (
      select 1 from soul_listings s where s.id = new.soul_listing_id and s.user_id = new.creator_id
    ) then
      raise exception 'この魂募集には応募できません';
    end if;
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
     or new.soul_listing_id is distinct from old.soul_listing_id
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
$function$;

-- 新着リクエストの通知：魂募集への応募なら別の種類・文面にする
create or replace function public.notify_creator_on_new_request()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_soul_title text;
begin
  if new.soul_listing_id is not null then
    select title into v_soul_title from soul_listings where id = new.soul_listing_id;
    insert into notifications (user_id, type, title, body, link_url)
    values (
      new.creator_id,
      'soul_application',
      '🎭 魂募集「' || coalesce(v_soul_title, 'キャラクター') || '」に応募がありました',
      left(new.content, 80),
      '/dashboard/requests'
    );
  else
    insert into notifications (user_id, type, title, body, link_url)
    values (
      new.creator_id,
      'new_request',
      '📩 新しいリクエストが届きました',
      left(new.content, 80),
      '/dashboard/requests'
    );
  end if;
  return new;
end;
$function$;

-- ============================================================
-- 2. クリエイターへの新しい通知（フォロー・お気に入り）
-- ============================================================

-- 同じ人の付け外しで通知が連発しないよう、同じ相手からの同じ種類の通知は24時間に1回まで
create or replace function public.notify_creator_on_new_follower()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text;
  v_title text;
begin
  select coalesce(nullif(display_name, ''), 'ユーザー') into v_name from profiles where user_id = new.follower_id;
  v_title := '🔔 ' || coalesce(v_name, 'ユーザー') || 'さんにフォローされました';
  if not exists (
    select 1 from notifications
    where user_id = new.creator_id and type = 'new_follower' and title = v_title
      and created_at > now() - interval '24 hours'
  ) then
    insert into notifications (user_id, type, title, body, link_url)
    values (new.creator_id, 'new_follower', v_title, null, '/creator/' || new.creator_id::text);
  end if;
  return new;
end;
$function$;

create or replace function public.notify_creator_on_new_favorite()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text;
  v_title text;
begin
  if new.user_id = new.creator_id then
    return new;
  end if;
  select coalesce(nullif(display_name, ''), 'ユーザー') into v_name from profiles where user_id = new.user_id;
  v_title := '♥ ' || coalesce(v_name, 'ユーザー') || 'さんがお気に入りに追加しました';
  if not exists (
    select 1 from notifications
    where user_id = new.creator_id and type = 'new_favorite' and title = v_title
      and created_at > now() - interval '24 hours'
  ) then
    insert into notifications (user_id, type, title, body, link_url)
    values (new.creator_id, 'new_favorite', v_title, null, '/creator/' || new.creator_id::text);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_notify_creator_on_new_favorite on public.favorite_creators;
create trigger trg_notify_creator_on_new_favorite
  after insert on public.favorite_creators
  for each row execute function public.notify_creator_on_new_favorite();

do $$
begin
  if to_regclass('public.creator_follows') is null then
    raise notice 'creator_follows がありません。先に add_follows.sql を実行してから、このファイルをもう一度実行してください。';
  else
    execute 'drop trigger if exists trg_notify_creator_on_new_follower on public.creator_follows';
    execute 'create trigger trg_notify_creator_on_new_follower after insert on public.creator_follows
             for each row execute function public.notify_creator_on_new_follower()';
  end if;
end;
$$;

-- ============================================================
-- 3. Discord通知
-- ============================================================

-- 暗号化済みのWebhook URL。RLSを有効にしてポリシーを作らない＝ログインユーザーも匿名ユーザーも一切読めない
create table if not exists public.discord_webhooks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  encrypted_url text not null,
  updated_at timestamptz not null default now()
);

alter table public.discord_webhooks enable row level security;
revoke all on public.discord_webhooks from anon, authenticated;

-- 通知の設定（本人だけが読み書きできる）
create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  discord_enabled boolean not null default true,
  -- Discordに送る通知の種類（notifications.type の値）
  discord_types text[] not null default array[
    'new_request', 'soul_application', 'request_response', 'new_review',
    'new_follower', 'new_favorite', 'post_like', 'post_comment',
    'favorite_creator_available', 'follow_new_post', 'follow_campaign',
    'referral_signup', 'portfolio_image_broken'
  ],
  -- 設定済みのWebhookを見分けるための伏せ字表示（例: "…/webhooks/1234…/••••abcd"）。サーバーだけが書き込む
  discord_webhook_hint text,
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

drop policy if exists "Users can view their notification settings" on public.notification_settings;
create policy "Users can view their notification settings" on public.notification_settings
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users can create their notification settings" on public.notification_settings;
create policy "Users can create their notification settings" on public.notification_settings
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users can update their notification settings" on public.notification_settings;
create policy "Users can update their notification settings" on public.notification_settings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 伏せ字（discord_webhook_hint）はサーバー（service_role）だけが書く。
-- 列単位の revoke はテーブル単位の権限があると効かないため、テーブル単位で外してから書いてよい列だけ許可する
revoke all on public.notification_settings from anon;
revoke insert, update on public.notification_settings from authenticated;
grant insert (user_id, discord_enabled, discord_types, updated_at) on public.notification_settings to authenticated;
grant update (discord_enabled, discord_types, updated_at) on public.notification_settings to authenticated;

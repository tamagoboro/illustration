-- 魂募集の詳細項目（納品物・キャラクター設定・Q&A）＋「気になる」ボタン
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。何度実行しても壊れない。
-- 前提: add_soul_listings_and_discord.sql を実行済みであること。
--
-- ・deliverables      … 納品物リスト。["立ち絵（PNG・透過）", "表情差分 ×5", ...]（最大20個）
-- ・character_profile … キャラクター設定表。[{ "label": "身長", "value": "158cm" }, ...]（最大20項目）
-- ・faqs              … よくある質問。[{ "q": "名前は変えられますか？", "a": "変更可能です" }, ...]（最大15個）
-- ・soul_interests    … 「気になる」を押した人。誰が押したかは本人以外に見せず、人数だけを返す

alter table public.soul_listings
  add column if not exists deliverables jsonb not null default '[]'::jsonb,
  add column if not exists character_profile jsonb not null default '[]'::jsonb,
  add column if not exists faqs jsonb not null default '[]'::jsonb;

alter table public.soul_listings drop constraint if exists soul_listings_details_check;
alter table public.soul_listings
  add constraint soul_listings_details_check check (
    jsonb_typeof(deliverables) = 'array' and jsonb_array_length(deliverables) <= 20
    and jsonb_typeof(character_profile) = 'array' and jsonb_array_length(character_profile) <= 20
    and jsonb_typeof(faqs) = 'array' and jsonb_array_length(faqs) <= 15
  );

-- 「気になる」
create table if not exists public.soul_interests (
  user_id uuid not null references auth.users (id) on delete cascade,
  soul_listing_id uuid not null references public.soul_listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, soul_listing_id)
);

create index if not exists soul_interests_listing_idx on public.soul_interests (soul_listing_id);

alter table public.soul_interests enable row level security;

drop policy if exists "Users can view their own soul interests" on public.soul_interests;
create policy "Users can view their own soul interests" on public.soul_interests
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users can add soul interests" on public.soul_interests;
create policy "Users can add soul interests" on public.soul_interests
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users can remove soul interests" on public.soul_interests;
create policy "Users can remove soul interests" on public.soul_interests
  for delete to authenticated using (user_id = auth.uid());

-- 「気になる」の人数（誰が押したかは返さない）
create or replace function public.get_soul_interest_count(p_soul_listing_id uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*)::integer from soul_interests where soul_listing_id = p_soul_listing_id;
$$;

grant execute on function public.get_soul_interest_count(uuid) to anon, authenticated;

-- 「気になる」が押されたらクリエイターに通知（同じ人の付け外しで連発しないよう、同じ相手からは24時間に1回まで）
create or replace function public.notify_creator_on_soul_interest()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_creator uuid;
  v_title text;
  v_name text;
  v_notification_title text;
begin
  select user_id, title into v_creator, v_title from soul_listings where id = new.soul_listing_id;
  if v_creator is null or v_creator = new.user_id then
    return new;
  end if;
  select coalesce(nullif(display_name, ''), 'ユーザー') into v_name from profiles where user_id = new.user_id;
  v_notification_title := '🎭 ' || coalesce(v_name, 'ユーザー') || 'さんが「' || coalesce(v_title, '魂募集') || '」を気になるに追加しました';
  if not exists (
    select 1 from notifications
    where user_id = v_creator and type = 'soul_interest' and title = v_notification_title
      and created_at > now() - interval '24 hours'
  ) then
    insert into notifications (user_id, type, title, body, link_url)
    values (v_creator, 'soul_interest', v_notification_title, null,
            '/creator/' || v_creator::text || '/souls/' || new.soul_listing_id::text);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_notify_creator_on_soul_interest on public.soul_interests;
create trigger trg_notify_creator_on_soul_interest
  after insert on public.soul_interests
  for each row execute function public.notify_creator_on_soul_interest();

-- Discord通知の初期設定に「気になる」を追加（すでに設定を保存している人には、通知設定画面のスイッチで選んでもらう）
alter table public.notification_settings
  alter column discord_types set default array[
    'new_request', 'soul_application', 'soul_interest', 'request_response', 'new_review',
    'new_follower', 'new_favorite', 'post_like', 'post_comment',
    'favorite_creator_available', 'follow_new_post', 'follow_campaign',
    'referral_signup', 'portfolio_image_broken'
  ];

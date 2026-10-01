-- 募集ボード（依頼者が「こういうクリエイターを募集しています」と出し、クリエイターが応募する）
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。
-- 何度実行しても壊れないように、if not exists / create or replace / drop ... if exists で書いている。
-- ※ supabase/improve_feed.sql を先に実行しておくこと（ブロックの user_blocks を参照するため）。
--
-- ■ 仕組み
--   wanted_posts        … 募集（タイトル・内容・予算・希望納期・募集の締切・ジャンル）。誰でも読める。
--   wanted_applications … 募集への応募（メッセージ・希望金額）。
--                         読めるのは「応募した本人」と「その募集を出した人」だけ。ほかの人からは見えない
--                         （Xのリプライと違って、誰が応募したかが周りに見えないようにするため）。
--   応募の件数だけは、wanted_application_counts() で誰でも分かる（募集が動いていることを見せるため）。
--
-- ■ ルール（DBのトリガーで守る。エラー P0001 のメッセージは画面にそのまま表示する）
--   ・募集を同時に出せるのは1人3件まで
--   ・応募できるのはクリエイター（ダッシュボードを設定済みの人）だけ。自分の募集には応募できない
--   ・締め切った募集、募集の締切日を過ぎた募集には応募できない
--   ・募集を出した人にブロックされている人は応募できない
--   ・応募があると、募集を出した人に通知が届く


-- ============================================================
-- 1. テーブル
-- ============================================================

create table if not exists public.wanted_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  tastes text[] not null default '{}'::text[],
  budget_min integer,
  budget_max integer,
  desired_deadline date,            -- 希望納期（未定なら null）
  apply_until date,                 -- 募集の締切（決めていなければ null）
  commercial_use boolean not null default false,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wanted_posts_title_length check (char_length(title) between 1 and 60),
  constraint wanted_posts_description_length check (char_length(description) <= 1000),
  constraint wanted_posts_status_check check (status in ('open', 'closed')),
  constraint wanted_posts_budget_check check (
    (budget_min is null or budget_min >= 0)
    and (budget_max is null or budget_max >= 0)
    and (budget_min is null or budget_max is null or budget_min <= budget_max)
  ),
  constraint wanted_posts_tastes_count check (coalesce(array_length(tastes, 1), 0) <= 8)
);

create index if not exists wanted_posts_status_created_idx on public.wanted_posts (status, created_at desc);
create index if not exists wanted_posts_user_idx on public.wanted_posts (user_id);

create table if not exists public.wanted_applications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.wanted_posts (id) on delete cascade,
  creator_id uuid not null references auth.users (id) on delete cascade,
  message text not null,
  proposed_price integer,
  created_at timestamptz not null default now(),
  constraint wanted_applications_unique unique (post_id, creator_id),
  constraint wanted_applications_message_length check (char_length(message) between 1 and 1000),
  constraint wanted_applications_price_check check (proposed_price is null or proposed_price >= 0)
);

create index if not exists wanted_applications_post_idx on public.wanted_applications (post_id, created_at desc);
create index if not exists wanted_applications_creator_idx on public.wanted_applications (creator_id);

drop trigger if exists set_wanted_posts_updated_at on public.wanted_posts;
create trigger set_wanted_posts_updated_at
  before update on public.wanted_posts
  for each row execute function public.update_updated_at_column();


-- ============================================================
-- 2. 読み書きの権限（RLS）
-- ============================================================

alter table public.wanted_posts enable row level security;
alter table public.wanted_applications enable row level security;

drop policy if exists "Anyone can view wanted posts" on public.wanted_posts;
create policy "Anyone can view wanted posts" on public.wanted_posts
  for select to public using (true);

drop policy if exists "Users can create wanted posts" on public.wanted_posts;
create policy "Users can create wanted posts" on public.wanted_posts
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users can update their wanted posts" on public.wanted_posts;
create policy "Users can update their wanted posts" on public.wanted_posts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 削除できるのは本人と管理者
drop policy if exists "Users and admins can delete wanted posts" on public.wanted_posts;
create policy "Users and admins can delete wanted posts" on public.wanted_posts
  for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- 応募は、応募した本人と、その募集を出した人だけが読める
drop policy if exists "Applicants and owners can view applications" on public.wanted_applications;
create policy "Applicants and owners can view applications" on public.wanted_applications
  for select to authenticated
  using (
    creator_id = auth.uid()
    or exists (
      select 1 from public.wanted_posts p
      where p.id = wanted_applications.post_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "Creators can apply" on public.wanted_applications;
create policy "Creators can apply" on public.wanted_applications
  for insert to authenticated with check (creator_id = auth.uid());

-- 応募の取り下げ
drop policy if exists "Applicants can withdraw" on public.wanted_applications;
create policy "Applicants can withdraw" on public.wanted_applications
  for delete to authenticated using (creator_id = auth.uid());


-- ============================================================
-- 3. ルール（トリガー）
-- ============================================================

-- 募集を同時に出せるのは1人3件まで（締め切った募集は数えない）
create or replace function public.enforce_wanted_post_limits()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (select count(*) from wanted_posts where user_id = new.user_id and status = 'open') >= 3 then
    raise exception '同時に出せる募集は3件までです。先に、終わった募集を締め切ってください。';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_enforce_wanted_post_limits on public.wanted_posts;
create trigger trg_enforce_wanted_post_limits
  before insert on public.wanted_posts
  for each row execute function public.enforce_wanted_post_limits();

-- 応募できるかどうかの確認
create or replace function public.enforce_wanted_application_rules()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_post wanted_posts%rowtype;
begin
  select * into v_post from wanted_posts where id = new.post_id;
  if not found then
    raise exception '募集が見つかりません';
  end if;
  if v_post.user_id = new.creator_id then
    raise exception '自分の募集には応募できません';
  end if;
  if v_post.status <> 'open' then
    raise exception 'この募集は締め切られています';
  end if;
  -- 締切日は日本時間で判定する（締切日の当日いっぱいまで応募できる）
  if v_post.apply_until is not null and v_post.apply_until < (now() at time zone 'Asia/Tokyo')::date then
    raise exception 'この募集は締切日を過ぎています';
  end if;
  if not exists (select 1 from profiles p where p.user_id = new.creator_id and p.has_dashboard_setup = true) then
    raise exception '応募するには、クリエイターとしてポートフォリオを登録してください';
  end if;
  if exists (
    select 1 from user_blocks b
    where b.user_id = v_post.user_id and b.target_id = new.creator_id and b.kind = 'block'
  ) then
    raise exception 'この募集には応募できません';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_enforce_wanted_application_rules on public.wanted_applications;
create trigger trg_enforce_wanted_application_rules
  before insert on public.wanted_applications
  for each row execute function public.enforce_wanted_application_rules();

-- 応募があったら、募集を出した人に通知する
create or replace function public.notify_owner_on_wanted_application()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_owner uuid;
  v_title text;
  v_name text;
begin
  select user_id, title into v_owner, v_title from wanted_posts where id = new.post_id;
  if v_owner is null then
    return new;
  end if;

  select coalesce(nullif(display_name, ''), 'クリエイター') into v_name
  from profiles where user_id = new.creator_id;

  insert into notifications (user_id, type, title, body, link_url)
  values (
    v_owner,
    'wanted_application',
    '🙋 募集に応募が届きました',
    coalesce(v_name, 'クリエイター') || 'さんが「' || left(v_title, 30) || '」に応募しました',
    '/wanted/' || new.post_id::text
  );
  return new;
end;
$function$;

drop trigger if exists trg_notify_owner_on_wanted_application on public.wanted_applications;
create trigger trg_notify_owner_on_wanted_application
  after insert on public.wanted_applications
  for each row execute function public.notify_owner_on_wanted_application();


-- ============================================================
-- 4. 応募の件数（件数だけ。誰が応募したかは返さない）
-- ============================================================
create or replace function public.wanted_application_counts(p_post_ids uuid[])
returns table (post_id uuid, application_count integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.post_id, count(*)::integer
  from wanted_applications a
  where a.post_id = any (p_post_ids)
  group by a.post_id;
$$;

grant execute on function public.wanted_application_counts(uuid[]) to anon, authenticated;


-- ============================================================
-- 5. 募集を通報できるようにする（reports.target_type に 'wanted_post' を追加）
-- ============================================================
-- target_id に募集のID、creator_id に募集を出した人を入れる。
-- target_type に値を限定する制約が付いている場合だけ、新しい値を含む形に付け直す
-- （improve_feed.sql と同じやり方。制約が無ければ何もしない）。
do $$
declare
  c record;
  v_found boolean := false;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.reports'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%target_type%'
  loop
    execute format('alter table public.reports drop constraint %I', c.conname);
    v_found := true;
  end loop;

  if v_found then
    alter table public.reports
      add constraint reports_target_type_check
      check (target_type in ('profile', 'portfolio_item', 'post', 'post_comment', 'wanted_post'));
  end if;
end $$;

create or replace function public.notify_admins_on_new_report()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into notifications (user_id, type, title, body, link_url)
  select
    a.user_id,
    'new_report',
    '🚨 新しい通報がありました',
    case
      when new.target_type = 'profile' then 'プロフィール全体 / ' || new.reason
      when new.target_type = 'post' then 'フィード投稿 / ' || new.reason
      when new.target_type = 'post_comment' then 'コメント / ' || new.reason
      when new.target_type = 'wanted_post' then '募集 / ' || new.reason
      else '作品 / ' || new.reason
    end,
    '/admin/reports'
  from admins a;
  return new;
end;
$function$;

notify pgrst, 'reload schema';

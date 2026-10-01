-- フィードの改善（投稿の個別ページ /feed/<投稿ID> の追加に合わせたDB側の変更）
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。
-- 何度実行しても壊れないように、if not exists / create or replace / drop ... if exists で書いている
-- （途中まで適用済みの状態から、もう一度全体を実行してよい）。
--
-- 1. ブロック・ミュート（user_blocks）
-- 2. 通知のリンク先を、フィードの一覧（/feed）から該当の投稿（/feed/<投稿ID>）に変える
--      いいね・コメント・フォロー中クリエイターの新規投稿。
--      ブロック・ミュートしている相手からのいいね・コメントは通知しない
-- 3. 投稿・コメントは500文字まで
-- 4. フィードの投稿・コメントを通報できるようにする（reports.target_type に 'post' / 'post_comment' を追加）
-- 5. 管理者が投稿・コメントを削除できるようにする（admin_remove_post / admin_remove_post_comment）
-- 6. ブロックした相手からのコメント・いいね・フォローを止める


-- ============================================================
-- 1. ブロック・ミュート
-- ============================================================
-- user_blocks … 誰が（user_id）誰を（target_id）ブロック／ミュートしているか。相手1人につき1行。
--   mute  … 相手の投稿・コメントを自分の画面に出さない。相手からのいいね・コメントの通知も来ない。相手には伝わらない
--   block … ミュートに加えて、相手は自分の投稿にコメント・いいねできず、自分をフォローできない（6. で止める）
-- 一覧は本人しか読めない（誰が誰をブロックしているかは公開しない）。
create table if not exists public.user_blocks (
  user_id uuid not null references auth.users (id) on delete cascade,
  target_id uuid not null,
  kind text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_id),
  constraint user_blocks_kind_check check (kind in ('block', 'mute')),
  constraint user_blocks_not_self check (user_id <> target_id)
);

create index if not exists user_blocks_target_idx on public.user_blocks (target_id);

alter table public.user_blocks enable row level security;

drop policy if exists "Users can view their own blocks" on public.user_blocks;
create policy "Users can view their own blocks" on public.user_blocks
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users can add blocks" on public.user_blocks;
create policy "Users can add blocks" on public.user_blocks
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users can change their blocks" on public.user_blocks;
create policy "Users can change their blocks" on public.user_blocks
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Users can remove their blocks" on public.user_blocks;
create policy "Users can remove their blocks" on public.user_blocks
  for delete to authenticated using (user_id = auth.uid());


-- ============================================================
-- 2. 通知のリンク先を該当の投稿にする（ブロック・ミュート中の相手からの分は通知しない）
-- ============================================================

create or replace function public.notify_author_on_post_comment()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_author uuid;
begin
  select user_id into v_author from posts where id = new.post_id;

  if v_author is null or v_author = new.user_id then
    return new;
  end if;

  if exists (select 1 from user_blocks b where b.user_id = v_author and b.target_id = new.user_id) then
    return new;
  end if;

  insert into notifications (user_id, type, title, body, link_url)
  values (
    v_author,
    'post_comment',
    '💬 投稿にコメントが届きました',
    left(new.content, 60),
    '/feed/' || new.post_id::text
  );
  return new;
end;
$function$;

create or replace function public.notify_author_on_post_like()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_author uuid;
begin
  select user_id into v_author from posts where id = new.post_id;

  if v_author is null or v_author = new.user_id then
    return new;
  end if;

  if exists (select 1 from user_blocks b where b.user_id = v_author and b.target_id = new.user_id) then
    return new;
  end if;

  insert into notifications (user_id, type, title, body, link_url)
  values (
    v_author,
    'post_like',
    '❤️ 投稿にいいねがつきました',
    null,
    '/feed/' || new.post_id::text
  );
  return new;
end;
$function$;

-- フィードへの新規投稿（同じクリエイターの投稿通知は3時間に1回まで、は add_follows.sql のまま）
create or replace function public.notify_followers_on_new_post()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text;
  v_body text;
begin
  select coalesce(nullif(display_name, ''), 'クリエイター') into v_name
  from profiles where user_id = new.user_id;

  v_body := case
    when coalesce(trim(new.content), '') = '' then '画像を投稿しました'
    when char_length(new.content) > 60 then left(new.content, 60) || '…'
    else new.content
  end;

  insert into notifications (user_id, type, title, body, link_url)
  select
    f.follower_id,
    'follow_new_post',
    coalesce(v_name, 'クリエイター') || 'さんがフィードに投稿しました',
    v_body,
    '/feed/' || new.id::text
  from creator_follows f
  where f.creator_id = new.user_id
    and not exists (
      select 1 from notifications n
      where n.user_id = f.follower_id
        and n.type = 'follow_new_post'
        and n.title = coalesce(v_name, 'クリエイター') || 'さんがフィードに投稿しました'
        and n.created_at > now() - interval '3 hours'
    );
  return new;
end;
$function$;


-- ============================================================
-- 3. 投稿・コメントは500文字まで
-- ============================================================
-- 画面側（app/feed/FeedClient.tsx）でも止めているが、APIを直接叩かれても守られるようにDBでも制限する。
-- not valid: すでにある長い行はそのまま残し、これから書き込まれる分だけを対象にする。

-- 投稿の列に500文字より短い上限（varchar(200) など）が付いている場合は、500文字まで入るように広げる
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'posts' and column_name = 'content'
      and character_maximum_length is not null and character_maximum_length < 500
  ) then
    alter table public.posts alter column content type varchar(500);
  end if;
end $$;

alter table public.posts drop constraint if exists posts_content_length;
alter table public.posts
  add constraint posts_content_length check (char_length(content) <= 500) not valid;

alter table public.post_comments drop constraint if exists post_comments_content_length;
alter table public.post_comments
  add constraint post_comments_content_length check (char_length(content) <= 500) not valid;


-- ============================================================
-- 4. フィードの投稿・コメントを通報できるようにする
-- ============================================================
-- reports.target_type: 'profile'（プロフィール全体）/ 'portfolio_item'（作品）に、
--   'post'（フィードの投稿）と 'post_comment'（投稿へのコメント）を追加。
-- target_id に投稿ID／コメントID、creator_id に投稿者／コメントした人を入れる。
-- target_type に値を限定する制約が付いている場合だけ、新しい値を含む形に付け直す
-- （制約が無ければ、そのままで保存できるので何もしない）。
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
      -- 'wanted_post'（募集ボードの募集）は add_wanted_board.sql の分。このファイルをあとから再実行しても
      -- 募集の通報が使えなくならないよう、ここにも入れておく
      check (target_type in ('profile', 'portfolio_item', 'post', 'post_comment', 'wanted_post'));
  end if;
end $$;

-- 管理者への通知文に「フィード投稿」「コメント」を追加
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


-- ============================================================
-- 5. 管理者が投稿・コメントを削除する
-- ============================================================
-- どちらも、操作は admin_audit_log に記録し、p_notify が true なら書いた本人に理由つきで通知する
-- （add_admin_image_moderation.sql の作品削除と同じ作り）。
-- 削除した対象への未対応の通報は「対応済み」にする。

-- 投稿と、そのいいね・コメントを削除する。削除した画像URLの配列を返す（呼び出し側がストレージからファイルを消す）。
create or replace function public.admin_remove_post(p_post_id uuid, p_reason text, p_notify boolean default true)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post posts%rowtype;
begin
  if not exists (select 1 from admins where admins.user_id = auth.uid()) then
    raise exception '管理者のみ実行できます';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception '理由を入力してください';
  end if;

  select * into v_post from posts where id = p_post_id;
  if not found then
    raise exception '投稿が見つかりません';
  end if;

  -- 投稿と一緒に消えるコメントへの通報も「対応済み」にする
  update reports set status = 'reviewed'
  where status = 'open'
    and (
      (target_type = 'post' and target_id = p_post_id::text)
      or (target_type = 'post_comment'
          and target_id in (select id::text from post_comments where post_id = p_post_id))
    );

  delete from post_likes where post_id = p_post_id;
  delete from post_comments where post_id = p_post_id;
  delete from posts where id = p_post_id;

  insert into admin_audit_log (admin_id, action, target_type, target_id, target_user_id, detail)
  values (auth.uid(), 'remove_post', 'post', p_post_id::text, v_post.user_id,
          jsonb_build_object('content', v_post.content, 'image_urls', to_jsonb(coalesce(v_post.image_urls, '{}'::text[])),
                             'reason', trim(p_reason), 'notified', coalesce(p_notify, true)));

  if coalesce(p_notify, true) then
    insert into notifications (user_id, type, title, body, link_url)
    values (v_post.user_id, 'image_moderated', '🛡️ フィードの投稿が管理者により削除されました',
            '理由: ' || trim(p_reason), '/feed');
  end if;

  return coalesce(v_post.image_urls, '{}'::text[]);
end;
$$;

-- コメントを1件削除する。
create or replace function public.admin_remove_post_comment(p_comment_id uuid, p_reason text, p_notify boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment post_comments%rowtype;
begin
  if not exists (select 1 from admins where admins.user_id = auth.uid()) then
    raise exception '管理者のみ実行できます';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception '理由を入力してください';
  end if;

  select * into v_comment from post_comments where id = p_comment_id;
  if not found then
    raise exception 'コメントが見つかりません';
  end if;

  delete from post_comments where id = p_comment_id;

  update reports set status = 'reviewed'
  where target_type = 'post_comment' and target_id = p_comment_id::text and status = 'open';

  insert into admin_audit_log (admin_id, action, target_type, target_id, target_user_id, detail)
  values (auth.uid(), 'remove_post_comment', 'post_comment', p_comment_id::text, v_comment.user_id,
          jsonb_build_object('content', v_comment.content, 'post_id', v_comment.post_id,
                             'reason', trim(p_reason), 'notified', coalesce(p_notify, true)));

  if coalesce(p_notify, true) then
    insert into notifications (user_id, type, title, body, link_url)
    values (v_comment.user_id, 'image_moderated', '🛡️ コメントが管理者により削除されました',
            '理由: ' || trim(p_reason), '/feed/' || v_comment.post_id::text);
  end if;
end;
$$;

revoke execute on function public.admin_remove_post(uuid, text, boolean) from public, anon;
revoke execute on function public.admin_remove_post_comment(uuid, text, boolean) from public, anon;
grant execute on function public.admin_remove_post(uuid, text, boolean) to authenticated;
grant execute on function public.admin_remove_post_comment(uuid, text, boolean) to authenticated;


-- ============================================================
-- 6. ブロックした相手からのコメント・いいね・フォローを止める
-- ============================================================
-- user_blocks は本人しか読めないので、相手側の操作の可否は security definer のトリガーで判定する。
-- エラー（P0001）のメッセージは、画面でそのまま表示する。

-- コメント・いいね：投稿者にブロックされている人は書き込めない
create or replace function public.enforce_user_blocks_on_post_reaction()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_author uuid;
begin
  select user_id into v_author from posts where id = new.post_id;

  if v_author is not null and exists (
    select 1 from user_blocks b
    where b.user_id = v_author and b.target_id = new.user_id and b.kind = 'block'
  ) then
    raise exception 'この投稿にはコメント・いいねができません';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_enforce_user_blocks_on_post_comment on public.post_comments;
create trigger trg_enforce_user_blocks_on_post_comment
  before insert on public.post_comments
  for each row execute function public.enforce_user_blocks_on_post_reaction();

drop trigger if exists trg_enforce_user_blocks_on_post_like on public.post_likes;
create trigger trg_enforce_user_blocks_on_post_like
  before insert on public.post_likes
  for each row execute function public.enforce_user_blocks_on_post_reaction();

-- フォロー：相手にブロックされている人はフォローできない
create or replace function public.enforce_user_blocks_on_follow()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if exists (
    select 1 from user_blocks b
    where b.user_id = new.creator_id and b.target_id = new.follower_id and b.kind = 'block'
  ) then
    raise exception 'このユーザーはフォローできません';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_enforce_user_blocks_on_follow on public.creator_follows;
create trigger trg_enforce_user_blocks_on_follow
  before insert on public.creator_follows
  for each row execute function public.enforce_user_blocks_on_follow();

-- ブロックした時点で、お互いのフォローを外す（相手に自分の新着が通知されないように／自分にも相手の新着が来ないように）
create or replace function public.apply_user_block()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.kind = 'block' then
    delete from creator_follows
    where (follower_id = new.target_id and creator_id = new.user_id)
       or (follower_id = new.user_id and creator_id = new.target_id);
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_apply_user_block on public.user_blocks;
create trigger trg_apply_user_block
  after insert or update of kind on public.user_blocks
  for each row execute function public.apply_user_block();

notify pgrst, 'reload schema';

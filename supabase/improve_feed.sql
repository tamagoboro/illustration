-- フィードの改善（投稿の個別ページ /feed/<投稿ID> の追加に合わせたDB側の変更）
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。
-- 何度実行しても壊れないように、create or replace / drop ... if exists で書いている。
--
-- 1. 通知のリンク先を、フィードの一覧（/feed）から該当の投稿（/feed/<投稿ID>）に変える
--      いいね・コメント・フォロー中クリエイターの新規投稿
-- 2. コメントは500文字まで
-- 3. フィードの投稿を通報できるようにする（reports.target_type に 'post' を追加）
-- 4. 管理者が投稿を削除できるようにする（admin_remove_post）


-- ============================================================
-- 1. 通知のリンク先を該当の投稿にする
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
-- 2. コメントは500文字まで
-- ============================================================
-- 画面側（app/feed/FeedClient.tsx）でも止めているが、APIを直接叩かれても守られるようにDBでも制限する。
-- not valid: すでにある長いコメントはそのまま残し、これから書き込まれる分だけを対象にする。
alter table public.post_comments drop constraint if exists post_comments_content_length;
alter table public.post_comments
  add constraint post_comments_content_length check (char_length(content) <= 500) not valid;


-- ============================================================
-- 3. フィードの投稿を通報できるようにする
-- ============================================================
-- reports.target_type: 'profile'（プロフィール全体）/ 'portfolio_item'（作品）に 'post'（フィードの投稿）を追加。
-- target_id に投稿ID、creator_id に投稿者を入れる。
-- target_type に値を限定する制約が付いている場合だけ、'post' を含む形に付け直す
-- （制約が無ければ、そのままで 'post' を保存できるので何もしない）。
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
      add constraint reports_target_type_check check (target_type in ('profile', 'portfolio_item', 'post'));
  end if;
end $$;

-- 管理者への通知文に「フィード投稿」を追加
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
      else '作品 / ' || new.reason
    end,
    '/admin/reports'
  from admins a;
  return new;
end;
$function$;


-- ============================================================
-- 4. 管理者が投稿を削除する
-- ============================================================
-- 投稿と、そのいいね・コメントを削除する。削除した画像URLの配列を返す（呼び出し側がストレージからファイルを消す）。
-- 操作は admin_audit_log に記録し、p_notify が true なら投稿者に理由つきで通知する
-- （add_admin_image_moderation.sql の作品削除と同じ作り）。
-- その投稿への未対応の通報は「対応済み」にする。
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

  delete from post_likes where post_id = p_post_id;
  delete from post_comments where post_id = p_post_id;
  delete from posts where id = p_post_id;

  update reports set status = 'reviewed'
  where target_type = 'post' and target_id = p_post_id::text and status = 'open';

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

revoke execute on function public.admin_remove_post(uuid, text, boolean) from public, anon;
grant execute on function public.admin_remove_post(uuid, text, boolean) to authenticated;

notify pgrst, 'reload schema';

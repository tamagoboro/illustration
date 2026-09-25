-- 管理者がクリエイターの画像（作品・アイコン）を削除・差し替えできるようにする。
--
-- 構成:
--   ・管理者用RPC（すべて admins テーブルで管理者確認）
--       admin_remove_portfolio_item   作品を1件削除する
--       admin_replace_portfolio_image 作品の画像 / ビフォー画像を差し替える（ビフォー画像は null で外す）
--       admin_replace_avatar          アイコンを差し替える（null で外す）
--   ・操作の記録（admin_audit_log）と、クリエイターへの通知（理由つき。通知するかは管理者の任意）
--   ・moderated_images: 「この画像URLは削除/差し替え済み」の記録。
--       クリエイターのダッシュボードは、作品を「全削除→入れ直し」で保存する作りのため、
--       管理者が消した画像が、古い画面からの保存で復活してしまう。これをトリガーで防ぐ。
--   ・ストレージ（portfolios バケット）に管理者だけが他人のファイルを削除・アップロードできる権限
--
-- 画像ファイルの削除・アップロード自体は、管理画面（/admin/images）からストレージAPIで行う。
-- 差し替え先のURLは、自サイトのストレージ、または同梱のプレースホルダー画像に限定している。


-- ============================================================
-- テーブル
-- ============================================================
create table if not exists public.moderated_images (
  image_url text primary key,
  replacement_url text,               -- null = 削除（作品は行ごと登録しない／アイコン・ビフォー画像は空にする）
  reason text,
  moderated_by uuid,
  created_at timestamptz not null default now()
);
alter table public.moderated_images enable row level security;
-- ポリシーは作らない: APIから直接は読み書きできず、security definer の関数とトリガーだけが触る

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  action text not null,
  target_type text not null,
  target_id text,
  target_user_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;

drop policy if exists "admins can view audit log" on public.admin_audit_log;
create policy "admins can view audit log"
  on public.admin_audit_log as permissive for select to authenticated
  using (exists (select 1 from public.admins where admins.user_id = auth.uid()));
-- INSERTのポリシーは作らない（下のRPCだけが記録する）

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);


-- ============================================================
-- 管理者用RPC
-- ============================================================

-- どの操作も p_notify（クリエイターへ通知するか）を持つ。通知するかは管理者の任意で、
-- 通知しない場合も、理由と「通知なし」の旨は操作履歴（admin_audit_log）に残る。
-- 引数を増やしたため、以前の版（p_notify なし）が残っていると別の関数として共存してしまうので先に消す。
drop function if exists public.admin_remove_portfolio_item(uuid, text);
drop function if exists public.admin_replace_portfolio_image(uuid, text, text, text);
drop function if exists public.admin_replace_avatar(uuid, text, text);

-- 作品を1件削除する。削除した画像URLの配列を返す（呼び出し側がストレージからファイルを消す）。
create or replace function public.admin_remove_portfolio_item(p_item_id uuid, p_reason text, p_notify boolean default true)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item portfolio_items%rowtype;
begin
  if not exists (select 1 from admins where admins.user_id = auth.uid()) then
    raise exception '管理者のみ実行できます';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception '理由を入力してください';
  end if;

  select * into v_item from portfolio_items where id = p_item_id;
  if not found then
    raise exception '作品が見つかりません';
  end if;

  insert into moderated_images (image_url, replacement_url, reason, moderated_by)
  values (v_item.image_url, null, trim(p_reason), auth.uid())
  on conflict (image_url) do update
    set replacement_url = null, reason = excluded.reason, moderated_by = excluded.moderated_by;

  if v_item.before_image_url is not null then
    insert into moderated_images (image_url, replacement_url, reason, moderated_by)
    values (v_item.before_image_url, null, trim(p_reason), auth.uid())
    on conflict (image_url) do update
      set replacement_url = null, reason = excluded.reason, moderated_by = excluded.moderated_by;
  end if;

  delete from portfolio_items where id = p_item_id;

  insert into admin_audit_log (admin_id, action, target_type, target_id, target_user_id, detail)
  values (auth.uid(), 'remove_portfolio_item', 'portfolio_item', p_item_id::text, v_item.user_id,
          jsonb_build_object('image_url', v_item.image_url, 'before_image_url', v_item.before_image_url,
                             'title', v_item.title, 'reason', trim(p_reason), 'notified', coalesce(p_notify, true)));

  if coalesce(p_notify, true) then
    insert into notifications (user_id, type, title, body, link_url)
    values (v_item.user_id, 'image_moderated', '🛡️ 作品が管理者により削除されました',
            '理由: ' || trim(p_reason), '/dashboard');
  end if;

  return array_remove(array[v_item.image_url, v_item.before_image_url], null);
end;
$$;

-- 作品の画像を差し替える。
--   p_field = 'image'  : 作品画像。p_new_url が必須
--   p_field = 'before' : ビフォー画像。p_new_url が null なら画像を外す
-- 差し替え前のURLを返す（呼び出し側がストレージからファイルを消す）。
create or replace function public.admin_replace_portfolio_image(
  p_item_id uuid, p_field text, p_new_url text, p_reason text, p_notify boolean default true
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item portfolio_items%rowtype;
  v_old text;
begin
  if not exists (select 1 from admins where admins.user_id = auth.uid()) then
    raise exception '管理者のみ実行できます';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception '理由を入力してください';
  end if;
  if p_field not in ('image', 'before') then
    raise exception 'p_field は image か before を指定してください';
  end if;
  if p_field = 'image' and p_new_url is null then
    raise exception '作品画像の差し替え先URLが必要です';
  end if;
  if p_new_url is not null
     and p_new_url !~ '^https://[^ ]+/storage/v1/object/public/portfolios/[^ ]+$'
     and p_new_url <> '/moderated-placeholder.svg' then
    raise exception '差し替え先のURLが不正です';
  end if;

  select * into v_item from portfolio_items where id = p_item_id;
  if not found then
    raise exception '作品が見つかりません';
  end if;

  v_old := case when p_field = 'image' then v_item.image_url else v_item.before_image_url end;
  if v_old is null then
    raise exception '差し替える画像がありません';
  end if;

  insert into moderated_images (image_url, replacement_url, reason, moderated_by)
  values (v_old, p_new_url, trim(p_reason), auth.uid())
  on conflict (image_url) do update
    set replacement_url = excluded.replacement_url, reason = excluded.reason, moderated_by = excluded.moderated_by;

  if p_field = 'image' then
    update portfolio_items set image_url = p_new_url where id = p_item_id;
  else
    update portfolio_items set before_image_url = p_new_url where id = p_item_id;
  end if;

  insert into admin_audit_log (admin_id, action, target_type, target_id, target_user_id, detail)
  values (auth.uid(),
          case when p_new_url is null then 'remove_before_image' else 'replace_portfolio_image' end,
          'portfolio_item', p_item_id::text, v_item.user_id,
          jsonb_build_object('field', p_field, 'old_url', v_old, 'new_url', p_new_url, 'reason', trim(p_reason),
                             'notified', coalesce(p_notify, true)));

  if coalesce(p_notify, true) then
    insert into notifications (user_id, type, title, body, link_url)
    values (v_item.user_id, 'image_moderated',
            case when p_new_url is null then '🛡️ 作品の画像が管理者により削除されました'
                 else '🛡️ 作品の画像が管理者により差し替えられました' end,
            '理由: ' || trim(p_reason), '/dashboard');
  end if;

  return v_old;
end;
$$;

-- アイコンを差し替える（p_new_url が null なら外す）。差し替え前のURLを返す。
create or replace function public.admin_replace_avatar(p_user_id uuid, p_new_url text, p_reason text, p_notify boolean default true)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
begin
  if not exists (select 1 from admins where admins.user_id = auth.uid()) then
    raise exception '管理者のみ実行できます';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception '理由を入力してください';
  end if;
  if p_new_url is not null
     and p_new_url !~ '^https://[^ ]+/storage/v1/object/public/portfolios/[^ ]+$' then
    raise exception '差し替え先のURLが不正です';
  end if;

  select avatar_url into v_old from profiles where user_id = p_user_id;
  if not found then
    raise exception 'ユーザーが見つかりません';
  end if;
  if v_old is null then
    raise exception 'アイコンが設定されていません';
  end if;

  insert into moderated_images (image_url, replacement_url, reason, moderated_by)
  values (v_old, p_new_url, trim(p_reason), auth.uid())
  on conflict (image_url) do update
    set replacement_url = excluded.replacement_url, reason = excluded.reason, moderated_by = excluded.moderated_by;

  update profiles set avatar_url = p_new_url where user_id = p_user_id;

  insert into admin_audit_log (admin_id, action, target_type, target_id, target_user_id, detail)
  values (auth.uid(),
          case when p_new_url is null then 'remove_avatar' else 'replace_avatar' end,
          'profile', p_user_id::text, p_user_id,
          jsonb_build_object('old_url', v_old, 'new_url', p_new_url, 'reason', trim(p_reason),
                             'notified', coalesce(p_notify, true)));

  if coalesce(p_notify, true) then
    insert into notifications (user_id, type, title, body, link_url)
    values (p_user_id, 'image_moderated',
            case when p_new_url is null then '🛡️ アイコンが管理者により削除されました'
                 else '🛡️ アイコンが管理者により差し替えられました' end,
            '理由: ' || trim(p_reason), '/dashboard');
  end if;

  return v_old;
end;
$$;

revoke execute on function public.admin_remove_portfolio_item(uuid, text, boolean) from public, anon;
revoke execute on function public.admin_replace_portfolio_image(uuid, text, text, text, boolean) from public, anon;
revoke execute on function public.admin_replace_avatar(uuid, text, text, boolean) from public, anon;
grant execute on function public.admin_remove_portfolio_item(uuid, text, boolean) to authenticated;
grant execute on function public.admin_replace_portfolio_image(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.admin_replace_avatar(uuid, text, text, boolean) to authenticated;


-- ============================================================
-- 消した画像の復活を防ぐトリガー
-- ============================================================
-- 作品: ダッシュボードの保存は「全削除→入れ直し」なので、INSERT時に moderated_images と照合する。
--   ・削除済みの作品画像 → 行ごと登録しない（return null）
--   ・差し替え済みの作品画像 → 差し替え先のURLに置き換える
--   ・ビフォー画像 → 差し替え先に置き換える／削除済みなら空にする
-- ここで return null しても、クリエイター側の保存は成功扱いになる（エラーにすると、
-- 先に全削除済みのポートフォリオが空のまま残ってしまうため）。
create or replace function public.apply_portfolio_image_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m moderated_images%rowtype;
begin
  select * into m from moderated_images where image_url = new.image_url;
  if found then
    if m.replacement_url is null then
      return null;
    end if;
    new.image_url := m.replacement_url;
  end if;

  if new.before_image_url is not null then
    select * into m from moderated_images where image_url = new.before_image_url;
    if found then
      new.before_image_url := m.replacement_url;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_portfolio_image_moderation on public.portfolio_items;
create trigger trg_apply_portfolio_image_moderation
  before insert on public.portfolio_items
  for each row execute function public.apply_portfolio_image_moderation();

-- アイコン: プロフィール保存時に、削除/差し替え済みのURLなら差し替え先（削除なら空）にする。
create or replace function public.apply_avatar_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m moderated_images%rowtype;
begin
  if new.avatar_url is not null then
    select * into m from moderated_images where image_url = new.avatar_url;
    if found then
      new.avatar_url := m.replacement_url;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_apply_avatar_moderation on public.profiles;
create trigger trg_apply_avatar_moderation
  before insert or update of avatar_url on public.profiles
  for each row execute function public.apply_avatar_moderation();


-- ============================================================
-- ストレージ: 管理者は portfolios バケットの他人のファイルを削除・アップロードできる
-- ============================================================
-- 既存の（本人だけが操作できる）ポリシーは変えない。ポリシーはORで評価されるので、追加するだけでよい。
-- storage.remove() は削除後の行を返すため、SELECT のポリシーも必要。
drop policy if exists "admins can view portfolio objects" on storage.objects;
create policy "admins can view portfolio objects"
  on storage.objects as permissive for select to authenticated
  using (bucket_id = 'portfolios' and exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "admins can upload portfolio objects" on storage.objects;
create policy "admins can upload portfolio objects"
  on storage.objects as permissive for insert to authenticated
  with check (bucket_id = 'portfolios' and exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "admins can delete portfolio objects" on storage.objects;
create policy "admins can delete portfolio objects"
  on storage.objects as permissive for delete to authenticated
  using (bucket_id = 'portfolios' and exists (select 1 from public.admins a where a.user_id = auth.uid()));

notify pgrst, 'reload schema';

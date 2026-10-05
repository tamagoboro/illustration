-- 合意内容の控え（/agreements）
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。何度実行しても壊れない。
--
-- 依頼の相談がまとまったら、クリエイターが料金・納期・修正回数・使ってよい範囲などを書いた「控え」を作り、
-- 専用リンク（/agreements/<id>）を依頼者に送る。依頼者がログインして「同意する」を押すと、双方のマイページに残る。
--
-- ・status
--     pending    … 依頼者の同意待ち（この間はクリエイターが内容を直せる）
--     agreed     … 同意済み。以後は誰も書き換えられない
--     declined   … 依頼者が同意しなかった
--     cancelled  … クリエイターが取り下げた
--     superseded … 変更版に同意されたため、古い版になった
-- ・同意後に内容を変えるときは「変更版」を作る（parent_id に元の控え、client_id は元の依頼者に固定）。
--   依頼者が変更版に同意すると、元の控えは superseded になる（履歴として残る）。
-- ・読めるのはクリエイターと依頼者だけ。まだ依頼者が決まっていない控えは、リンク（ID）を知っている人だけが
--   get_agreement() で読める（一覧からは探せない）。
-- ・同意・不同意は accept_agreement() / decline_agreement() の中だけで行う。

create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references auth.users(id) on delete set null,
  request_id uuid references public.requests(id) on delete set null,
  parent_id uuid references public.agreements(id) on delete set null,
  version integer not null default 1,
  status text not null default 'pending' check (status in ('pending', 'agreed', 'declined', 'cancelled', 'superseded')),

  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 3000),
  price integer check (price is null or price >= 0),
  deadline date,
  payment text not null default '' check (char_length(payment) <= 500),
  process text not null default '' check (char_length(process) <= 500),
  revisions text not null default '' check (char_length(revisions) <= 500),
  usage_scope text not null default '' check (char_length(usage_scope) <= 1000),
  commercial_use boolean not null default false,
  portfolio_ok boolean not null default true,
  delivery_format text not null default '' check (char_length(delivery_format) <= 500),
  cancel_policy text not null default '' check (char_length(cancel_policy) <= 1000),
  notes text not null default '' check (char_length(notes) <= 2000),

  client_comment text check (client_comment is null or char_length(client_comment) <= 500),
  agreed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agreements_creator_idx on public.agreements (creator_id, created_at desc);
create index if not exists agreements_client_idx on public.agreements (client_id, created_at desc);

alter table public.agreements enable row level security;

drop policy if exists "Parties can view their agreements" on public.agreements;
create policy "Parties can view their agreements" on public.agreements
  for select to authenticated using (auth.uid() = creator_id or auth.uid() = client_id);

drop policy if exists "Creators can create agreements" on public.agreements;
create policy "Creators can create agreements" on public.agreements
  for insert to authenticated with check (auth.uid() = creator_id);

drop policy if exists "Creators can edit pending agreements" on public.agreements;
create policy "Creators can edit pending agreements" on public.agreements
  for update to authenticated using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

revoke delete on public.agreements from anon, authenticated;

-- 書き込みの決まりごと（クライアントから直接書き込むときだけ確かめる。関数の中からの更新は通す）
-- security definer にしないこと：current_user で「画面から直接の書き込みか」を見分けているため
create or replace function public.guard_agreement_write()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_parent agreements%rowtype;
  v_request requests%rowtype;
begin
  new.updated_at := now();

  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.agreed_at := null;
    new.client_comment := null;
    new.version := 1;
    new.client_id := null;

    -- 変更版：元の控えのクリエイター本人だけが作れ、依頼者は元の控えと同じ人に固定する
    if new.parent_id is not null then
      select * into v_parent from agreements where id = new.parent_id;
      if not found or v_parent.creator_id <> new.creator_id then
        raise exception '元の控えが見つかりません' using errcode = 'P0001';
      end if;
      if v_parent.status <> 'agreed' then
        raise exception '同意済みの控えにだけ変更版を作れます' using errcode = 'P0001';
      end if;
      new.client_id := v_parent.client_id;
      new.request_id := v_parent.request_id;
      new.version := v_parent.version + 1;
    -- 直接リクエストから作る：そのリクエストを送った依頼者に固定する
    elsif new.request_id is not null then
      select * into v_request from requests where id = new.request_id;
      if not found or v_request.creator_id <> new.creator_id then
        raise exception 'リクエストが見つかりません' using errcode = 'P0001';
      end if;
      new.client_id := v_request.client_id;
    end if;
    return new;
  end if;

  -- UPDATE：同意待ちの間だけ内容を直せる。取り下げ（cancelled）以外の状態の変更はできない
  if old.status <> 'pending' then
    raise exception '同意済み・終了した控えは変更できません。変更版を作ってください' using errcode = 'P0001';
  end if;
  if new.creator_id is distinct from old.creator_id
     or new.client_id is distinct from old.client_id
     or new.request_id is distinct from old.request_id
     or new.parent_id is distinct from old.parent_id
     or new.version is distinct from old.version
     or new.agreed_at is distinct from old.agreed_at
     or new.client_comment is distinct from old.client_comment
     or new.created_at is distinct from old.created_at
     or new.status not in ('pending', 'cancelled') then
    raise exception 'この操作はできません' using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_agreement_write on public.agreements;
create trigger trg_guard_agreement_write
  before insert or update on public.agreements
  for each row execute function public.guard_agreement_write();

-- 通知（失敗しても、同意などの操作そのものは止めない）
create or replace function public.notify_agreement(p_user uuid, p_title text, p_body text, p_agreement uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_user is null then
    return;
  end if;
  begin
    insert into notifications (user_id, type, title, body, link_url)
    values (p_user, 'agreement', p_title, p_body, '/agreements/' || p_agreement::text);
  exception when others then
    raise warning 'notify_agreement failed: %', sqlerrm;
  end;
end;
$function$;

revoke all on function public.notify_agreement(uuid, text, text, uuid) from public, anon, authenticated;

-- 依頼者が決まっている控えを作ったら、依頼者に知らせる
create or replace function public.notify_on_new_agreement()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text;
begin
  if new.client_id is not null then
    select coalesce(nullif(display_name, ''), 'クリエイター') into v_name from profiles where user_id = new.creator_id;
    perform notify_agreement(
      new.client_id,
      case when new.version > 1 then '📝 合意内容の変更版が届きました' else '📝 合意内容の控えが届きました' end,
      coalesce(v_name, 'クリエイター') || 'さん「' || new.title || '」の内容を確認して、同意してください',
      new.id
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_notify_on_new_agreement on public.agreements;
create trigger trg_notify_on_new_agreement
  after insert on public.agreements
  for each row execute function public.notify_on_new_agreement();

-- リンクから控えを読む（クリエイター・依頼者、または依頼者がまだ決まっていない同意待ちの控え）
create or replace function public.get_agreement(p_id uuid)
returns setof public.agreements
language sql
stable
security definer
set search_path to 'public'
as $function$
  select * from agreements a
  where a.id = p_id
    and auth.uid() is not null
    and (
      a.creator_id = auth.uid()
      or a.client_id = auth.uid()
      or (a.client_id is null and a.status = 'pending')
    );
$function$;

revoke all on function public.get_agreement(uuid) from public, anon;
grant execute on function public.get_agreement(uuid) to authenticated;

-- 同意する
create or replace function public.accept_agreement(p_id uuid, p_comment text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_row agreements%rowtype;
  v_name text;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = 'P0001';
  end if;

  select * into v_row from agreements where id = p_id for update;
  if not found then
    raise exception '控えが見つかりません' using errcode = 'P0001';
  end if;
  if v_row.creator_id = v_uid then
    raise exception '自分が作った控えには同意できません（依頼者に同意してもらってください）' using errcode = 'P0001';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'この控えは、すでに同意済みか終了しています' using errcode = 'P0001';
  end if;
  if v_row.client_id is not null and v_row.client_id <> v_uid then
    raise exception 'この控えは、ほかの依頼者あてのものです' using errcode = 'P0001';
  end if;

  update agreements
    set status = 'agreed', client_id = v_uid, agreed_at = now(), client_comment = nullif(trim(coalesce(p_comment, '')), '')
    where id = p_id;

  -- 変更版に同意したら、元の控えは古い版にする
  if v_row.parent_id is not null then
    update agreements set status = 'superseded' where id = v_row.parent_id and status = 'agreed';
  end if;

  select coalesce(nullif(display_name, ''), '依頼者') into v_name from profiles where user_id = v_uid;
  perform notify_agreement(
    v_row.creator_id,
    '✅ 合意内容に同意してもらいました',
    coalesce(v_name, '依頼者') || 'さんが「' || v_row.title || '」に同意しました',
    p_id
  );
end;
$function$;

-- 同意しない（理由を添えられる）
create or replace function public.decline_agreement(p_id uuid, p_comment text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_row agreements%rowtype;
begin
  if v_uid is null then
    raise exception 'ログインが必要です' using errcode = 'P0001';
  end if;
  select * into v_row from agreements where id = p_id for update;
  if not found or v_row.status <> 'pending' or v_row.creator_id = v_uid
     or (v_row.client_id is not null and v_row.client_id <> v_uid) then
    raise exception 'この控えには返事ができません' using errcode = 'P0001';
  end if;

  update agreements
    set status = 'declined', client_id = v_uid, client_comment = nullif(trim(coalesce(p_comment, '')), '')
    where id = p_id;

  perform notify_agreement(
    v_row.creator_id,
    '↩ 合意内容の控えが見直しを求められました',
    '「' || v_row.title || '」' || coalesce('：' || nullif(trim(coalesce(p_comment, '')), ''), ''),
    p_id
  );
end;
$function$;

revoke all on function public.accept_agreement(uuid, text) from public, anon;
revoke all on function public.decline_agreement(uuid, text) from public, anon;
grant execute on function public.accept_agreement(uuid, text) to authenticated;
grant execute on function public.decline_agreement(uuid, text) to authenticated;

notify pgrst, 'reload schema';

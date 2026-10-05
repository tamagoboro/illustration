-- 合意内容の控え：持ち逃げ・一方的な破棄を防ぐ仕組み
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。何度実行しても壊れない。
-- 前提: add_agreements.sql と add_agreement_extras.sql を実行済みであること。
--
-- 1. 連絡先（X・Bluesky・Discord など何でもよい）を双方必須にし、名前と一緒に控えに固定する
--    クリエイターは控えを作るとき、依頼者は同意するときに入力する。同意後は変えられない
-- 2. 退会しても控えと記録が消えないようにする（相手の記録まで消えて、持ち逃げの証拠がなくなるのを防ぐ）
-- 3. 解約は双方の同意でだけ：一方が「解約の申し出」→ もう一方が承諾したときだけ terminated になる
-- 4. トラブルを運営に報告：控えと記録がそのまま管理者に届く（管理者は控えを読める）
-- 5. クリエイターのページに、取引完了の件数と「納期を過ぎた未納品」の件数を出す（内容・相手は出さない）

-- ============================================================
-- 1. 名前・連絡先の固定
-- ============================================================
alter table public.agreements add column if not exists creator_name text;
alter table public.agreements add column if not exists creator_contact text;
alter table public.agreements add column if not exists client_name text;
alter table public.agreements add column if not exists client_contact text;

alter table public.agreements drop constraint if exists agreements_contact_length;
alter table public.agreements add constraint agreements_contact_length
  check (char_length(coalesce(creator_contact, '')) <= 200 and char_length(coalesce(client_contact, '')) <= 200);

-- 状態に「解約」を追加
alter table public.agreements drop constraint if exists agreements_status_check;
alter table public.agreements add constraint agreements_status_check
  check (status in ('pending', 'agreed', 'declined', 'cancelled', 'superseded', 'terminated'));

-- 記録の種類に「解約の申し出・承諾・拒否」「トラブル報告」を追加
alter table public.agreement_events drop constraint if exists agreement_events_kind_check;
alter table public.agreement_events add constraint agreement_events_kind_check
  check (kind in ('paid', 'payment_confirmed', 'started', 'draft', 'delivered', 'received', 'note',
                  'termination_requested', 'termination_accepted', 'termination_rejected', 'trouble_reported'));

-- ============================================================
-- 2. 退会しても記録を残す
-- ============================================================
alter table public.agreements alter column creator_id drop not null;
alter table public.agreements drop constraint if exists agreements_creator_id_fkey;
alter table public.agreements add constraint agreements_creator_id_fkey
  foreign key (creator_id) references auth.users(id) on delete set null;
alter table public.agreements drop constraint if exists agreements_client_id_fkey;
alter table public.agreements add constraint agreements_client_id_fkey
  foreign key (client_id) references auth.users(id) on delete set null;

alter table public.agreement_events alter column actor_id drop not null;
alter table public.agreement_events drop constraint if exists agreement_events_actor_id_fkey;
alter table public.agreement_events add constraint agreement_events_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete set null;

-- ============================================================
-- 書き込みの決まりごと（add_agreements.sql の版を置き換え）
-- ============================================================
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

  -- 連絡先は、作るとき・同意待ちの間に直すときは必須（取り下げるときは問わない）
  if (tg_op = 'INSERT' or new.status = 'pending')
     and (new.creator_contact is null or char_length(trim(new.creator_contact)) < 2) then
    raise exception '連絡先（X・Bluesky・DiscordなどのID）を入力してください' using errcode = 'P0001';
  end if;
  new.creator_contact := nullif(trim(coalesce(new.creator_contact, '')), '');
  -- 名前は、作った・直した時点のものを控えに固定する
  select coalesce(nullif(display_name, ''), 'クリエイター') into new.creator_name from profiles where user_id = new.creator_id;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.agreed_at := null;
    new.client_comment := null;
    new.client_name := null;
    new.client_contact := null;
    new.version := 1;
    new.client_id := null;

    if new.parent_id is not null then
      select * into v_parent from agreements where id = new.parent_id;
      if not found or v_parent.creator_id is distinct from new.creator_id then
        raise exception '元の控えが見つかりません' using errcode = 'P0001';
      end if;
      if v_parent.status <> 'agreed' then
        raise exception '同意済みの控えにだけ変更版を作れます' using errcode = 'P0001';
      end if;
      new.client_id := v_parent.client_id;
      new.request_id := v_parent.request_id;
      new.version := v_parent.version + 1;
    elsif new.request_id is not null then
      select * into v_request from requests where id = new.request_id;
      if not found or v_request.creator_id <> new.creator_id then
        raise exception 'リクエストが見つかりません' using errcode = 'P0001';
      end if;
      new.client_id := v_request.client_id;
    end if;
    return new;
  end if;

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
     or new.client_name is distinct from old.client_name
     or new.client_contact is distinct from old.client_contact
     or new.created_at is distinct from old.created_at
     or new.status not in ('pending', 'cancelled') then
    raise exception 'この操作はできません' using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

-- ============================================================
-- 読む・同意する（add_agreements.sql の版を置き換え）
-- ============================================================
-- 管理者も読める（トラブルの報告を確認するため）
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
      or exists (select 1 from admins where admins.user_id = auth.uid())
    );
$function$;

drop policy if exists "Admins can view agreements" on public.agreements;
create policy "Admins can view agreements" on public.agreements
  for select to authenticated using (exists (select 1 from admins where admins.user_id = auth.uid()));

drop policy if exists "Admins can view agreement events" on public.agreement_events;
create policy "Admins can view agreement events" on public.agreement_events
  for select to authenticated using (exists (select 1 from admins where admins.user_id = auth.uid()));

-- 同意するときに、依頼者の連絡先を必須にする（古い2引数版は消す）
drop function if exists public.accept_agreement(uuid, text);
create or replace function public.accept_agreement(p_id uuid, p_contact text, p_comment text default null)
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
  if p_contact is null or char_length(trim(p_contact)) < 2 or char_length(p_contact) > 200 then
    raise exception '連絡先（X・Bluesky・DiscordなどのID）を入力してください' using errcode = 'P0001';
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

  select coalesce(nullif(display_name, ''), '依頼者') into v_name from profiles where user_id = v_uid;

  update agreements
    set status = 'agreed', client_id = v_uid, agreed_at = now(),
        client_name = coalesce(v_name, '依頼者'), client_contact = trim(p_contact),
        client_comment = nullif(trim(coalesce(p_comment, '')), '')
    where id = p_id;

  if v_row.parent_id is not null then
    update agreements set status = 'superseded' where id = v_row.parent_id and status = 'agreed';
  end if;

  perform notify_agreement(v_row.creator_id, '✅ 合意内容に同意してもらいました',
    coalesce(v_name, '依頼者') || 'さんが「' || v_row.title || '」に同意しました', p_id);
end;
$function$;

revoke all on function public.accept_agreement(uuid, text, text) from public, anon;
grant execute on function public.accept_agreement(uuid, text, text) to authenticated;

-- ============================================================
-- 3. 解約は双方の同意で
-- ============================================================
-- 返事待ちの「解約の申し出」（最後の申し出のあとに承諾・拒否が無いもの）
create or replace function public.open_termination_request(p_id uuid)
returns agreement_events
language sql
stable
security definer
set search_path to 'public'
as $function$
  select e.* from agreement_events e
  where e.agreement_id = p_id and e.kind = 'termination_requested'
    and not exists (
      select 1 from agreement_events r
      where r.agreement_id = p_id and r.kind in ('termination_accepted', 'termination_rejected') and r.created_at >= e.created_at
    )
  order by e.created_at desc
  limit 1;
$function$;

revoke all on function public.open_termination_request(uuid) from public, anon, authenticated;

create or replace function public.request_termination(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_row agreements%rowtype;
  v_open agreement_events%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  select * into v_row from agreements where id = p_id for update;
  if not found or v_uid is null or not (v_row.creator_id = v_uid or v_row.client_id = v_uid) then
    raise exception 'この控えの当事者だけが申し出られます' using errcode = 'P0001';
  end if;
  if v_row.status <> 'agreed' then
    raise exception '同意済みの取引だけ、解約を申し出られます' using errcode = 'P0001';
  end if;
  if exists (select 1 from agreement_events where agreement_id = p_id and kind = 'received') then
    raise exception 'この取引は完了しています' using errcode = 'P0001';
  end if;
  if v_reason is null then
    raise exception '解約の理由と、返金などの条件を書いてください' using errcode = 'P0001';
  end if;
  select * into v_open from open_termination_request(p_id);
  if v_open.id is not null then
    raise exception 'すでに解約の申し出が出ています。相手の返事を待ってください' using errcode = 'P0001';
  end if;

  insert into agreement_events (agreement_id, actor_id, kind, note) values (p_id, v_uid, 'termination_requested', left(v_reason, 500));
  perform notify_agreement(
    case when v_row.creator_id = v_uid then v_row.client_id else v_row.creator_id end,
    '⚠ 取引の解約を申し出られました',
    '「' || v_row.title || '」：' || left(v_reason, 60) || '（承諾するまで解約にはなりません）',
    p_id
  );
end;
$function$;

create or replace function public.respond_termination(p_id uuid, p_accept boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_row agreements%rowtype;
  v_open agreement_events%rowtype;
begin
  select * into v_row from agreements where id = p_id for update;
  if not found or v_uid is null or not (v_row.creator_id = v_uid or v_row.client_id = v_uid) then
    raise exception 'この控えの当事者だけが返事できます' using errcode = 'P0001';
  end if;
  select * into v_open from open_termination_request(p_id);
  if v_open.id is null or v_row.status <> 'agreed' then
    raise exception '返事を待っている解約の申し出はありません' using errcode = 'P0001';
  end if;
  if v_open.actor_id = v_uid then
    raise exception '自分の申し出には返事できません。相手の返事を待ってください' using errcode = 'P0001';
  end if;

  insert into agreement_events (agreement_id, actor_id, kind, note)
  values (p_id, v_uid, case when p_accept then 'termination_accepted' else 'termination_rejected' end, nullif(left(trim(coalesce(p_note, '')), 500), ''));

  if p_accept then
    update agreements set status = 'terminated' where id = p_id;
  end if;

  perform notify_agreement(
    v_open.actor_id,
    case when p_accept then '🤝 解約が承諾されました' else '↩ 解約の申し出は承諾されませんでした' end,
    '「' || v_row.title || '」' || coalesce('：' || left(nullif(trim(coalesce(p_note, '')), ''), 60), ''),
    p_id
  );
end;
$function$;

revoke all on function public.request_termination(uuid, text) from public, anon;
revoke all on function public.respond_termination(uuid, boolean, text) from public, anon;
grant execute on function public.request_termination(uuid, text) to authenticated;
grant execute on function public.respond_termination(uuid, boolean, text) to authenticated;

-- ============================================================
-- 4. トラブルを運営に報告
-- ============================================================
create or replace function public.report_agreement_trouble(p_id uuid, p_detail text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_row agreements%rowtype;
  v_detail text := nullif(trim(coalesce(p_detail, '')), '');
begin
  select * into v_row from agreements where id = p_id;
  if not found or v_uid is null or not (v_row.creator_id = v_uid or v_row.client_id = v_uid) then
    raise exception 'この控えの当事者だけが報告できます' using errcode = 'P0001';
  end if;
  if v_detail is null then
    raise exception '何が起きているかを書いてください' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from agreement_events
    where agreement_id = p_id and actor_id = v_uid and kind = 'trouble_reported' and created_at > now() - interval '1 day'
  ) then
    raise exception '報告は1日1回までです。運営で確認するまでお待ちください' using errcode = 'P0001';
  end if;

  insert into agreement_events (agreement_id, actor_id, kind, note) values (p_id, v_uid, 'trouble_reported', left(v_detail, 500));

  begin
    insert into notifications (user_id, type, title, body, link_url)
    select a.user_id, 'agreement_trouble', '🚨 取引のトラブル報告がありました',
           '「' || v_row.title || '」：' || left(v_detail, 80), '/agreements/' || p_id::text
    from admins a;
  exception when others then
    raise warning 'trouble notify failed: %', sqlerrm;
  end;
end;
$function$;

revoke all on function public.report_agreement_trouble(uuid, text) from public, anon;
grant execute on function public.report_agreement_trouble(uuid, text) to authenticated;

-- ============================================================
-- 5. クリエイターの取引の実績（件数だけを公開する）
-- ============================================================
--   completed … 依頼者が「受け取りました」を押した取引
--   overdue   … 同意済み・納期を過ぎた・まだ納品も受け取りもない取引
create or replace function public.get_creator_trade_stats(p_user_id uuid)
returns table (completed integer, overdue integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    (select count(*)::int from agreements a
      where a.creator_id = p_user_id
        and exists (select 1 from agreement_events e where e.agreement_id = a.id and e.kind = 'received')),
    (select count(*)::int from agreements a
      where a.creator_id = p_user_id and a.status = 'agreed'
        and a.deadline < (now() at time zone 'Asia/Tokyo')::date
        and not exists (select 1 from agreement_events e where e.agreement_id = a.id and e.kind in ('delivered', 'received')));
$function$;

grant execute on function public.get_creator_trade_stats(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

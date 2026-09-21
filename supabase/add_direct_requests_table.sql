-- クライアントがクリエイターへ直接リクエストを送り、クリエイターが受諾/辞退を選べる機能
-- （Skebのようなオファー送信型リクエスト）。
-- 先に supabase/add_notifications_table.sql を実行してnotificationsテーブルを作っておくこと。

-- クリエイターがリクエスト受付自体をオフにできるようにする設定列
alter table profiles add column if not exists accepts_direct_requests boolean not null default true;

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  budget numeric,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  creator_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists requests_creator_id_idx on requests (creator_id, created_at desc);
create index if not exists requests_client_id_idx on requests (client_id, created_at desc);

alter table requests enable row level security;

-- ログイン中のクライアントは、自分をclient_idとしてのみリクエストを送信できる
drop policy if exists "clients can send requests" on requests;
create policy "clients can send requests"
  on requests for insert
  to authenticated
  with check (client_id = auth.uid());

-- 当事者（依頼者・受け手のクリエイター）だけが閲覧できる
drop policy if exists "parties can view their requests" on requests;
create policy "parties can view their requests"
  on requests for select
  to authenticated
  using (auth.uid() = creator_id or auth.uid() = client_id);

-- クリエイターは受諾/辞退のために更新できる。クライアントは自分の送信分をキャンセルできる。
drop policy if exists "parties can update their requests" on requests;
create policy "parties can update their requests"
  on requests for update
  to authenticated
  using (auth.uid() = creator_id or auth.uid() = client_id)
  with check (auth.uid() = creator_id or auth.uid() = client_id);

-- 新規リクエストが届いたらクリエイターへ通知
create or replace function notify_on_new_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, type, title, body, link_url)
  values (
    new.creator_id,
    'request_received',
    '新しいリクエストが届きました',
    left(new.content, 100),
    '/dashboard/requests'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_new_request on requests;
create trigger trg_notify_on_new_request
  after insert on requests
  for each row
  execute function notify_on_new_request();

-- クリエイターが受諾/辞退したらクライアントへ通知
create or replace function notify_on_request_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('accepted', 'declined') then
    insert into notifications (user_id, type, title, body, link_url)
    values (
      new.client_id,
      'request_' || new.status,
      case when new.status = 'accepted' then '依頼が承諾されました！' else '依頼が辞退されました' end,
      new.creator_response,
      '/creator/' || new.creator_id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_on_request_status_change on requests;
create trigger trg_notify_on_request_status_change
  after update on requests
  for each row
  execute function notify_on_request_status_change();

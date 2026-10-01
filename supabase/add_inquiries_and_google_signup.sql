-- お問い合わせフォーム ＋ Googleでの新規登録
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。何度実行しても壊れない。
--
-- ■ inquiries … /contact のお問い合わせフォームから届いた内容
--   書き込みはサーバー（/api/contact が service_role で行う）だけ。読み書きできるのは管理者だけ。
--   ip_hash は連続送信を防ぐための目印（IPアドレスそのものは保存しない）。
--
-- ■ handle_new_user の変更
--   Googleで新規登録すると、表示名が空のままプロフィールの行が作られる。
--   名前とアイコンを決める画面（/welcome）を終えるまでは、トップページの一覧などに出さないよう非公開で作る。

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 1 and 50),
  email text not null check (char_length(email) between 3 and 254),
  category text not null check (category in ('general', 'account', 'trouble', 'report', 'business', 'other')),
  message text not null check (char_length(message) between 1 and 3000),
  status text not null default 'open' check (status in ('open', 'done')),
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists inquiries_status_idx on public.inquiries (status, created_at desc);
create index if not exists inquiries_ip_hash_idx on public.inquiries (ip_hash, created_at desc);

alter table public.inquiries enable row level security;

drop policy if exists "admins can view inquiries" on public.inquiries;
create policy "admins can view inquiries" on public.inquiries
  for select to authenticated
  using (exists (select 1 from admins where admins.user_id = auth.uid()));

drop policy if exists "admins can update inquiries" on public.inquiries;
create policy "admins can update inquiries" on public.inquiries
  for update to authenticated
  using (exists (select 1 from admins where admins.user_id = auth.uid()))
  with check (exists (select 1 from admins where admins.user_id = auth.uid()));

revoke insert, delete on public.inquiries from anon, authenticated;

-- 新規ユーザーのプロフィール行。表示名が無い（Googleでの登録）場合は非公開で作る。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  name text := coalesce(new.raw_user_meta_data->>'display_name', '');
begin
  insert into public.profiles (
    user_id,
    display_name,
    is_public,
    status,
    tastes,
    price_min,
    lead_time_days,
    updated_at
  )
  values (
    new.id,
    name,
    name <> '',
    'available',
    '{}'::text[],
    null,
    null,
    now()
  )
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

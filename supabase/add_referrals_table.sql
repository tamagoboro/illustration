-- 友達紹介ポイント機能。
-- 招待リンク（/login?ref=紹介者のuser_id）経由で新規登録すると、
-- 紹介した人・された人の両方にポイントを付与する。
--
-- 付与処理は auth.users への INSERT を検知するトリガーで行う。
-- サインアップ時に supabase.auth.signUp({ options: { data: { referred_by } } }) で
-- 渡した referred_by が auth.users.raw_user_meta_data に入るので、それを読み取る。

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid not null references auth.users(id) on delete cascade,
  bonus_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  unique (referred_id)
);

create index if not exists referrals_referrer_idx on referrals(referrer_id);

alter table referrals enable row level security;

drop policy if exists "Users can view referrals involving them" on referrals;
create policy "Users can view referrals involving them"
  on referrals for select
  using (auth.uid() = referrer_id or auth.uid() = referred_id);

-- 新規ユーザー作成時に紹介ポイントを両者へ付与する
create or replace function public.handle_new_user_referral()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  referrer uuid;
  bonus integer := 50;
begin
  begin
    referrer := (new.raw_user_meta_data->>'referred_by')::uuid;
  exception when others then
    referrer := null;
  end;

  if referrer is null or referrer = new.id then
    return new;
  end if;

  if not exists (select 1 from auth.users where id = referrer) then
    return new;
  end if;

  insert into referrals (referrer_id, referred_id, bonus_awarded)
  values (referrer, new.id, bonus)
  on conflict (referred_id) do nothing;

  -- on conflict で0件だった場合（重複紹介など）はポイントを付与しない
  if found then
    insert into user_points (user_id, balance) values (referrer, bonus)
      on conflict (user_id) do update set balance = user_points.balance + bonus, updated_at = now();
    insert into point_transactions (user_id, amount, reason) values (referrer, bonus, 'referral_bonus:referrer');

    insert into user_points (user_id, balance) values (new.id, bonus)
      on conflict (user_id) do update set balance = user_points.balance + bonus, updated_at = now();
    insert into point_transactions (user_id, amount, reason) values (new.id, bonus, 'referral_bonus:referred');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_referral on auth.users;
create trigger on_auth_user_created_referral
  after insert on auth.users
  for each row execute function public.handle_new_user_referral();

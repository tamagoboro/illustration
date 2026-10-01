-- ログインボーナス
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。何度実行しても壊れない。
--
-- ・1日1回、ログインすると 5pt（日付は日本時間の0時で切り替わる）
-- ・連続ログイン 7日・14日・21日…（7日ごと）に +10pt の途中ボーナス
-- ・その月の1日から最終日まで毎日ログインしたら、最終日のログインで +100pt の皆勤ボーナス
--
-- ポイントの付与は claim_daily_login() の中だけで行う。daily_logins はクライアントから書き込めない。

create table if not exists public.daily_logins (
  user_id uuid not null references auth.users(id) on delete cascade,
  login_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, login_date)
);

alter table public.daily_logins enable row level security;

drop policy if exists "Users can view their own logins" on public.daily_logins;
create policy "Users can view their own logins" on public.daily_logins
  for select to authenticated using (auth.uid() = user_id);

revoke insert, update, delete on public.daily_logins from anon, authenticated;

-- 今日のログインボーナスを受け取る。すでに受け取っていれば claimed = false を返す（何度呼んでも二重付与されない）。
create or replace function public.claim_daily_login()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Tokyo')::date;
  month_start date := date_trunc('month', (now() at time zone 'Asia/Tokyo'))::date;
  days_in_month integer;
  inserted integer;
  streak integer;
  month_days integer;
  daily_points constant integer := 5;
  streak_points integer := 0;
  monthly_points integer := 0;
  current_balance integer;
begin
  if uid is null then
    raise exception 'ログインが必要です';
  end if;

  days_in_month := extract(day from (month_start + interval '1 month' - interval '1 day'))::integer;

  insert into user_points (user_id, balance) values (uid, 0)
    on conflict (user_id) do nothing;

  -- 同じユーザーの同時実行はここで待たされるので、二重付与にならない
  perform 1 from user_points where user_id = uid for update;

  insert into daily_logins (user_id, login_date) values (uid, today)
    on conflict do nothing;
  get diagnostics inserted = row_count;

  -- 今日まで途切れずに続いている日数（新しい順に並べて「日付 + 順番」が同じ値になる範囲が連続している日）
  select count(*) into streak
  from (
    select login_date, login_date + (row_number() over (order by login_date desc))::integer as grp
    from daily_logins
    where user_id = uid and login_date <= today
  ) t
  where grp = today + 1;

  select count(*) into month_days
  from daily_logins
  where user_id = uid and login_date between month_start and today;

  if inserted > 0 then
    if streak > 0 and streak % 7 = 0 then
      streak_points := 10;
    end if;
    if today = month_start + (days_in_month - 1) and month_days = days_in_month then
      monthly_points := 100;
    end if;

    update user_points
      set balance = balance + daily_points + streak_points + monthly_points, updated_at = now()
      where user_id = uid;

    insert into point_transactions (user_id, amount, reason) values (uid, daily_points, 'daily_login');
    if streak_points > 0 then
      insert into point_transactions (user_id, amount, reason) values (uid, streak_points, 'login_streak_bonus');
    end if;
    if monthly_points > 0 then
      insert into point_transactions (user_id, amount, reason) values (uid, monthly_points, 'monthly_perfect_login');
    end if;
  end if;

  select balance into current_balance from user_points where user_id = uid;

  return jsonb_build_object(
    'claimed', inserted > 0,
    'daily_points', case when inserted > 0 then daily_points else 0 end,
    'streak_points', streak_points,
    'monthly_points', monthly_points,
    'balance', current_balance,
    'streak', streak,
    'month_days', month_days,
    'day_of_month', extract(day from today)::integer,
    'days_in_month', days_in_month
  );
end;
$function$;

revoke all on function public.claim_daily_login() from public, anon;
grant execute on function public.claim_daily_login() to authenticated;

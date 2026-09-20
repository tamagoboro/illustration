-- 行動データ（PV・問い合わせ数）に基づく実績バッジを、手動申請なしで自動計算して
-- 誰でも（anon含む）呼び出せるようにするRPC。
--
-- analytics_logsは「本人だけ閲覧可」のRLSになっているため、トップページ等の
-- 公開画面から直接集計することはできない。またPV数など生の数字をそのまま
-- 公開すると競合クリエイター間の比較材料になり得るため、ここでは
-- 「バッジ条件を満たすかどうかの真偽値」だけを返す（生の数字は返さない）。
--
-- 閾値（5件・2倍など）は運用しながら調整して問題ない。

-- p_user_id を省略すると公開プロフィール全員分（トップページ用）、
-- 指定すると1人分だけ（クリエイター詳細ページ用）を返す。
create or replace function get_public_creator_badges(p_user_id uuid default null)
returns table (
  user_id uuid,
  is_trending boolean,
  is_popular_inquiries boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.user_id,
    -- 直近7日のPVが5件以上、かつ その前の7日間の2倍以上に伸びている場合「閲覧数急上昇中」
    coalesce(pv7.cnt, 0) >= 5
      and coalesce(pv7.cnt, 0) >= greatest(1, coalesce(pv_prev.cnt, 0)) * 2 as is_trending,
    -- 直近30日の問い合わせ(見積もりコピー)数が5件以上で「問い合わせ多数」
    coalesce(inq30.cnt, 0) >= 5 as is_popular_inquiries
  from profiles p
  left join (
    select creator_id, count(*) as cnt
    from analytics_logs
    where event_type = 'pv' and created_at >= now() - interval '7 days'
    group by creator_id
  ) pv7 on pv7.creator_id = p.user_id
  left join (
    select creator_id, count(*) as cnt
    from analytics_logs
    where event_type = 'pv'
      and created_at >= now() - interval '14 days'
      and created_at < now() - interval '7 days'
    group by creator_id
  ) pv_prev on pv_prev.creator_id = p.user_id
  left join (
    select creator_id, count(*) as cnt
    from analytics_logs
    where event_type = 'estimate_calc' and created_at >= now() - interval '30 days'
    group by creator_id
  ) inq30 on inq30.creator_id = p.user_id
  where p.is_public = true
    and (p_user_id is null or p.user_id = p_user_id);
$$;

revoke all on function get_public_creator_badges() from public;
grant execute on function get_public_creator_badges() to anon, authenticated;

-- 実績バッジ（閲覧数急上昇・問い合わせ多数・応答率・平均返信時間）を返すRPC。
--
-- 背景: アプリは get_public_creator_badges() を引数なし（トップ・ランキング＝全員分）と
-- get_public_creator_badges(p_user_id => ...)（クリエイターページ＝1人分）の両方で呼ぶが、
-- DB側に引数なしで呼べる定義が無く「Could not find the function ... without parameters」に
-- なっていた。引数あり版と引数なし版の2つの関数を用意して両方の呼び方を受ける。
--
-- 「生のPV数を競合比較の材料にさせない」ため、PV数そのものは返さず真偽値と比率だけ返す。
-- security definer にしているのは、analytics_logs / requests を匿名ユーザーが直接
-- 読めないままバッジの判定結果だけ公開するため。
--
-- 判定のしきい値（急上昇＝直近7日が前7日の1.5倍以上かつ10PV以上、問い合わせ多数＝30日で3件以上）は
-- コードから読み取れない暫定値。運用に合わせて下のwith句の定数を調整すること。
--
-- インデックスは追加不要: analytics_logs_event_creator_created_idx（event_type, creator_id, created_at）と
-- requests_creator_id_idx（creator_id, created_at）が既にあり、この関数の絞り込みに使える。

-- 戻り値の列構成が変わりうるので、既存定義があれば先に消す。
drop function if exists public.get_public_creator_badges();
drop function if exists public.get_public_creator_badges(uuid);

-- 注意: p_user_id に default null を付けて1本にまとめると、PostgREST が引数なし呼び出しを
-- この関数に対応づけられず「without parameters」のエラーになる環境があった。
-- そのため「引数あり」と「引数なし（下のラッパー）」を別々の関数として定義する。
create or replace function public.get_public_creator_badges(p_user_id uuid)
returns table(
  user_id uuid,
  is_trending boolean,
  is_popular_inquiries boolean,
  response_rate integer,
  avg_response_hours numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with pv as (
    select
      creator_id,
      count(*) filter (where created_at >= now() - interval '7 days') as pv_recent,
      count(*) filter (
        where created_at >= now() - interval '14 days'
          and created_at <  now() - interval '7 days'
      ) as pv_prev
    from analytics_logs
    where event_type = 'pv'
      and created_at >= now() - interval '14 days'
      and (p_user_id is null or creator_id = p_user_id)
    group by creator_id
  ),
  req as (
    select
      creator_id,
      count(*) filter (where created_at >= now() - interval '30 days') as req_30d,
      count(*) filter (where status in ('accepted', 'declined')) as responded,
      count(*) filter (where status <> 'cancelled') as answerable,
      avg(extract(epoch from (updated_at - created_at)) / 3600.0)
        filter (where status in ('accepted', 'declined')) as avg_hours
    from requests
    where p_user_id is null or creator_id = p_user_id
    group by creator_id
  )
  select
    p.user_id,
    coalesce(pv.pv_recent >= 10 and pv.pv_recent >= pv.pv_prev * 1.5, false) as is_trending,
    coalesce(req.req_30d >= 3, false) as is_popular_inquiries,
    case when coalesce(req.answerable, 0) >= 3
      then round(100.0 * req.responded / req.answerable)::integer
    end as response_rate,
    round(req.avg_hours::numeric, 1) as avg_response_hours
  from profiles p
  left join pv  on pv.creator_id  = p.user_id
  left join req on req.creator_id = p.user_id
  where p.is_public = true
    and (p_user_id is null or p.user_id = p_user_id);
$$;

-- 引数なし版（トップ・ランキング用＝公開クリエイター全員分）
create or replace function public.get_public_creator_badges()
returns table(
  user_id uuid,
  is_trending boolean,
  is_popular_inquiries boolean,
  response_rate integer,
  avg_response_hours numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.get_public_creator_badges(null::uuid);
$$;

grant execute on function public.get_public_creator_badges(uuid) to anon, authenticated;
grant execute on function public.get_public_creator_badges() to anon, authenticated;

-- PostgREST のスキーマキャッシュを更新（これが無いと作成直後も「not found」のままになる）
notify pgrst, 'reload schema';

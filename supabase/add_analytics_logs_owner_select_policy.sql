-- ダッシュボードの「アクセス解析」で、クリエイターが自分の閲覧数(pv)・
-- 見積もり問い合わせ数(estimate_calc)・お気に入り追加数(favorite)を見られるようにする。
-- analytics_logsへのinsertは訪問者側（未ログイン含む）が行うため既存のinsertポリシーはそのままにし、
-- selectだけ「自分が創作者(creator_id)である行」に限定して許可する。

alter table analytics_logs enable row level security;

drop policy if exists "creators can view own analytics" on analytics_logs;
create policy "creators can view own analytics"
  on analytics_logs for select
  using (auth.uid() = creator_id);

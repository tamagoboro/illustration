-- 魂募集の「お迎えまでの流れ」をクリエイターが編集できるようにする
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。何度実行しても壊れない。
-- 前提: add_soul_listings_and_discord.sql を実行済みであること。
--
-- ・flow_steps … [{ "emoji": "✉️", "title": "応募する", "body": "..." }, ...]（最大8ステップ）
--   空のときは、画面側で標準の流れ（応募 → 相談 → 契約・お支払い → 納品）を表示する。

alter table public.soul_listings
  add column if not exists flow_steps jsonb not null default '[]'::jsonb;

alter table public.soul_listings drop constraint if exists soul_listings_flow_steps_check;
alter table public.soul_listings
  add constraint soul_listings_flow_steps_check
  check (jsonb_typeof(flow_steps) = 'array' and jsonb_array_length(flow_steps) <= 8);

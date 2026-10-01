-- ポートフォリオページの「ご依頼の流れ」をクリエイターが編集できるようにする
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。何度実行しても壊れない。
-- 本人が profiles を更新する既存のポリシーで読み書きできるので、新しいポリシーは不要。
--
-- ・commission_flow … [{ "emoji": "📩", "title": "見積もり・相談", "body": "..." }, ...]（最大8ステップ）
--   空のときは、画面側で標準の流れ（相談 → 内容の確認 → お支払い → 制作・確認 → 納品）を表示する。

alter table public.profiles
  add column if not exists commission_flow jsonb not null default '[]'::jsonb;

alter table public.profiles drop constraint if exists profiles_commission_flow_check;
alter table public.profiles
  add constraint profiles_commission_flow_check
  check (jsonb_typeof(commission_flow) = 'array' and jsonb_array_length(commission_flow) <= 8);

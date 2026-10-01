-- 「ご依頼の流れ」の公開・非公開
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。何度実行しても壊れない。
-- 前提: add_commission_flow.sql を実行済みであること。
--
-- ・commission_flow_public … true のときだけポートフォリオに「ご依頼の流れ」を表示する。
--   初期値は false（非公開）。クリエイターが内容を確認・編集してから「公開する」ボタンで公開する。

alter table public.profiles
  add column if not exists commission_flow_public boolean not null default false;

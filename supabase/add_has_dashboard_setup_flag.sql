-- 「クリエイターかどうか」を明示的に判定するためのフラグ。
-- is_public(一覧への公開設定)とは別物として扱う。ダッシュボードで一度でも
-- プロフィールを保存した時点でtrueになり、以後クリエイター向けの導線を表示する。

alter table profiles add column if not exists has_dashboard_setup boolean not null default false;

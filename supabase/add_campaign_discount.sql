-- 期間限定キャンペーン割引（例: 9/20〜9/30 秋の感謝祭のため20%off）。
-- 最低価格・メニュー・見積もりフォームの各項目に一律で適用され、
-- 各項目側で「個別に割引を指定」「このアイテムは対象外」を上書き設定できる
-- （個別設定はJSONBの menu_items / estimate_forms.fields 側に持たせるため、
--   ここではプロフィール側のキャンペーン本体の列だけ追加する）。

alter table profiles add column if not exists campaign_enabled boolean not null default false;
alter table profiles add column if not exists campaign_label text;
alter table profiles add column if not exists campaign_discount_type text check (campaign_discount_type in ('percent', 'fixed'));
alter table profiles add column if not exists campaign_discount_value numeric check (campaign_discount_value is null or campaign_discount_value >= 0);
alter table profiles add column if not exists campaign_start_at timestamptz;
alter table profiles add column if not exists campaign_end_at timestamptz;

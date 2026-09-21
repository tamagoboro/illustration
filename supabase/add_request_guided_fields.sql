-- 実際のイラストレーターが使っているDM依頼テンプレート（用途・参考資料URL・サイズ・納期等）に
-- 寄せて、リクエストフォームを自由記述だけでなくガイド付きの項目でも受け取れるようにする。

alter table requests add column if not exists usage_type text;
alter table requests add column if not exists reference_url text;
alter table requests add column if not exists size_spec text;
alter table requests add column if not exists desired_deadline date;

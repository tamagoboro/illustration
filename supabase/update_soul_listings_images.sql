-- 魂募集：画像を最大4枚に ＋ 1クリエイター1件まで
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。
-- 前提: add_soul_listings_and_discord.sql を実行済みであること。何度実行しても壊れない。
--
-- ・image_urls … 同じキャラクターの画像を最大4枚（正面・背面・表情差分など）。1枚目が表紙。
--   既存の image_url 列は「表紙」としてそのまま残し、保存時に image_urls の1枚目と同じ値を入れる
--   （一覧のサムネイル等、1枚だけ欲しい所はこれまで通り image_url を使える）。
-- ・1クリエイター1件まで … user_id にユニーク制約を付ける。別のキャラで募集したいときは、
--   今の募集を編集するか削除してから新しく掲載する。

alter table public.soul_listings
  add column if not exists image_urls text[] not null default '{}';

-- 既存の募集は、今の1枚をそのまま1枚目にする
update public.soul_listings
set image_urls = array[image_url]
where cardinality(image_urls) = 0 and image_url is not null;

alter table public.soul_listings drop constraint if exists soul_listings_image_count_check;
alter table public.soul_listings
  add constraint soul_listings_image_count_check check (cardinality(image_urls) between 1 and 4);

-- 1クリエイター1件まで。すでに2件以上掲載している人がいる場合は、自動では消さずに止める
do $$
declare
  v_dup integer;
begin
  select count(*) into v_dup from (
    select user_id from public.soul_listings group by user_id having count(*) > 1
  ) d;
  if v_dup > 0 then
    raise exception '魂募集を2件以上掲載しているクリエイターが % 人います。1人1件になるよう不要な募集を削除してから、もう一度実行してください（確認用: select user_id, count(*) from soul_listings group by user_id having count(*) > 1;）', v_dup;
  end if;
end;
$$;

create unique index if not exists soul_listings_one_per_creator on public.soul_listings (user_id);

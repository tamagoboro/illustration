-- 合意内容の控え：料金の内訳・支払いの予定・細かい取り決め
--
-- 適用方法: Supabase ダッシュボード → SQL Editor にこのファイルの中身を貼り付けて実行する。何度実行しても壊れない。
-- 前提: add_agreements.sql / add_agreement_extras.sql / add_agreement_safety.sql を実行済みであること。
--
-- ・price_items      … 料金の内訳 [{ "label": "基本料金（全身）", "amount": 15000, "quantity": 1 }, ...]
-- ・discount         … 値引き（円）
-- ・tax_mode         … included（税込）/ excluded（税別。消費税は別途）/ none（消費税なし）
-- ・payment_schedule … 支払いの予定 [{ "label": "着手金", "amount": 7500, "timing": "ラフ提出前" }, ...]
-- ・terms            … 細かい取り決め（サイズ・納品方法・日程・著作権・クレジット・改変・AI学習・秘密保持・
--                      実績公開の時期・遅延時の扱い・データの保管など。画面側 lib/agreements.ts の AgreementTerms）
-- 内訳があるときは、合計（price）を DB 側でも内訳から計算し直す（画面の計算と食い違わないように）。

alter table public.agreements add column if not exists price_items jsonb not null default '[]'::jsonb;
alter table public.agreements add column if not exists discount integer not null default 0;
alter table public.agreements add column if not exists tax_mode text not null default 'included';
alter table public.agreements add column if not exists payment_schedule jsonb not null default '[]'::jsonb;
alter table public.agreements add column if not exists terms jsonb not null default '{}'::jsonb;

alter table public.agreements drop constraint if exists agreements_details_check;
alter table public.agreements add constraint agreements_details_check check (
  jsonb_typeof(price_items) = 'array' and jsonb_array_length(price_items) <= 30
  and jsonb_typeof(payment_schedule) = 'array' and jsonb_array_length(payment_schedule) <= 10
  and jsonb_typeof(terms) = 'object' and octet_length(terms::text) <= 20000
  and discount >= 0
  and tax_mode in ('included', 'excluded', 'none')
);

create or replace function public.compute_agreement_price()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_subtotal bigint;
begin
  if jsonb_array_length(coalesce(new.price_items, '[]'::jsonb)) > 0 then
    select coalesce(sum(
             greatest(coalesce((item->>'amount')::numeric, 0), 0) * greatest(coalesce((item->>'quantity')::numeric, 1), 0)
           ), 0)::bigint
      into v_subtotal
      from jsonb_array_elements(new.price_items) item;
    new.price := greatest(v_subtotal - coalesce(new.discount, 0), 0)::integer;
  end if;
  return new;
exception when others then
  raise exception '料金の内訳の金額・数量は数字で入力してください' using errcode = 'P0001';
end;
$function$;

drop trigger if exists trg_compute_agreement_price on public.agreements;
create trigger trg_compute_agreement_price
  before insert or update of price_items, discount on public.agreements
  for each row execute function public.compute_agreement_price();

notify pgrst, 'reload schema';

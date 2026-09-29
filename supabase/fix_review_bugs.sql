-- 全体コードレビューで見つかった4件のDB側の不具合をまとめて直す。


-- ============================================================
-- 1. reviews: UPDATEでcreator_id / reviewer_idを書き換えられてしまう
-- ============================================================
-- 既存のRLSポリシー「Users can update their own review」は reviewer_id = auth.uid() しか
-- 見ておらず、creator_id（レビュー対象）自体を書き換える更新も通ってしまう。
-- アプリのUIは常にupsertでcreator_idを固定して送るので通常は起きないが、
-- ブラウザの開発者ツール等から直接APIを叩けば、自分の既存レビューを別のクリエイター宛てに
-- 書き換えられてしまう（元のクリエイターの評価が消え、別のクリエイターに無関係なレビューが付く）。
create or replace function public.guard_reviews_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') and tg_op = 'UPDATE' then
    if new.creator_id is distinct from old.creator_id
       or new.reviewer_id is distinct from old.reviewer_id then
      raise exception 'レビューの対象クリエイター・投稿者は変更できません';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_reviews_write on public.reviews;
create trigger trg_guard_reviews_write
  before update on public.reviews
  for each row execute function public.guard_reviews_write();


-- ============================================================
-- 2. handle_new_user_referral: 上限チェックに同時実行のすり抜けがある
-- ============================================================
-- 「件数を数える→上限未満なら追加」の間にロックが無く、grant_starter_bonusと同じ理由で
-- 同時に複数アカウントが同じ紹介者IDで登録されると、上限（10人）を超えて紹介ポイントが
-- 付与されうる。紹介者のuser_points行をロックして、同じ紹介者向けの処理を直列化する。
create or replace function public.handle_new_user_referral()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  referrer uuid;
  bonus integer := 50;
  max_rewarded_referrals integer := 10;
begin
  begin
    referrer := (new.raw_user_meta_data->>'referred_by')::uuid;
  exception when others then
    referrer := null;
  end;

  if referrer is null or referrer = new.id then
    return new;
  end if;

  if not exists (select 1 from auth.users where id = referrer) then
    return new;
  end if;

  insert into user_points (user_id, balance) values (referrer, 0)
    on conflict (user_id) do nothing;
  -- 同じ紹介者への同時サインアップはここで待たされ、直列に処理される
  perform 1 from user_points where user_id = referrer for update;

  if (select count(*) from referrals where referrer_id = referrer) >= max_rewarded_referrals then
    return new;
  end if;

  insert into referrals (referrer_id, referred_id, bonus_awarded)
  values (referrer, new.id, bonus)
  on conflict (referred_id) do nothing;

  -- on conflict で0件だった場合（重複紹介など）はポイントを付与しない
  if found then
    insert into user_points (user_id, balance) values (referrer, bonus)
      on conflict (user_id) do update set balance = user_points.balance + bonus, updated_at = now();
    insert into point_transactions (user_id, amount, reason) values (referrer, bonus, 'referral_bonus:referrer');

    insert into user_points (user_id, balance) values (new.id, bonus)
      on conflict (user_id) do update set balance = user_points.balance + bonus, updated_at = now();
    insert into point_transactions (user_id, amount, reason) values (new.id, bonus, 'referral_bonus:referred');
  end if;

  return new;
end;
$$;


-- ============================================================
-- 3. ポートフォリオ保存を「全削除→挿入」の2手順から1つのRPCにまとめ、途中失敗で
--    全消しのまま残らないようにする
-- ============================================================
-- これまでダッシュボードは portfolio_items を「delete → insert」の2回のAPI呼び出しで
-- 保存していた。deleteが成功した直後にinsertが失敗（通信断・不正な値など）すると、
-- 画面には「保存に失敗しました」と出るのに、実際には作品が全消しされた状態のまま残っていた。
-- 1つのSQL関数にまとめることで、関数内の処理はまとめて1トランザクションとして扱われ、
-- 途中で失敗すればdeleteの分もまとめて取り消される。
--
-- before_image_url（管理者の画像モデレーション機能でのみ設定される「ビフォー画像」）は
-- ダッシュボードの保存フォームが関知しない値なので、削除前にsort_order単位で退避しておき、
-- 同じ枠に戻す（そうしないと、管理者が設定したビフォー画像がクリエイターの次回保存で消えてしまう）。
create or replace function public.save_portfolio_items(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_before jsonb;
begin
  if v_uid is null then
    raise exception 'ログインが必要です';
  end if;

  select jsonb_object_agg(sort_order::text, before_image_url) into v_before
  from portfolio_items
  where user_id = v_uid and before_image_url is not null;

  delete from portfolio_items where user_id = v_uid;

  insert into portfolio_items (user_id, image_url, title, sort_order, focal_x, focal_y, before_image_url)
  select
    v_uid,
    item->>'image_url',
    nullif(item->>'title', ''),
    (item->>'sort_order')::int,
    coalesce((item->>'focal_x')::int, 50),
    coalesce((item->>'focal_y')::int, 50),
    v_before ->> (item->>'sort_order')
  from jsonb_array_elements(p_items) as item
  where coalesce(item->>'image_url', '') <> '';
end;
$$;

revoke execute on function public.save_portfolio_items(jsonb) from public, anon;
grant execute on function public.save_portfolio_items(jsonb) to authenticated;


-- ============================================================
-- 4. admin_search_users: 検索語に含まれる % や _ がILIKEのワイルドカードとして
--    そのまま効いてしまう
-- ============================================================
-- 管理者が表示名に「%」や「_」を含むユーザーを検索したとき、それらが意図せず
-- 「任意の文字列」「任意の1文字」として働き、無関係なユーザーまでヒットしてしまう。
-- 検索語自体に含まれる % と _ をエスケープしてから ilike に渡す。
create or replace function public.admin_search_users(p_query text)
returns table(user_id uuid, email text, display_name text, avatar_url text, balance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_escaped text := replace(replace(p_query, '\', '\\'), '%', '\%');
begin
  v_escaped := replace(v_escaped, '_', '\_');

  if not exists (select 1 from admins where admins.user_id = auth.uid()) then
    raise exception '管理者のみ実行できます';
  end if;

  return query
  select u.id, u.email::text, p.display_name, p.avatar_url, coalesce(up.balance, 0)
  from auth.users u
  left join profiles p on p.user_id = u.id
  left join user_points up on up.user_id = u.id
  where
    (p.display_name ilike '%' || v_escaped || '%' escape '\')
    or (u.id::text = p_query)
  order by p.display_name nulls last
  limit 20;
end;
$$;

notify pgrst, 'reload schema';

-- Supabase Advisorで出た警告への対応。
-- 全部で4種類の指摘があり、対応方針はそれぞれ異なる：
--   1. search_path未固定 → 固定する（無害な修正）
--   2. SECURITY DEFINER関数がanon/authenticatedから直接叩ける → 不要なロールから実行権を剥奪
--   3. increment_likes が増減量を無制限にクライアントから受け取れる → ±1に固定する実害のある修正
--   4. ストレージの公開バケットでファイル一覧が取得できてしまう → 一覧取得だけを塞ぐ

-- 1. search_path の固定（関数の中身を書き換えず、検索パス設定だけ追加）
alter function public.auto_confirm_user() set search_path = public;
alter function public.update_updated_at_column() set search_path = public;

-- 2. トリガー専用関数は直接RPCで呼ぶ必要が無いため、anon/authenticatedからの実行権を剥奪。
--    トリガーとしての発火自体には影響しない（トリガー実行はこのEXECUTE権限を経由しないため）。
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.handle_new_user_referral() from anon, authenticated;
revoke execute on function public.grant_review_points() from anon, authenticated;

-- auto_confirm_user はアプリのコードからは呼ばれておらず、用途が不明なため一旦anon/authenticated
-- からの直接実行を止める。トリガーとして使われているだけなら影響はない。
-- もし手動での実行が必要な用途であれば教えてください。
revoke execute on function public.auto_confirm_user() from anon, authenticated;

-- ログイン必須の管理者・購入系の関数は、anonからは常に失敗するだけで意味が無いため
-- anonの実行権だけ剥奪する（authenticatedは実際のユーザー操作に必要なので残す）。
-- 関数内部の管理者チェック・auth.uid()チェックはそのまま維持される。
revoke execute on function public.admin_adjust_points(uuid, integer, text) from anon;
revoke execute on function public.admin_find_user_by_email(text) from anon;
revoke execute on function public.admin_grant_ring(uuid, text) from anon;
revoke execute on function public.admin_search_users(text) from anon;
revoke execute on function public.equip_ring(text) from anon;
revoke execute on function public.purchase_ring(text) from anon;
revoke execute on function public.grant_starter_bonus() from anon;

-- 3. increment_likes: 今までは increment_val を任意の整数でクライアントから受け取れたため、
--    APIを直接叩けば「いいね数」を好きなだけ水増し・減少できてしまう状態だった。
--    ±1固定の安全な形に作り直す（未ログインの訪問者も「いいね」できる仕様のためanonの実行権は残す）。
drop function if exists public.increment_likes(uuid, integer);

create or replace function increment_likes(target_user_id uuid, is_liking boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_liking then
    update profiles set likes_count = coalesce(likes_count, 0) + 1 where user_id = target_user_id;
  else
    update profiles set likes_count = greatest(coalesce(likes_count, 0) - 1, 0) where user_id = target_user_id;
  end if;
end;
$$;

grant execute on function public.increment_likes(uuid, boolean) to anon, authenticated;

-- 4. portfoliosバケットは公開バケットなので、画像URLへの直接アクセス自体は
--    このポリシーが無くても機能する（公開バケットの配信は別経路でRLSを経由しないため）。
--    「Allow public read」ポリシーが許可していた「バケット内の全ファイル一覧取得」機能だけを塞ぐ。
drop policy if exists "Allow public read" on storage.objects;

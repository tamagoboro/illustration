-- 前回の fix_linter_warnings.sql は不完全だった。
-- Postgresは関数作成時、デフォルトで PUBLIC ロール（＝全ロールに暗黙的に含まれる特殊ロール）
-- にも実行権を自動付与する。前回は anon から個別に REVOKE しただけで、
-- PUBLIC 経由の実行権が残っていたため、結局 anon も authenticated も実行できてしまっていた。
-- PUBLIC から明示的に剥奪し、必要なロールにだけ改めて GRANT し直す。

revoke execute on function public.admin_adjust_points(uuid, integer, text) from public;
grant execute on function public.admin_adjust_points(uuid, integer, text) to authenticated;

revoke execute on function public.admin_find_user_by_email(text) from public;
grant execute on function public.admin_find_user_by_email(text) to authenticated;

revoke execute on function public.admin_grant_ring(uuid, text) from public;
grant execute on function public.admin_grant_ring(uuid, text) to authenticated;

revoke execute on function public.admin_search_users(text) from public;
grant execute on function public.admin_search_users(text) to authenticated;

revoke execute on function public.equip_ring(text) from public;
grant execute on function public.equip_ring(text) to authenticated;

revoke execute on function public.purchase_ring(text) from public;
grant execute on function public.purchase_ring(text) to authenticated;

revoke execute on function public.grant_starter_bonus() from public;
grant execute on function public.grant_starter_bonus() to authenticated;

-- トリガー専用関数。直接RPCで叩く必要は無い（トリガーの発火はEXECUTE権限を経由しないため無関係）
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user_referral() from public;
revoke execute on function public.grant_review_points() from public;
revoke execute on function public.auto_confirm_user() from public;

-- 未ログイン訪問者も「いいね」できる仕様のため、anon・authenticated 両方に許可し続ける
revoke execute on function public.increment_likes(uuid, boolean) from public;
grant execute on function public.increment_likes(uuid, boolean) to anon, authenticated;

-- first_portfolio_thumbnails: 参照元の portfolio_items / profiles は元々
-- 誰でもSELECTできる公開データなので、呼び出し元(anon/authenticated)自身の権限で
-- 実行させても機能は変わらない。security_invoker を有効にして
-- 「Security Definer View」の警告自体を解消する。
alter view first_portfolio_thumbnails set (security_invoker = true);

-- public_equipped_rings は user_points（残高など非公開情報を含む）の一部だけを
-- 公開するために、意図的にビュー作成者の権限で動かしている。security_invoker にすると
-- user_points の「本人のみ閲覧可」RLSに阻まれて他人のリング表示ができなくなり、
-- 機能そのものが壊れるため、これは変更しない
-- （SupabaseダッシュボードのAdvisorでは「Acknowledge」して問題ない）。

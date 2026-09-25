<!--
現行DBのトリガー一覧の記録（pg_trigger から書き出したもの。内部トリガーは除く）。
最終確認: harden_security.sql と remove_duplicate_request_notifications.sql の適用後。
関数の中身は schema_functions.sql を参照。DBを変更したらこの記録も更新すること。

取得クエリ:
  select tgrelid::regclass as tbl, tgname, tgfoid::regproc as fn
  from pg_trigger where not tgisinternal order by 1, 2;
-->

## アプリのテーブル（public）

| テーブル | トリガー | 関数 |
|---|---|---|
| profiles | set_profiles_updated_at | update_updated_at_column |
| profiles | trg_notify_favorites_on_reopen | notify_favorites_on_reopen |
| profiles | trg_protect_profile_likes_count | protect_profile_likes_count（APIからの likes_count 書き換えを無効化） |
| favorite_creators | trg_sync_profile_likes_count | sync_profile_likes_count（お気に入りの増減で likes_count を集計） |
| post_likes | trg_notify_author_on_post_like | notify_author_on_post_like |
| post_comments | trg_notify_author_on_post_comment | notify_author_on_post_comment |
| reviews | trg_grant_review_points | grant_review_points |
| reviews | trg_notify_creator_on_new_review | notify_creator_on_new_review |
| referrals | trg_notify_referrer_on_new_referral | notify_referrer_on_new_referral |
| reports | trg_notify_admins_on_new_report | notify_admins_on_new_report |
| requests | trg_enforce_request_rate_limits | enforce_request_rate_limits |
| requests | trg_guard_requests_write | guard_requests_write（列ごとの書き込み制限） |
| requests | trg_notify_client_on_request_response | notify_client_on_request_response |
| requests | trg_notify_creator_on_new_request | notify_creator_on_new_request |

## 認証（auth.users）

| トリガー | 関数 |
|---|---|
| on_auth_user_created | handle_new_user |
| on_auth_user_created_confirm | auto_confirm_user |
| on_auth_user_created_referral | handle_new_user_referral |

## Supabase標準（realtime / storage）

realtime.subscription と storage.buckets / storage.objects のトリガーはSupabase側の管理で、変更しない。

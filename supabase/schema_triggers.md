<!--
現行DBのトリガー一覧の記録（pg_trigger から書き出したもの。内部トリガーは除く）。
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
| post_likes | trg_notify_author_on_post_like | notify_author_on_post_like |
| post_comments | trg_notify_author_on_post_comment | notify_author_on_post_comment |
| reviews | trg_grant_review_points | grant_review_points |
| reviews | trg_notify_creator_on_new_review | notify_creator_on_new_review |
| referrals | trg_notify_referrer_on_new_referral | notify_referrer_on_new_referral |
| reports | trg_notify_admins_on_new_report | notify_admins_on_new_report |
| requests | trg_enforce_request_rate_limits | enforce_request_rate_limits |
| requests | trg_notify_client_on_request_response | notify_client_on_request_response |
| requests | trg_notify_creator_on_new_request | notify_creator_on_new_request |
| requests | trg_notify_on_new_request | notify_on_new_request（重複・remove_duplicate_request_notifications.sql で削除） |
| requests | trg_notify_on_request_status_change | notify_on_request_status_change（重複・同上で削除） |

## 認証（auth.users）

| トリガー | 関数 |
|---|---|
| on_auth_user_created | handle_new_user |
| on_auth_user_created_confirm | auto_confirm_user |
| on_auth_user_created_referral | handle_new_user_referral |

## Supabase標準（realtime / storage）

realtime.subscription と storage.buckets / storage.objects のトリガーはSupabase側の管理で、変更しない。

-- requests の通知トリガーが二重に付いていたので、片方ずつ外す。
--
-- 症状: リクエストを送る／返信すると、通知が2通ずつ届いていた。
--   新規リクエスト … trg_notify_creator_on_new_request（残す）と trg_notify_on_new_request（削除）
--   返信（承諾/辞退）… trg_notify_client_on_request_response（残す）と trg_notify_on_request_status_change（削除）
-- 残す側は他の通知と表記（絵文字付き）・リンク先（/rewards）が揃っている。
-- アプリ（NotificationBell）は通知の type を見て分岐していないので、削除しても表示に影響しない。
--
-- 既存の通知（notifications）の行はそのまま残る。重複して溜まった古い通知を消したい場合は、
-- 別途 type = 'request_received' / 'request_accepted' / 'request_declined' の行を削除する。

drop trigger if exists trg_notify_on_new_request on public.requests;
drop trigger if exists trg_notify_on_request_status_change on public.requests;

drop function if exists public.notify_on_new_request();
drop function if exists public.notify_on_request_status_change();

-- 直接リクエスト機能の改善。
-- 「誰から送られてきたのか分からない」「どこで会話すればいいか分からない」という問題に対応するため、
-- リクエスト送信時にSNSのURL（連絡先）を必須で入力してもらう。あわせて参考画像も添付できるようにする。

alter table requests add column if not exists client_contact_url text;
alter table requests add column if not exists image_urls text[] not null default '{}';

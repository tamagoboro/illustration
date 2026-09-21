-- 直接リクエスト機能の連投・スパム防止。
-- 利用規約で「過度に大量のリクエスト送信」を禁止事項にしたが、実際に止める仕組みが無かったため、
-- DB側のトリガーで以下の2条件を強制する（クライアント側のチェックだけだとAPIを直接叩けば回避できるため）。
--   1. 同じクリエイターへは24時間以内に1件まで
--   2. 未回答(pending)のリクエストを同時に5件を超えて持てない

create or replace function enforce_request_rate_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
  pending_count integer;
begin
  select count(*) into recent_count
  from requests
  where client_id = new.client_id
    and creator_id = new.creator_id
    and created_at >= now() - interval '24 hours';

  if recent_count > 0 then
    raise exception '同じクリエイターへのリクエストは24時間以内に1件までです。返信をお待ちいただくか、時間をおいて再度お試しください。';
  end if;

  select count(*) into pending_count
  from requests
  where client_id = new.client_id
    and status = 'pending';

  if pending_count >= 5 then
    raise exception '未回答のリクエストが5件に達しています。返信を待つか、不要なリクエストを取り下げてから送信してください。';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_request_rate_limits on requests;
create trigger trg_enforce_request_rate_limits
  before insert on requests
  for each row
  execute function enforce_request_rate_limits();

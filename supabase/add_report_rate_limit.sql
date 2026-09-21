-- 通報機能の連投防止。requestsと同じ手法で、同一通報者から同一クリエイターへの通報を
-- 24時間に1件までに制限する（匿名通報はreporter_idがnullで個々を区別できないため対象外）。

create or replace function enforce_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if new.reporter_id is not null then
    select count(*) into recent_count
    from reports
    where reporter_id = new.reporter_id
      and creator_id = new.creator_id
      and created_at >= now() - interval '24 hours';

    if recent_count > 0 then
      raise exception '同じクリエイターへの通報は24時間以内に1件までです。';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_report_rate_limit on reports;
create trigger trg_enforce_report_rate_limit
  before insert on reports
  for each row
  execute function enforce_report_rate_limit();

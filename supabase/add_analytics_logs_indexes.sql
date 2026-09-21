-- get_public_creator_badges() / 各種アクセス解析集計が analytics_logs を毎回スキャンして
-- 重くなっている可能性への対策。(event_type, creator_id, created_at) の組み合わせで
-- 絞り込み・集計しているので、この並び順の複合インデックスを張っておく。

create index if not exists analytics_logs_event_creator_created_idx
  on analytics_logs (event_type, creator_id, created_at desc);

-- トップページ（app/page.tsx）は毎回 profiles を is_public = true で絞り込んでいる。
-- このWHERE条件にインデックスが無いと、クリエイターが増えるほど毎回全件スキャンになり遅くなる。

create index if not exists profiles_is_public_idx
  on profiles (is_public)
  where is_public = true;

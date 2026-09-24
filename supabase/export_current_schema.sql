-- 現在のDB定義をSQLファイルとして書き出すためのクエリ集（DBは変更しない・読み取りのみ）。
--
-- 使い方: Supabase の SQL Editor で下の3つを1つずつ実行し、結果の text セルの中身を
-- コピーして supabase/ 配下の指定ファイルに保存する。
-- （Editor の結果は1セルが長いと省略表示されるので、セルをクリック→コピーすること）
--
-- 背景: テーブル・RLS・RPCの大半がダッシュボードで直接作られていて、リポジトリから
-- DBを再現できない。まずは現状を保存し、以降の変更は supabase/ にSQLとして残す。


-- ① 関数（RPC）→ supabase/schema_functions.sql に保存
select string_agg(pg_get_functiondef(p.oid) || ';', E'\n\n' order by p.proname) as functions_sql
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f';


-- ② RLSポリシー・RLS有効化・インデックス → supabase/schema_policies.sql に保存
select string_agg(stmt, E'\n' order by ord, stmt) as policies_sql
from (
  -- RLS有効化
  select 1 as ord,
         format('alter table %I.%I enable row level security;', schemaname, tablename) as stmt
  from pg_tables
  where schemaname = 'public' and rowsecurity
  union all
  -- ポリシー
  select 2,
         format(
           'create policy %I on %I.%I as %s for %s to %s%s%s;',
           policyname, schemaname, tablename, permissive, cmd,
           array_to_string(roles, ', '),
           case when qual is not null then E'\n  using (' || qual || ')' else '' end,
           case when with_check is not null then E'\n  with check (' || with_check || ')' else '' end
         )
  from pg_policies
  where schemaname = 'public'
  union all
  -- インデックス（主キー・ユニーク制約由来のものはテーブル定義側にあるので除外）
  select 3, indexdef || ';'
  from pg_indexes
  where schemaname = 'public'
    and indexname not in (
      select conname from pg_constraint where contype in ('p', 'u')
    )
) s;


-- ③ テーブル構成（列・型・null可否・デフォルト）→ supabase/schema_tables.md に保存
-- 正確なDDLではなく構成の記録。制約や外部キーまで完全に残したい場合は下記CLIを使う:
--   npx supabase login
--   npx supabase link --project-ref <プロジェクトID>
--   npx supabase db dump --schema public -f supabase/schema.sql   （Docker Desktopが必要）
select string_agg(tbl_def, E'\n\n' order by table_name) as tables_md
from (
  select
    c.table_name,
    '## ' || c.table_name || E'\n' ||
    string_agg(
      format('- %s: %s%s%s',
        c.column_name,
        c.data_type,
        case when c.is_nullable = 'NO' then ' not null' else '' end,
        coalesce(' default ' || c.column_default, '')),
      E'\n' order by c.ordinal_position
    ) as tbl_def
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
  group by c.table_name
) x;

-- 管理画面から全ユーザーを一覧表示し、クリエイター/依頼者の種別を手動で設定できるようにする。
--
-- 背景: has_dashboard_setup は「ダッシュボードで一度でも保存したらクリエイター扱いにする」
-- 仕様のため、依頼者のつもりで一度ダッシュボードを開いて保存しただけのアカウントも
-- クリエイター扱いになってしまっているケースがある（過去アカウントでこれが起きていた）。
-- 自動判定に頼らず、管理者が一覧を見ながら手動で正しい種別に直せるようにする。
--
-- is_public は「一覧に公開するか」というクリエイター自身の別軸の判断
-- （ダッシュボードに「一覧非公開のままでもクリエイター向け導線は出す」という
-- 意図的な組み合わせが既にあるため）なので、ここでは触れず has_dashboard_setup だけを
-- 切り替える。is_public は一覧に参考情報として表示するのみ。

-- 全ユーザー一覧（新しい順・ページング対応）
-- profilesにはcreated_atが無いため、代わりに必ず存在するupdated_atで並べる
-- （戻り値の列構成が変わるためCREATE OR REPLACEできず、先にDROPが必要）
drop function if exists admin_list_users(int, int);
create or replace function admin_list_users(p_limit int default 50, p_offset int default 0)
returns table(
  user_id uuid,
  display_name text,
  avatar_url text,
  has_dashboard_setup boolean,
  is_public boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from admins where admins.user_id = auth.uid()) then
    raise exception '管理者のみ実行できます';
  end if;

  return query
  select p.user_id, p.display_name, p.avatar_url, p.has_dashboard_setup, p.is_public, p.updated_at
  from profiles p
  order by p.updated_at desc nulls last
  limit p_limit offset p_offset;
end;
$$;

-- アカウント種別（クリエイター/依頼者）を手動で設定する
create or replace function admin_set_account_type(p_user_id uuid, p_is_creator boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from admins where admins.user_id = auth.uid()) then
    raise exception '管理者のみ実行できます';
  end if;

  update profiles
  set has_dashboard_setup = p_is_creator
  where user_id = p_user_id;
end;
$$;

-- "new row violates row-level security policy" でアイコン・作品画像・レビュー画像の
-- アップロードが失敗する問題の修正。storage.objects に portfolios バケット用の
-- INSERT/UPDATE/DELETE ポリシーが無い（または壊れている）と、認証済みユーザーの
-- 正当なアップロードでもRLSに弾かれてしまう。
--
-- このアプリが実際に使っているアップロード先のパスパターンは以下の3種類:
--   {自分のuser_id}/avatar_xxx.webp        … アイコン
--   {自分のuser_id}/xxx_index.webp         … 作品ポートフォリオ画像
--   {自分のuser_id}/xxx.webp               … フィード投稿画像
--   reviews/{自分のuser_id}/xxx.webp       … レビュー画像
--   rings/{リングID}.webp                  … 管理者によるアイコンリング画像（管理者のみ）
--
-- 複数のポリシーはOR条件で評価されるため、既存のポリシーが仮に残っていても
-- 追加するだけで害はない（アクセスが狭まることはない）。

-- 自分のuser_id配下、またはreviews/自分のuser_id配下へのアップロードを許可
drop policy if exists "portfolios: users can upload own files" on storage.objects;
create policy "portfolios: users can upload own files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'portfolios'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'reviews'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

-- upsert:true での上書きに対応するためのUPDATEポリシー
drop policy if exists "portfolios: users can update own files" on storage.objects;
create policy "portfolios: users can update own files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'portfolios'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'reviews'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  )
  with check (
    bucket_id = 'portfolios'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'reviews'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

-- 自分のファイルの削除（作品の差し替え・レビュー画像の削除など）を許可
drop policy if exists "portfolios: users can delete own files" on storage.objects;
create policy "portfolios: users can delete own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'portfolios'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'reviews'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

-- 管理者によるアイコンリング画像(rings/配下)のアップロード・更新を許可
drop policy if exists "portfolios: admins can manage ring images" on storage.objects;
create policy "portfolios: admins can manage ring images"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'portfolios'
    and (storage.foldername(name))[1] = 'rings'
    and exists (select 1 from admins where admins.user_id = auth.uid())
  )
  with check (
    bucket_id = 'portfolios'
    and (storage.foldername(name))[1] = 'rings'
    and exists (select 1 from admins where admins.user_id = auth.uid())
  );

-- フィードの投稿編集機能（handleUpdatePost）がpostsテーブルに直接updateしているのに、
-- postsテーブルにはUPDATEポリシーが存在しなかった（DELETE/INSERT/SELECTのみ）。
-- そのため投稿編集は常にRLS違反で失敗していたはずである。

drop policy if exists "Authenticated update own posts" on posts;
create policy "Authenticated update own posts"
  on posts for update
  to public
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

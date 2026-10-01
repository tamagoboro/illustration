import { cache } from 'react'
import { supabase } from '@/lib/supabase'
import { WANTED_POST_COLUMNS, normalizeWantedPost } from '@/lib/wanted'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 募集の詳細ページ（/wanted/[id]）のタイトル・説明文に必要なデータ。
// generateMetadata とページ本体の両方から呼ばれるため、cache で同じリクエスト内の取得を1回にまとめる
export const loadWantedPost = cache(async (id: string) => {
  // UUIDでない値をそのまま問い合わせるとDB側でエラーになるので、先に弾く
  if (!UUID_PATTERN.test(id)) return null

  const { data } = await supabase.from('wanted_posts').select(WANTED_POST_COLUMNS).eq('id', id).maybeSingle()
  return data ? normalizeWantedPost(data) : null
})

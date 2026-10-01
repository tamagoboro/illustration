import { cache } from 'react'
import { supabase } from '@/lib/supabase'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// シェア用カード画像（app/api/og/post/[postId]）のデザインを変えたら数字を1つ上げる。
// X等は画像をURL単位で長期間キャッシュするため、URLを変えないと古い画像が出続ける（lib/ogCard.ts と同じ考え方）
export const POST_OG_DESIGN_VERSION = 1

// フィード投稿の個別ページ（/feed/[postId]）とそのシェア用カード画像に必要なデータ。
// generateMetadata とページ本体の両方から呼ばれるため、cache で同じリクエスト内の取得を1回にまとめる
export const loadPostPageData = cache(async (postId: string) => {
  // UUIDでない値をそのまま問い合わせるとDB側でエラーになるので、先に弾く
  if (!UUID_PATTERN.test(postId)) return null

  const { data } = await supabase
    .from('posts')
    .select('id, user_id, content, image_urls, is_sensitive, created_at, profiles:user_id (display_name)')
    .eq('id', postId)
    .maybeSingle()
  if (!data) return null

  const profile: any = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
  const imageUrls: string[] = data.image_urls || []

  return {
    id: data.id as string,
    user_id: data.user_id as string,
    content: (data.content || '') as string,
    created_at: data.created_at as string,
    authorName: (profile?.display_name?.trim() || 'クリエイター') as string,
    // シェア用カードに使う画像（最大4枚）。センシティブな投稿は、フィードでもぼかして隠しているので
    // SNSのカードにも出さない
    ogImageSources: data.is_sensitive ? [] : imageUrls.slice(0, 4),
  }
})

export type PostPageData = NonNullable<Awaited<ReturnType<typeof loadPostPageData>>>

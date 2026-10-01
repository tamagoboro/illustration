import { supabase } from '@/lib/supabase'
import { normalizeSoulListing } from '@/lib/soulListings'

// 魂募集の詳細ページに必要なデータ。プロフィールの公開・非公開や掲載期間の判定は呼び出し側で行う
export async function loadSoulPageData(id: string, soulId: string) {
  const [{ data: listing }, { data: profile }, { data: reviews }, { data: works }] = await Promise.all([
    supabase.from('soul_listings').select('*').eq('id', soulId).eq('user_id', id).maybeSingle(),
    supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url, is_public, page_background, status_comment')
      .eq('user_id', id)
      .maybeSingle(),
    // 「描いたクリエイター」欄に出す評価
    supabase.from('reviews').select('rating').eq('creator_id', id),
    // 「描いたクリエイター」欄に出すほかの作品（最大4枚）
    supabase.from('portfolio_items').select('id, image_url, title').eq('user_id', id).order('sort_order', { ascending: true }).limit(4),
  ])
  if (!listing || !profile) return null

  const ratings = (reviews || []).map((r) => r.rating as number)
  return {
    listing: normalizeSoulListing(listing),
    profile: profile as {
      user_id: string
      display_name: string
      avatar_url: string | null
      is_public: boolean | null
      page_background?: unknown
      status_comment?: string | null
    },
    creatorStats: {
      reviewCount: ratings.length,
      reviewAvg: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
      works: (works || []) as { id: string; image_url: string; title: string | null }[],
    },
  }
}

export type SoulPageData = NonNullable<Awaited<ReturnType<typeof loadSoulPageData>>>

// 本人以外には見せないページか（ポートフォリオが非公開、または魂募集が掲載開始前）
export const isSoulPageRestricted = (data: SoulPageData, today: string) =>
  data.profile.is_public === false || (!!data.listing.starts_at && data.listing.starts_at > today && !data.listing.is_closed)

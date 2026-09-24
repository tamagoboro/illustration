import { MetadataRoute } from 'next'
import { supabase } from '@/lib/supabase'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 環境変数がない場合は本番URLを直接使用
  const productionUrl = 'https://drawker.com'
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || productionUrl
  const baseUrl = rawSiteUrl.startsWith('http') ? rawSiteUrl : `https://${rawSiteUrl}`

  // 公開中の全クリエイターIDを取得
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('user_id, updated_at, tastes')
    .eq('is_public', true)

  // 作品を1枚も登録していないクリエイターはトップページ・タグページ双方から除外済みなので、
  // サイトマップからも同じ条件で除外する（薄いページをGoogleに送らないようにする）
  const userIds = (allProfiles || []).map((p) => p.user_id)
  const { data: thumbData } =
    userIds.length > 0
      ? await supabase.from('first_portfolio_thumbnails').select('user_id').in('user_id', userIds)
      : { data: [] as { user_id: string }[] }
  const hasPortfolioSet = new Set((thumbData || []).map((t) => t.user_id))
  const profiles = (allProfiles || []).filter((p) => hasPortfolioSet.has(p.user_id))

  const creatorUrls: MetadataRoute.Sitemap = profiles.map((profile) => ({
    url: `${baseUrl}/creator/${profile.user_id}`,
    lastModified: new Date(profile.updated_at || Date.now()),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  // タグ別一覧ページ（実際に使われているタグの分だけ）
  const tagSet = new Set<string>()
  ;(profiles || []).forEach((p: any) => {
    ;(p.tastes || []).forEach((t: string) => {
      if (t) tagSet.add(t)
    })
  })
  const tagUrls: MetadataRoute.Sitemap = Array.from(tagSet).map((tag) => ({
    url: `${baseUrl}/tags/${encodeURIComponent(tag)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    ...creatorUrls,
    ...tagUrls,
  ]
}

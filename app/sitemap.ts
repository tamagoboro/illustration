import { MetadataRoute } from 'next'
import { supabase } from '@/lib/supabase'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 環境変数がない場合は本番URLを直接使用
  const productionUrl = 'https://drawker.com/' // ※ご自身の本番URLに変更してください
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || productionUrl
  const baseUrl = rawSiteUrl.startsWith('http') ? rawSiteUrl : `https://${rawSiteUrl}`

  // 公開中の全クリエイターIDを取得
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, updated_at')
    .eq('is_public', true)

  const creatorUrls: MetadataRoute.Sitemap = (profiles || []).map((profile) => ({
    url: `${baseUrl}/creator/${profile.user_id}`,
    lastModified: new Date(profile.updated_at || Date.now()),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    ...creatorUrls,
  ]
}

import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

// lib/supabase.ts の createBrowserClient はCookie/セッション管理を前提にしており、
// サーバー専用のこのファイル（ビルド時/リクエスト時にNode環境で実行される）で使う意味がない。
// 今は公開データ（is_public=true）しか読んでいないので実害は無いが、将来ログイン前提の
// クエリを足したときに「セッションが無いので黙って空配列が返る」という気づきにくい不具合の
// 元になるため、ここではセッション機構を持たないプレーンなクライアントを使う。
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 環境変数がない場合は本番URLを直接使用
  const productionUrl = 'https://drawker.com'
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || productionUrl
  const baseUrl = rawSiteUrl.startsWith('http') ? rawSiteUrl : `https://${rawSiteUrl}`

  // 公開中の全クリエイターIDを取得
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('user_id, updated_at')
    .eq('is_public', true)

  // 作品を1枚も登録していないクリエイターはトップページから除外済みなので、
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

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/client-guidelines`,
      lastModified: new Date('2026-09-30'),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    ...creatorUrls,
  ]
}

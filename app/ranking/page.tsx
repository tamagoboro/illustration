import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import ProtectedImage from '@/components/ProtectedImage'
import SimpleHeader from '@/components/SimpleHeader'
import { backgroundImageStyle } from '@/lib/background'

export const revalidate = 600

type RankedProfile = {
  user_id: string
  display_name: string
  thumbnail_url: string | null
}

// get_public_creator_badges() は「生のPV数を競合比較の材料にさせない」という設計判断から
// 真偽値（急上昇中か／問い合わせ多数か）しか返さない。そのため本ページも1位・2位…という
// 数値順位ではなく、条件を満たすクリエイターを badge種別ごとにグルーピングして紹介する形にする。
async function getFeaturedCreators() {
  const { data: badgeData } = await supabase.rpc('get_public_creator_badges')

  const trendingIds = (badgeData || []).filter((b: any) => b.is_trending).map((b: any) => b.user_id)
  const popularIds = (badgeData || []).filter((b: any) => b.is_popular_inquiries).map((b: any) => b.user_id)
  const allIds = Array.from(new Set([...trendingIds, ...popularIds]))

  if (allIds.length === 0) {
    return { trending: [] as RankedProfile[], popular: [] as RankedProfile[] }
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', allIds)
    .eq('is_public', true)

  const { data: thumbData } = await supabase
    .from('first_portfolio_thumbnails')
    .select('user_id, image_url')
    .in('user_id', allIds)

  const thumbMap = new Map((thumbData || []).map((t) => [t.user_id, t.image_url]))
  const profileMap = new Map(
    (profileData || [])
      .filter((p) => thumbMap.has(p.user_id))
      .map((p) => [p.user_id, { user_id: p.user_id, display_name: p.display_name, thumbnail_url: thumbMap.get(p.user_id) || null }])
  )

  return {
    trending: trendingIds.map((id: string) => profileMap.get(id)).filter(Boolean) as RankedProfile[],
    popular: popularIds.map((id: string) => profileMap.get(id)).filter(Boolean) as RankedProfile[],
  }
}

function CreatorRow({ profile }: { profile: RankedProfile }) {
  return (
    <Link
      href={`/creator/${profile.user_id}`}
      className="flex items-center gap-3 bg-white rounded-2xl p-3 border border-sky-100/60 shadow-xs hover:shadow-md transition-all"
    >
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-sky-50 shrink-0">
        {profile.thumbnail_url && (
          <ProtectedImage
            src={profile.thumbnail_url}
            alt={profile.display_name}
            watermarkText={profile.display_name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <span className="text-sm font-black text-slate-800 line-clamp-1">{profile.display_name}</span>
    </Link>
  )
}

export default async function RankingPage() {
  const { trending, popular } = await getFeaturedCreators()
  const isEmpty = trending.length === 0 && popular.length === 0

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="今週の注目クリエイター" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        <div className="text-center space-y-2">
          <span className="inline-block px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-black tracking-wide">
            📊 今週の注目クリエイター
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 drop-shadow-sm">閲覧数急上昇中・問い合わせ多数のクリエイター</h1>
          <p className="text-xs text-slate-600 font-medium drop-shadow-sm">
            行動データをもとに自動集計しています。特定の数値は公開せず、条件を満たしたクリエイターを紹介しています。
          </p>
        </div>

        {isEmpty ? (
          <p className="text-center text-sm text-slate-600 font-bold drop-shadow-sm py-16">現在、該当するクリエイターはいません。</p>
        ) : (
          <>
            {trending.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-black text-orange-600 drop-shadow-sm flex items-center gap-1.5">📈 閲覧数急上昇中</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {trending.map((p) => (
                    <CreatorRow key={p.user_id} profile={p} />
                  ))}
                </div>
              </div>
            )}

            {popular.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-black text-violet-600 drop-shadow-sm flex items-center gap-1.5">🔥 問い合わせ多数</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {popular.map((p) => (
                    <CreatorRow key={p.user_id} profile={p} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

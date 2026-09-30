import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import ProtectedImage from '@/components/ProtectedImage'
import SimpleHeader from '@/components/SimpleHeader'
import CreatorThumbnailSlideshow, { ThumbnailSlide } from '@/components/CreatorThumbnailSlideshow'
import { backgroundImageStyle } from '@/lib/background'
import { MODERATED_PLACEHOLDER_URL } from '@/lib/storageUtils'

export const revalidate = 600

type RankedProfile = {
  user_id: string
  display_name: string
  avatar_url: string | null
  status: string | null
  status_comment: string | null
  tastes: string[]
  price_min: number | null
  slides: ThumbnailSlide[]
  isTrending: boolean
  isPopular: boolean
}

// get_public_creator_badges() は「生のPV数を競合比較の材料にさせない」という設計判断から
// 真偽値（急上昇中か／問い合わせ多数か）しか返さない。そのため本ページも1位・2位…という
// 数値順位ではなく、条件を満たすクリエイターを badge種別ごとにグルーピングして紹介する形にする。
async function getFeaturedCreators() {
  const { data: badgeData, error: badgeError } = await supabase.rpc('get_public_creator_badges')

  if (badgeError) {
    console.error('get_public_creator_badges 取得エラー:', badgeError)
    return { trending: [] as RankedProfile[], popular: [] as RankedProfile[], error: badgeError.message }
  }

  const trendingIds: string[] = (badgeData || []).filter((b: any) => b.is_trending).map((b: any) => b.user_id)
  const popularIds: string[] = (badgeData || []).filter((b: any) => b.is_popular_inquiries).map((b: any) => b.user_id)
  const allIds = Array.from(new Set([...trendingIds, ...popularIds]))

  if (allIds.length === 0) {
    return { trending: [] as RankedProfile[], popular: [] as RankedProfile[], error: null as string | null }
  }

  const [{ data: profileData }, { data: portfolioData }] = await Promise.all([
    supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url, status, status_comment, tastes, price_min')
      .in('user_id', allIds)
      .eq('is_public', true),
    // トップページのカードと同じく、先頭3枚をスライド候補にする（管理者に非表示にされた作品は除外）
    supabase
      .from('portfolio_items')
      .select('user_id, image_url, focal_x, focal_y, sort_order')
      .in('user_id', allIds)
      .lt('sort_order', 3)
      .order('sort_order', { ascending: true }),
  ])

  const slidesMap: Record<string, ThumbnailSlide[]> = {}
  ;(portfolioData || []).forEach((item) => {
    if (!item.image_url || item.image_url === MODERATED_PLACEHOLDER_URL) return
    if (!slidesMap[item.user_id]) slidesMap[item.user_id] = []
    slidesMap[item.user_id].push({ url: item.image_url, focalX: item.focal_x ?? 50, focalY: item.focal_y ?? 50 })
  })

  const profileMap = new Map<string, RankedProfile>(
    (profileData || [])
      .filter((p) => slidesMap[p.user_id]?.length)
      .map((p) => [
        p.user_id,
        {
          user_id: p.user_id,
          display_name: p.display_name,
          avatar_url: p.avatar_url ?? null,
          status: p.status ?? null,
          status_comment: p.status_comment ?? null,
          tastes: Array.isArray(p.tastes) ? p.tastes : [],
          price_min: p.price_min ?? null,
          slides: slidesMap[p.user_id],
          isTrending: trendingIds.includes(p.user_id),
          isPopular: popularIds.includes(p.user_id),
        },
      ])
  )

  return {
    trending: trendingIds.map((id) => profileMap.get(id)).filter(Boolean) as RankedProfile[],
    popular: popularIds.map((id) => profileMap.get(id)).filter(Boolean) as RankedProfile[],
    error: null as string | null,
  }
}

function NoImage() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-sky-50 text-sky-300 text-[10px] font-black tracking-widest">
      NO IMAGE
    </div>
  )
}

function CreatorCard({ profile }: { profile: RankedProfile }) {
  const first = profile.slides[0]

  return (
    <Link
      href={`/creator/${profile.user_id}`}
      className="group bg-white/90 backdrop-blur-md rounded-3xl overflow-hidden border border-white/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
    >
      {/* 作品エリア */}
      <div className="relative aspect-[4/5] overflow-hidden bg-sky-50">
        {profile.slides.length > 1 ? (
          <CreatorThumbnailSlideshow
            slides={profile.slides}
            alt={profile.display_name}
            watermarkText={profile.display_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            fallback={<NoImage />}
          />
        ) : (
          <ProtectedImage
            src={first.url}
            alt={profile.display_name}
            watermarkText={profile.display_name}
            fallbackSrc={profile.avatar_url}
            loading="lazy"
            decoding="async"
            style={{ objectPosition: `${first.focalX}% ${first.focalY}%` }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        )}

        {/* バッジ */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 pointer-events-none">
          {profile.isTrending && (
            <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-orange-500 text-white shadow-sm">
              📈 急上昇
            </span>
          )}
          {profile.isPopular && (
            <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-violet-500 text-white shadow-sm">
              🔥 問い合わせ多数
            </span>
          )}
        </div>

        {/* 名前・価格 */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/85 via-slate-900/40 to-transparent p-4 pt-12 flex items-end gap-2.5 pointer-events-none">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-sky-100 border-2 border-white shadow-sm shrink-0">
            {profile.avatar_url && (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-black truncate drop-shadow-sm">{profile.display_name}</p>
            <p className="text-sky-100 text-[11px] font-bold">
              {profile.price_min ? `¥${profile.price_min.toLocaleString()}〜` : '料金は応相談'}
            </p>
          </div>
          <span
            className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full text-white ${
              profile.status === 'available' ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          >
            {profile.status === 'available' ? '即対応可' : '相談受付中'}
          </span>
        </div>
      </div>

      {/* 紹介文・タグ */}
      <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
        <p className="text-[11px] text-slate-600 font-medium leading-relaxed line-clamp-2 min-h-[2.5rem]">
          {profile.status_comment || 'プロフィールページで作品や料金をチェックできます。'}
        </p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1 min-w-0 overflow-hidden max-h-5">
            {profile.tastes.slice(0, 3).map((taste) => (
              <span key={taste} className="text-[9px] font-bold bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded border border-sky-100">
                #{taste}
              </span>
            ))}
          </div>
          <span className="shrink-0 text-[11px] font-black text-sky-600 group-hover:translate-x-0.5 transition-transform">
            詳細 →
          </span>
        </div>
      </div>
    </Link>
  )
}

function Section({
  icon,
  title,
  description,
  accent,
  profiles,
}: {
  icon: string
  title: string
  description: string
  accent: string
  profiles: RankedProfile[]
}) {
  if (profiles.length === 0) return null
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4 bg-white/80 backdrop-blur-md rounded-2xl px-5 py-3.5 border border-white/60 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg text-white shadow-sm ${accent}`}>
            {icon}
          </span>
          <div>
            <h2 className="text-base font-black text-slate-800">{title}</h2>
            <p className="text-[11px] text-slate-500 font-medium">{description}</p>
          </div>
        </div>
        <span className="shrink-0 text-xs font-black text-slate-500">{profiles.length}名</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {profiles.map((p) => (
          <CreatorCard key={p.user_id} profile={p} />
        ))}
      </div>
    </section>
  )
}

export default async function RankingPage() {
  const { trending, popular, error } = await getFeaturedCreators()
  const isEmpty = trending.length === 0 && popular.length === 0

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="今週の注目クリエイター" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 space-y-10">
        {/* ヒーロー */}
        <div className="text-center space-y-3">
          <span className="inline-block px-3 py-1 bg-white/80 backdrop-blur-md text-sky-700 rounded-full text-[11px] font-black tracking-wide shadow-2xs border border-white/60">
            📊 今週の注目クリエイター
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-800 tracking-tight drop-shadow-sm font-serif">
            いま、見られているクリエイター
          </h1>
          <p className="text-xs sm:text-sm text-slate-700 font-medium drop-shadow-sm max-w-xl mx-auto leading-relaxed">
            閲覧数の急上昇や問い合わせの多さなど、行動データをもとに自動で集計しています。
            <br className="hidden sm:inline" />
            具体的な数値は公開せず、条件を満たしたクリエイターを紹介しています。
          </p>
        </div>

        {error ? (
          <p className="text-center text-sm font-bold text-rose-500 drop-shadow-sm py-16">取得エラー: {error}</p>
        ) : isEmpty ? (
          <div className="max-w-xl mx-auto text-center py-12 px-6 space-y-3 bg-white/85 backdrop-blur-md rounded-3xl border border-white/60 shadow-sm">
            <p className="text-3xl">🌱</p>
            <p className="text-sm text-slate-700 font-black">現在、条件を満たすクリエイターはいません。</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              直近7日のPVが5件以上かつ前週の2倍以上、または直近30日の見積もり利用が5件以上のクリエイターが対象です。まだアクセスが少ない間は0件になることがあります。
            </p>
            <Link
              href="/"
              className="inline-block mt-2 px-5 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-black shadow-sm transition-colors"
            >
              クリエイターを探す →
            </Link>
          </div>
        ) : (
          <>
            <Section
              icon="📈"
              title="閲覧数急上昇中"
              description="この1週間で、急にプロフィールが見られるようになったクリエイター"
              accent="bg-gradient-to-br from-orange-400 to-rose-500"
              profiles={trending}
            />
            <Section
              icon="🔥"
              title="問い合わせ多数"
              description="直近30日で、見積もりの利用が多かったクリエイター"
              accent="bg-gradient-to-br from-violet-500 to-fuchsia-500"
              profiles={popular}
            />
          </>
        )}
      </div>
    </div>
  )
}

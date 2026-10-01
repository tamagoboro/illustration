import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { supabase } from '@/lib/supabase'
import { backgroundImageStyle } from '@/lib/background'
import SimpleHeader from '@/components/SimpleHeader'
import SoulGallery from '@/components/SoulGallery'
import SoulShareButton from '@/components/SoulShareButton'
import SoulApplyForm from '@/components/SoulApplyForm'
import {
  SoulListing,
  COMMERCIAL_USE_LABELS,
  SOUL_STATUS_LABELS,
  getSoulStatus,
  formatSoulPeriod,
  formatPrice,
  normalizeSoulListing,
  getSoulCardVersion,
} from '@/lib/soulListings'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://drawker.com'

// 魂募集専用のシェア用カード画像（app/api/og/soul/[soulId]）。内容やデザインが変わるとURLも変わる
const getSoulOgImageUrl = (soulId: string, updatedAt?: string | null) =>
  `${BASE_URL}/api/og/soul/${soulId}?v=${getSoulCardVersion(updatedAt)}`

type Props = { params: Promise<{ id: string; soulId: string }> }

async function loadListing(id: string, soulId: string) {
  const [{ data: listing }, { data: profile }] = await Promise.all([
    supabase.from('soul_listings').select('*').eq('id', soulId).eq('user_id', id).maybeSingle(),
    supabase.from('profiles').select('user_id, display_name, avatar_url, is_public').eq('user_id', id).maybeSingle(),
  ])
  if (!listing || !profile || profile.is_public === false) return null
  return {
    listing: normalizeSoulListing(listing),
    profile,
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, soulId } = await params
  const data = await loadListing(id, soulId)
  if (!data) return { title: '魂募集が見つかりません', robots: { index: false, follow: false } }
  const { listing, profile } = data
  const title = `【魂募集】${listing.title}｜${profile.display_name}`
  const description = (listing.target_audience || listing.description || `${profile.display_name}さんの魂募集イラスト`).slice(0, 120)
  const ogImage = getSoulOgImageUrl(listing.id, listing.updated_at)
  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/creator/${id}/souls/${soulId}` },
    openGraph: {
      title,
      description,
      type: 'article',
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${listing.title}の魂募集` }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}

const COMMERCIAL_STYLES: Record<SoulListing['commercial_use'], string> = {
  allowed: 'bg-emerald-100 text-emerald-700',
  not_allowed: 'bg-slate-200 text-slate-600',
  negotiable: 'bg-amber-100 text-amber-700',
}

export default async function SoulDetailPage({ params }: Props) {
  const { id, soulId } = await params
  const data = await loadListing(id, soulId)
  if (!data) notFound()
  const { listing, profile } = data
  const status = getSoulStatus(listing)
  // 掲載前のものは、URLを知っていても見られないようにする
  if (status === 'upcoming') notFound()

  // シェア用カード画像を先に作ってCDNにキャッシュさせておく（Xのクローラーが来た時にすぐ返せるように）
  after(async () => {
    try {
      await fetch(getSoulOgImageUrl(listing.id, listing.updated_at), { cache: 'no-store' })
    } catch {
      // 失敗してもページ表示には影響しない
    }
  })

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="魂募集" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-4">
        <Link href={`/creator/${id}`} className="inline-flex items-center gap-2 text-xs font-bold text-sky-800 drop-shadow-xs hover:underline">
          ← {profile.display_name}さんのページに戻る
        </Link>

        <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-6 items-start">
          {/* イラスト（最大4枚） */}
          <div className="md:sticky md:top-24 bg-white/80 backdrop-blur-md rounded-3xl p-3 border border-white/80 shadow-lg">
            <SoulGallery
              images={listing.image_urls}
              title={listing.title}
              watermarkText={profile.display_name}
              overlayLabel={status !== 'open' ? SOUL_STATUS_LABELS[status] : null}
            />
          </div>

          {/* 詳細 */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 border border-white/80 shadow-lg space-y-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-[11px] font-black px-2.5 py-1 rounded-full ${
                    status === 'open' ? 'bg-violet-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  🎭 {status === 'open' ? '魂募集中' : SOUL_STATUS_LABELS[status]}
                </span>
                <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${COMMERCIAL_STYLES[listing.commercial_use]}`}>
                  {COMMERCIAL_USE_LABELS[listing.commercial_use]}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-800">{listing.title}</h1>
              <Link href={`/creator/${id}`} className="inline-flex items-center gap-2 group">
                <span className="w-7 h-7 rounded-full overflow-hidden bg-sky-100 shrink-0">
                  {profile.avatar_url && <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />}
                </span>
                <span className="text-xs font-bold text-slate-600 group-hover:text-sky-600">{profile.display_name}</span>
              </Link>
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
              <dt className="font-black text-slate-400">掲載期間</dt>
              <dd className="font-bold text-slate-700">{formatSoulPeriod(listing)}</dd>
              <dt className="font-black text-slate-400">商用利用</dt>
              <dd className="font-bold text-slate-700">{COMMERCIAL_USE_LABELS[listing.commercial_use]}</dd>
            </dl>

            {listing.prices.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-black text-slate-500 tracking-wider">金額</h2>
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 overflow-hidden">
                  {listing.prices.map((p) => (
                    <div key={p.label} className="flex items-center justify-between gap-3 px-4 py-3 bg-white">
                      <span className="text-sm font-bold text-slate-700">{p.label}</span>
                      <span className="text-base font-black text-sky-700 whitespace-nowrap">{formatPrice(p.price)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {listing.target_audience && (
              <section className="space-y-2">
                <h2 className="text-xs font-black text-slate-500 tracking-wider">こんな方におすすめ</h2>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-violet-50/60 rounded-2xl p-4">
                  {listing.target_audience}
                </p>
              </section>
            )}

            {listing.description && (
              <section className="space-y-2">
                <h2 className="text-xs font-black text-slate-500 tracking-wider">詳細</h2>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">{listing.description}</p>
              </section>
            )}

            {status === 'open' && <SoulShareButton listing={listing} creatorName={profile.display_name} size="lg" />}

            <SoulApplyForm
              creatorId={id}
              listingId={listing.id}
              listingTitle={listing.title}
              prices={listing.prices}
              isOpen={status === 'open'}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import ProtectedImage from '@/components/ProtectedImage'
import {
  SoulListing,
  COMMERCIAL_USE_LABELS,
  getSoulStatus,
  formatSoulPeriod,
  formatPrice,
  minSoulPrice,
} from '@/lib/soulListings'

// クリエイターページの「魂募集」。1人1件までなので、募集中の1件を大きく見せ、タップで詳細ページへ
export default function SoulListingSection({
  creatorId,
  creatorName,
  listings,
}: {
  creatorId: string
  creatorName: string
  listings: SoulListing[]
}) {
  const listing = listings.find((l) => getSoulStatus(l) === 'open')
  if (!listing) return null

  const href = `/creator/${creatorId}/souls/${listing.id}`
  const min = minSoulPrice(listing.prices)
  const [cover, ...rest] = listing.image_urls

  return (
    <section className="space-y-3">
      <h2 className="text-base font-black text-sky-900 tracking-tight drop-shadow-xs px-1">🎭 魂募集</h2>

      <Link
        href={href}
        className="group block bg-white/85 backdrop-blur-md rounded-3xl overflow-hidden shadow-lg border border-white/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
      >
        <div className="grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* 画像：表紙を大きく、残りを下に小さく */}
          <div className="p-3 space-y-2">
            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-violet-50">
              <ProtectedImage
                src={cover}
                alt={`${listing.title}（${creatorName}の魂募集イラスト）`}
                watermarkText={creatorName}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute top-2 left-2 text-[10px] font-black px-2.5 py-1 rounded-full bg-violet-500 text-white shadow-sm pointer-events-none">
                魂募集中
              </span>
            </div>
            {rest.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {rest.map((url) => (
                  <div key={url} className="aspect-square rounded-xl overflow-hidden bg-violet-50">
                    <ProtectedImage src={url} alt="" watermarkText={creatorName} loading="lazy" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 概要 */}
          <div className="p-5 sm:pl-2 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <h3 className="text-xl font-black text-slate-800">{listing.title}</h3>
              <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">掲載 {formatSoulPeriod(listing)}</span>
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{COMMERCIAL_USE_LABELS[listing.commercial_use]}</span>
              </div>
              {listing.prices.length > 0 && (
                <div className="space-y-1">
                  {listing.prices.slice(0, 3).map((p) => (
                    <div key={p.label} className="flex justify-between gap-3 text-xs">
                      <span className="font-bold text-slate-600 truncate">{p.label}</span>
                      <span className="font-black text-sky-700 whitespace-nowrap">{formatPrice(p.price)}</span>
                    </div>
                  ))}
                </div>
              )}
              {listing.target_audience && (
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 bg-violet-50/70 rounded-xl p-3">
                  {listing.target_audience}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-black text-sky-700">
                {listing.prices.length === 0 ? '' : min === null ? '応相談' : `${formatPrice(min)}〜`}
              </span>
              <span className="px-5 py-2.5 rounded-full bg-violet-500 group-hover:bg-violet-600 text-white text-xs font-black shadow-sm transition-colors">
                詳細を見て応募する →
              </span>
            </div>
          </div>
        </div>
      </Link>
    </section>
  )
}

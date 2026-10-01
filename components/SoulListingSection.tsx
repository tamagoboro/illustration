'use client'

import Link from 'next/link'
import ProtectedImage from '@/components/ProtectedImage'
import { SoulListing, getSoulStatus, formatSoulPeriod, formatPrice, minSoulPrice } from '@/lib/soulListings'

// クリエイターページの「魂募集」一覧。掲載期間内で募集中のものだけを出し、タップで詳細ページへ
export default function SoulListingSection({
  creatorId,
  creatorName,
  listings,
}: {
  creatorId: string
  creatorName: string
  listings: SoulListing[]
}) {
  const openListings = listings.filter((l) => getSoulStatus(l) === 'open')
  if (openListings.length === 0) return null

  return (
    <section className="space-y-4">
      <div className="flex justify-between items-baseline px-1">
        <h2 className="text-base font-black text-sky-900 tracking-tight drop-shadow-xs">🎭 魂募集</h2>
        <span className="text-xs font-extrabold text-violet-600 bg-white/60 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white">
          {openListings.length} 件募集中
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {openListings.map((listing) => {
          const min = minSoulPrice(listing.prices)
          return (
            <Link
              key={listing.id}
              href={`/creator/${creatorId}/souls/${listing.id}`}
              className="group bg-white/85 backdrop-blur-md rounded-2xl overflow-hidden shadow-lg border border-white/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl flex flex-col"
            >
              <div className="relative aspect-[3/4] bg-violet-50 overflow-hidden">
                <ProtectedImage
                  src={listing.image_url}
                  alt={`${listing.title}（${creatorName}の魂募集イラスト）`}
                  watermarkText={creatorName}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute top-2 left-2 text-[10px] font-black px-2 py-0.5 rounded-full bg-violet-500 text-white shadow-sm pointer-events-none">
                  魂募集中
                </span>
              </div>
              <div className="p-3 space-y-1">
                <p className="text-sm font-black text-slate-800 truncate">{listing.title}</p>
                <p className="text-[10px] font-bold text-slate-400">掲載 {formatSoulPeriod(listing)}</p>
                <p className="text-xs font-black text-sky-700">
                  {listing.prices.length === 0 ? '金額は詳細へ' : min === null ? '応相談' : `${formatPrice(min)}〜`}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

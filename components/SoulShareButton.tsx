'use client'

import { SoulListing, buildSoulShareText, getSoulShareUrl } from '@/lib/soulListings'

// 魂募集をXで宣伝するボタン。シェアしたURLには魂募集専用のカード画像（/api/og/soul/[id]）が表示される
export default function SoulShareButton({
  listing,
  creatorName,
  size = 'md',
}: {
  listing: Pick<SoulListing, 'id' | 'user_id' | 'title' | 'prices' | 'ends_at' | 'updated_at'>
  creatorName: string
  size?: 'md' | 'lg'
}) {
  const handleClick = () => {
    const url = getSoulShareUrl(window.location.origin, listing.user_id, listing.id, listing.updated_at)
    const text = buildSoulShareText(listing, creatorName)
    window.open(
      `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 hover:bg-slate-700 text-white font-black shadow-sm transition-colors cursor-pointer ${
        size === 'lg' ? 'w-full py-3 text-sm' : 'px-4 py-2 text-xs'
      }`}
    >
      <span className="font-black">𝕏</span>
      {size === 'lg' ? 'Xで魂募集を宣伝する' : 'Xで宣伝する'}
    </button>
  )
}

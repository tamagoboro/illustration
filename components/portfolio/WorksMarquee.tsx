'use client'

import ProtectedImage from '@/components/ProtectedImage'

type MarqueeWork = { id: string; image_url: string; title?: string | null }

// 作品が横に流れ続ける帯。マウスを乗せると止まり、タップで作品の詳細を開く。
// 同じ並びを2回つなげて半分まで動かし、継ぎ目なくループさせる（app/globals.css の .drawker-marquee）
export default function WorksMarquee<T extends MarqueeWork>({
  works,
  watermarkText,
  onSelect,
}: {
  works: T[]
  watermarkText: string
  onSelect: (work: T) => void
}) {
  if (works.length < 4) return null
  const items = works.slice(0, 12)
  // 枚数が多いほどゆっくり流す（1枚あたり約4秒）
  const duration = `${items.length * 4}s`

  return (
    <div className="drawker-marquee-track relative overflow-hidden py-2 -mx-4 sm:mx-0 sm:rounded-3xl">
      {/* 両端をふわっと消す */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-20 z-10 bg-gradient-to-r from-white/70 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-20 z-10 bg-gradient-to-l from-white/70 to-transparent" />

      <div className="drawker-marquee flex w-max gap-4" style={{ ['--marquee-duration' as string]: duration }}>
        {[...items, ...items].map((work, i) => (
          <button
            key={`${work.id}-${i}`}
            type="button"
            onClick={() => onSelect(work)}
            aria-hidden={i >= items.length}
            tabIndex={i >= items.length ? -1 : 0}
            className="group relative h-44 sm:h-56 shrink-0 rounded-2xl overflow-hidden shadow-lg border-2 border-white/80 cursor-pointer transition-transform duration-300 hover:-translate-y-1 hover:rotate-[-1deg]"
          >
            <ProtectedImage
              src={work.image_url}
              alt={work.title || ''}
              watermarkText={watermarkText}
              loading="lazy"
              decoding="async"
              wrapperClassName="relative h-full"
              className="block h-full w-auto max-w-none object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </button>
        ))}
      </div>
    </div>
  )
}

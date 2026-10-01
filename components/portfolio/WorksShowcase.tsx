'use client'

import ProtectedImage from '@/components/ProtectedImage'
import Reveal from '@/components/Reveal'

type ShowcaseWork = { id: string; image_url: string; title?: string | null; focal_x?: number | null; focal_y?: number | null }

// 作品一覧（最大4枚）。枚数が少なくても見映えがするよう、1枚目を大きく、残りをその横に並べる「ベントー」配置にする。
//   1枚 … 大きく1枚 / 2枚 … 2枚を並べる / 3枚 … 大1枚＋右に2枚 / 4枚 … 大1枚＋右に3枚
// タップで拡大表示（拡大表示の中で前後の作品へ移動できる）。
export default function WorksShowcase<T extends ShowcaseWork>({
  works,
  watermarkText,
  onSelect,
}: {
  works: T[]
  watermarkText: string
  onSelect: (work: T) => void
}) {
  const items = works.slice(0, 4)
  if (items.length === 0) return null
  const [first, ...rest] = items

  const tile = (work: T, className: string, index: number, big = false) => (
    <Reveal key={work.id} delay={index * 90} className={className}>
      <button
        type="button"
        onClick={() => onSelect(work)}
        className="group relative block w-full h-full rounded-3xl overflow-hidden bg-white/60 shadow-lg ring-1 ring-black/5 cursor-pointer text-left"
      >
        <ProtectedImage
          src={work.image_url}
          alt={work.title || `${watermarkText}の作品`}
          watermarkText={watermarkText}
          loading={index === 0 ? 'eager' : 'lazy'}
          decoding="async"
          style={{ objectPosition: `${work.focal_x ?? 50}% ${work.focal_y ?? 50}%` }}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <p className={`font-black text-white truncate ${big ? 'text-base' : 'text-xs'}`}>{work.title || '無題'}</p>
          <p className="text-[10px] font-bold text-white/80">タップで拡大</p>
        </div>
        {/* スマホではホバーが無いので、タイトルを常に小さく出す */}
        {work.title && (
          <span className="sm:hidden pointer-events-none absolute left-2 bottom-2 max-w-[85%] truncate text-[10px] font-black text-white bg-slate-950/50 px-2 py-0.5 rounded-full">
            {work.title}
          </span>
        )}
      </button>
    </Reveal>
  )

  if (items.length === 1) {
    return <div className="aspect-[4/3] sm:aspect-[16/10]">{tile(first, 'h-full', 0, true)}</div>
  }

  if (items.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 aspect-[4/3] sm:aspect-[16/10]">
        {items.map((w, i) => tile(w, 'h-full', i, true))}
      </div>
    )
  }

  // 3〜4枚：左に大きく1枚、右に残りを縦に並べる
  return (
    <div className="grid grid-cols-[3fr_2fr] gap-3 sm:gap-4 aspect-[4/3] sm:aspect-[16/10]">
      {tile(first, 'h-full', 0, true)}
      <div className={`grid gap-3 sm:gap-4 ${rest.length === 2 ? 'grid-rows-2' : 'grid-rows-3'} h-full min-h-0`}>
        {rest.map((w, i) => tile(w, 'h-full min-h-0', i + 1))}
      </div>
    </div>
  )
}

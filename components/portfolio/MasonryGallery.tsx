'use client'

import ProtectedImage from '@/components/ProtectedImage'
import Reveal from '@/components/Reveal'

type GalleryWork = { id: string; image_url: string; title?: string | null }

// 作品一覧（石積みレイアウト）。正方形に切り抜かず、作品本来の縦横比のまま並べる
export default function MasonryGallery<T extends GalleryWork>({
  works,
  watermarkText,
  onSelect,
}: {
  works: T[]
  watermarkText: string
  onSelect: (work: T) => void
}) {
  return (
    <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 sm:gap-4">
      {works.map((work, i) => (
        <Reveal key={work.id} delay={(i % 4) * 80} className="mb-3 sm:mb-4 break-inside-avoid">
          <button
            type="button"
            onClick={() => onSelect(work)}
            className="group relative block w-full rounded-2xl overflow-hidden bg-white/40 shadow-md border-2 border-white/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl cursor-pointer text-left"
          >
            <ProtectedImage
              src={work.image_url}
              alt={work.title || `${watermarkText}の作品`}
              watermarkText={watermarkText}
              loading="lazy"
              decoding="async"
              wrapperClassName="relative w-full"
              className="block w-full h-auto transition-transform duration-700 group-hover:scale-[1.04]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3 flex flex-col justify-end">
              <p className="text-xs font-black text-white truncate translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                {work.title || '無題'}
              </p>
              <span className="text-[10px] text-white/80 font-bold">タップで拡大</span>
            </div>
          </button>
        </Reveal>
      ))}
    </div>
  )
}

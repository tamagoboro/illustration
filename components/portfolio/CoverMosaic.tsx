'use client'

import { useBrokenImages } from './useBrokenImages'
import ProtectedImage from '@/components/ProtectedImage'

type CoverWork = { id: string; image_url: string; focal_x?: number | null; focal_y?: number | null }

// カバー画像を設定していない人のカバー：作品を最大4枚、横に並べる。
// 読み込めない画像（削除済み・URL切れ）は「画像を表示できません」を出さずに外し、残りで並べ直す
export default function CoverMosaic({ works, watermarkText }: { works: CoverWork[]; watermarkText: string }) {
  const { broken, markBroken } = useBrokenImages(works.slice(0, 6).map((w) => w.image_url))
  const visible = works.filter((w) => !broken.has(w.image_url)).slice(0, 4)

  if (visible.length === 0) {
    return <div className="absolute inset-0 bg-gradient-to-br from-sky-300 via-violet-200 to-pink-200" />
  }

  const cols = ['grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4'][visible.length - 1]
  return (
    <div className={`absolute inset-0 grid gap-0.5 ${cols}`}>
      {visible.map((work) => (
        <div key={work.id} className="relative overflow-hidden">
          <ProtectedImage
            src={work.image_url}
            alt=""
            watermarkText={watermarkText}
            style={{ objectPosition: `${work.focal_x ?? 50}% ${work.focal_y ?? 50}%` }}
            wrapperClassName="relative w-full h-full"
            className="w-full h-full object-cover"
            onError={() => markBroken(work.image_url)}
          />
        </div>
      ))}
    </div>
  )
}

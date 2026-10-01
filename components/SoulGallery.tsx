'use client'

import { useState } from 'react'
import ProtectedImage from '@/components/ProtectedImage'

// 魂募集の詳細ページの画像（最大4枚）。下のサムネイルで大きい画像を切り替える
export default function SoulGallery({
  images,
  title,
  watermarkText,
  overlayLabel,
}: {
  images: string[]
  title: string
  watermarkText: string
  overlayLabel?: string | null
}) {
  const [index, setIndex] = useState(0)
  const current = images[Math.min(index, images.length - 1)]

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl overflow-hidden bg-violet-50">
        <ProtectedImage
          key={current}
          src={current}
          alt={`${title}（魂募集イラスト ${index + 1}枚目）`}
          watermarkText={watermarkText}
          wrapperClassName="relative w-full"
          className="block w-full h-auto max-h-[70vh] object-contain"
        />
        {overlayLabel && (
          <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center pointer-events-none">
            <span className="px-5 py-2 rounded-full bg-white text-slate-700 text-sm font-black">{overlayLabel}</span>
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`${i + 1}枚目を表示`}
              className={`relative aspect-square rounded-xl overflow-hidden bg-violet-50 cursor-pointer transition-all ${
                i === index ? 'ring-3 ring-violet-500' : 'opacity-70 hover:opacity-100'
              }`}
            >
              <ProtectedImage src={url} alt="" watermarkText={watermarkText} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

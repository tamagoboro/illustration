'use client'

import { useEffect, useRef, useState } from 'react'
import ProtectedImage from './ProtectedImage'

export type ThumbnailSlide = {
  url: string
  focalX: number
  focalY: number
}

const SLIDE_INTERVAL_MS = 3500

// トップページのカードで、同じクリエイターの複数作品を自動で切り替えて見せる。
// 重くしないための工夫:
//   ・作品が1枚しかないクリエイターは、そもそもこのコンポーネントを使わず今までどおり
//     静止画1枚のまま（呼び出し側で分岐。大半のクリエイターはこちらのはず）
//   ・画面内に実際にスクロールで表示されているカードだけスライドを進める
//     （IntersectionObserver。画面外のカードは切り替えず、次の画像も読み込まない）
//   ・切り替え先の画像は、実際にそのコマが表示される直前まで読み込まない
//     （先読みしない。多少の表示ラグより、読み込む総量を絞ることを優先）
//   ・<img>のsrcを差し替えるだけで、要素自体は使い回す（毎回作り直さない）
export default function CreatorThumbnailSlideshow({
  slides,
  alt,
  watermarkText,
  className,
}: {
  slides: ThumbnailSlide[]
  alt: string
  watermarkText: string
  className?: string
}) {
  const [index, setIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wrapperRef.current
    if (!el || slides.length < 2) return
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), {
      rootMargin: '200px',
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [slides.length])

  useEffect(() => {
    if (!isVisible || slides.length < 2) return
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length)
    }, SLIDE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [isVisible, slides.length])

  const current = slides[index]
  useEffect(() => setLoaded(false), [current?.url])

  if (!current) return null

  return (
    <div ref={wrapperRef} className="relative w-full h-full">
      <ProtectedImage
        src={current.url}
        alt={alt}
        watermarkText={watermarkText}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        style={{
          objectPosition: `${current.focalX}% ${current.focalY}%`,
          opacity: loaded ? 1 : 0,
          transition: 'opacity 300ms ease',
        }}
        className={className}
      />
      {slides.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10 pointer-events-none">
          {slides.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === index ? 'w-3 bg-white' : 'w-1 bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

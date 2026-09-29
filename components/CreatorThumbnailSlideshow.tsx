'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import ProtectedImage from './ProtectedImage'

export type ThumbnailSlide = {
  url: string
  focalX: number
  focalY: number
}

const SLIDE_INTERVAL_MS = 3500

// トップページのカードで、同じクリエイターの複数作品を自動で切り替えて見せる。
//
// 切り替えの考え方: 次に見せる画像は、表示を切り替える前に裏側（画面には出さない
// Image オブジェクト）で読み込んでおく。一定間隔ごとに「そろそろ切り替えたい」という
// 意思を持つが、実際に切り替えるのは、その次の画像の読み込みが終わった瞬間だけにする。
// まだ読み込み中なら、読み込みが終わるまで今の画像を出し続ける（多少表示が長引いても、
// 読み込み中の空白や壊れた表示を一瞬でも見せないことを優先する）。
// 読み込みに失敗した画像（404・削除済みなど）は候補から外し、次に控えている画像へ進む。
//
// 重くしないための工夫はそのまま維持:
//   ・作品が1枚しかないクリエイターは、呼び出し側でこのコンポーネントを使わず静止画のまま
//   ・画面内に実際にスクロールで表示されているカードだけ動かす（IntersectionObserver）
export default function CreatorThumbnailSlideshow({
  slides,
  alt,
  watermarkText,
  className,
  fallback = null,
}: {
  slides: ThumbnailSlide[]
  alt: string
  watermarkText: string
  className?: string
  fallback?: ReactNode
}) {
  // 読み込みに失敗した（壊れている／消えている）URLは、以降のスライド候補から外す
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(new Set())
  const validSlides = slides.filter((s) => !brokenUrls.has(s.url))

  const [displayIndex, setDisplayIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // 表示中の画像が候補から外れて配列が詰まった場合に、範囲外を指さないようにする
  useEffect(() => {
    if (displayIndex >= validSlides.length && validSlides.length > 0) {
      setDisplayIndex(0)
    }
  }, [displayIndex, validSlides.length])

  // 次の画像を裏で先読みしておく。読み込みが終わった時点で「準備完了」フラグを立てるだけで、
  // まだ画面上の表示は切り替えない（切り替えは下のタイマー側が担当）。
  const nextReadyRef = useRef(false)
  const wantsAdvanceRef = useRef(false)
  const preloadingUrlRef = useRef<string | null>(null)

  useEffect(() => {
    const el = wrapperRef.current
    if (!el || validSlides.length < 2) return
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting)
      if (!entry.isIntersecting) {
        // 画面外に出たら最初の画像に戻して止めておく（再びスクロールで見えたとき、
        // 途中の枚数からではなく必ず1枚目から始まるようにする）
        setDisplayIndex(0)
        nextReadyRef.current = false
        wantsAdvanceRef.current = false
        preloadingUrlRef.current = null
      }
    }, {
      rootMargin: '200px',
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [validSlides.length])

  const nextIndex = validSlides.length > 1 ? (displayIndex + 1) % validSlides.length : displayIndex
  const nextUrl = validSlides[nextIndex]?.url

  useEffect(() => {
    if (!isVisible || validSlides.length < 2 || !nextUrl) return
    if (preloadingUrlRef.current === nextUrl) return
    preloadingUrlRef.current = nextUrl
    nextReadyRef.current = false

    const img = new Image()
    img.onload = () => {
      nextReadyRef.current = true
      // タイマーがすでに「切り替えたい」と待っていた場合は、読み込みが終わった瞬間に進める
      if (wantsAdvanceRef.current) {
        wantsAdvanceRef.current = false
        setDisplayIndex(nextIndex)
      }
    }
    img.onerror = () => {
      setBrokenUrls((prev) => new Set(prev).add(nextUrl))
    }
    img.src = nextUrl

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [isVisible, nextUrl, nextIndex, validSlides.length])

  useEffect(() => {
    if (!isVisible || validSlides.length < 2) return
    const timer = setInterval(() => {
      if (nextReadyRef.current) {
        nextReadyRef.current = false
        setDisplayIndex(nextIndex)
      } else {
        // まだ次の画像の読み込みが終わっていない。読み込み完了時に進める（上のonload参照）
        wantsAdvanceRef.current = true
      }
    }, SLIDE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [isVisible, nextIndex, validSlides.length])

  const current = validSlides[displayIndex]
  if (!current) return <>{fallback}</>

  return (
    <div ref={wrapperRef} className="relative w-full h-full">
      <ProtectedImage
        src={current.url}
        alt={alt}
        watermarkText={watermarkText}
        loading="lazy"
        decoding="async"
        onError={() => setBrokenUrls((prev) => new Set(prev).add(current.url))}
        style={{ objectPosition: `${current.focalX}% ${current.focalY}%` }}
        className={className}
      />
      {validSlides.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10 pointer-events-none">
          {validSlides.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === displayIndex ? 'w-3 bg-white' : 'w-1 bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

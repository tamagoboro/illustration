'use client'

import { ImgHTMLAttributes, useEffect, useMemo, useRef, useState } from 'react'

// 無断保存対策用の警告画像。右クリック保存・ドラッグ保存・スマホの長押し保存を検知した瞬間だけ、
// 本物のイラストの代わりにこの画像に一時的に差し替える（完全な防止はできないが、
// カジュアルな無断保存に対する抑止力として機能させる）。
const DECOY_IMAGE_URL = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
    <rect width="600" height="600" fill="#1e293b"/>
    <rect width="600" height="600" fill="#dc2626" opacity="0.12"/>
    <text x="50%" y="44%" fill="#fca5a5" font-size="46" font-weight="900" text-anchor="middle" font-family="sans-serif">Illicit Image</text>
    <text x="50%" y="56%" fill="#fca5a5" font-size="46" font-weight="900" text-anchor="middle" font-family="sans-serif">不正画像</text>
    <text x="50%" y="66%" fill="#94a3b8" font-size="15" text-anchor="middle" font-family="sans-serif">Unauthorized download detected（無断ダウンロードを検知しました）</text>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
})()

const escapeXml = (str: string) =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

// スクリーンショット・画面録画・カメラ撮影など、右クリック禁止では防げない保存手段に対しても
// 唯一効果がある対策＝見えているもの自体に薄い透かしを焼き込んでおく。CSSの重ね合わせなので
// 画面に描画された時点で透かしごと写り込む（画像ファイル自体は加工していない）。
// クリエイター名を透かし文字にすることで「誰の作品か」が保存後も一目で分かるようにしている。
const buildWatermarkTileUrl = (text: string) => {
  const safeText = escapeXml(text)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
    <text x="80" y="70" font-size="15" font-family="sans-serif" font-weight="700"
      text-anchor="middle" fill="#ffffff" fill-opacity="0.32" stroke="#000000" stroke-opacity="0.18" stroke-width="0.7"
      transform="rotate(-28 80 70)">${safeText}</text>
    <text x="0" y="150" font-size="15" font-family="sans-serif" font-weight="700"
      text-anchor="middle" fill="#ffffff" fill-opacity="0.32" stroke="#000000" stroke-opacity="0.18" stroke-width="0.7"
      transform="rotate(-28 0 150)">${safeText}</text>
    <text x="160" y="150" font-size="15" font-family="sans-serif" font-weight="700"
      text-anchor="middle" fill="#ffffff" fill-opacity="0.32" stroke="#000000" stroke-opacity="0.18" stroke-width="0.7"
      transform="rotate(-28 160 150)">${safeText}</text>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const LONG_PRESS_MS = 450
const RESTORE_DELAY_MS = 1500

export default function ProtectedImage({
  src,
  watermarkText = 'drawker.com',
  wrapperClassName = 'relative w-full h-full',
  style,
  fallbackSrc,
  ...rest
}: ImgHTMLAttributes<HTMLImageElement> & { watermarkText?: string; wrapperClassName?: string; fallbackSrc?: string | null }) {
  const [showDecoy, setShowDecoy] = useState(false)
  // 画像ファイルが無い・URLが壊れているときに、alt文字が丸出しになるのを避けるための表示切り替え
  const [loadFailed, setLoadFailed] = useState(false)
  // 元画像が読めなかったときに1回だけ差し替える代替画像（アバターなど）
  const [useFallback, setUseFallback] = useState(false)
  useEffect(() => {
    setLoadFailed(false)
    setUseFallback(false)
  }, [src])
  const restoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const watermarkTileUrl = useMemo(
    () => buildWatermarkTileUrl(watermarkText || 'drawker.com'),
    [watermarkText]
  )

  const triggerDecoy = () => {
    setShowDecoy(true)
    if (restoreTimer.current) clearTimeout(restoreTimer.current)
    restoreTimer.current = setTimeout(() => setShowDecoy(false), RESTORE_DELAY_MS)
  }

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  if (loadFailed) {
    return (
      <div className={wrapperClassName}>
        <div className="w-full h-full flex items-center justify-center bg-slate-100 text-[10px] font-bold text-slate-400 text-center p-2">
          画像を表示できません
        </div>
      </div>
    )
  }

  return (
    <div className={wrapperClassName}>
      <img
        {...rest}
        onError={(e) => {
          if (fallbackSrc && !useFallback) {
            setUseFallback(true)
            return
          }
          setLoadFailed(true)
          rest.onError?.(e)
        }}
        src={showDecoy ? DECOY_IMAGE_URL : useFallback ? fallbackSrc! : src}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={(e) => {
          e.preventDefault()
          triggerDecoy()
        }}
        onTouchStart={() => {
          cancelLongPress()
          longPressTimer.current = setTimeout(triggerDecoy, LONG_PRESS_MS)
        }}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
        style={{
          ...style,
          // iOSは長押しで「写真に保存」ネイティブメニューを出すが、これはJSのタイマーより
          // 先に本物の画像を掴んで表示することがあり、下のonTouchStartの差し替えが間に合う
          // かどうかは端末やタイミング次第でブレる（「保存できるときとできないときがある」の原因）。
          // -webkit-touch-callout: none で、そのネイティブメニュー自体を出さないようにする
          // （Safari/iOS専用のプロパティ。これで長押し時の保存メニューが確実に出なくなる）。
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
      />
      {!showDecoy && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: `url("${watermarkTileUrl}")`, backgroundRepeat: 'repeat' }}
        />
      )}
    </div>
  )
}

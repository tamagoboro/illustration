'use client'

import { ImgHTMLAttributes, useRef, useState } from 'react'

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

// スクリーンショット・画面録画・カメラ撮影など、右クリック禁止では防げない保存手段に対しても
// 唯一効果がある対策＝見えているもの自体に薄い透かしを焼き込んでおく。CSSの重ね合わせなので
// 画面に描画された時点で透かしごと写り込む（画像ファイル自体は加工していない）。
const WATERMARK_TILE_URL = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
    <text x="120" y="130" font-size="20" font-family="sans-serif" font-weight="700"
      text-anchor="middle" fill="#ffffff" fill-opacity="0.22" stroke="#000000" stroke-opacity="0.12" stroke-width="0.6"
      transform="rotate(-28 120 120)">drawker.com</text>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
})()

const LONG_PRESS_MS = 450
const RESTORE_DELAY_MS = 1500

export default function ProtectedImage({
  src,
  wrapperClassName = 'relative w-full h-full',
  ...rest
}: ImgHTMLAttributes<HTMLImageElement> & { wrapperClassName?: string }) {
  const [showDecoy, setShowDecoy] = useState(false)
  const restoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  return (
    <div className={wrapperClassName}>
      <img
        {...rest}
        src={showDecoy ? DECOY_IMAGE_URL : src}
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
      />
      {!showDecoy && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: `url("${WATERMARK_TILE_URL}")`, backgroundRepeat: 'repeat' }}
        />
      )}
    </div>
  )
}

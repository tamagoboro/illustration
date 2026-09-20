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

const LONG_PRESS_MS = 450
const RESTORE_DELAY_MS = 1500

export default function ProtectedImage({ src, ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
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
  )
}

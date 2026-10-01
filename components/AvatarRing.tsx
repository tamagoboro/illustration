'use client'

import { ReactNode } from 'react'
import { useIconRing } from '@/lib/iconRings'

// 購入したアイコンリングをアバターの周りに表示する共通コンポーネント。
// サイト内でアイコンが表示される箇所はすべて円形に統一し、リング画像の形が崩れないようにする。
//
// アイコン本体は、リングの有無にかかわらず常に size のまま表示する（リングを付けた人だけアイコンが
// 小さくなるのを防ぐ）。リング画像は穴（内側76%）がアイコンにぴったり重なるよう、外側にはみ出して描く。
// はみ出す分は周りのレイアウトに影響しない（size の枠のまま）。
const RING_HOLE_RATIO = 0.76
export default function AvatarRing({
  src,
  alt,
  size,
  ringId,
  fallback,
}: {
  src?: string | null
  alt: string
  size: number
  ringId?: string | null
  fallback?: ReactNode
}) {
  const ring = useIconRing(ringId)

  const avatarInner = src ? (
    <img
      src={src}
      alt={alt}
      style={{ width: '100%', height: '100%', borderRadius: '9999px' }}
      className="object-cover block"
    />
  ) : (
    fallback ?? (
      <div
        style={{ width: '100%', height: '100%', borderRadius: '9999px' }}
        className="bg-sky-100"
      />
    )
  )

  if (!ring) {
    return (
      <div style={{ width: size, height: size, borderRadius: '9999px' }}>{avatarInner}</div>
    )
  }

  // リング画像の大きさと、外側へはみ出す幅
  const ringSize = size / RING_HOLE_RATIO
  const overhang = (ringSize - size) / 2

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '9999px', overflow: 'hidden' }}>{avatarInner}</div>
      <img
        src={ring.image}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -overhang,
          left: -overhang,
          width: ringSize,
          height: ringSize,
          maxWidth: 'none',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

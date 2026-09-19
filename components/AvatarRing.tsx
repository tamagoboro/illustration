'use client'

import { ReactNode } from 'react'
import { useIconRing } from '@/lib/iconRings'

// 購入したアイコンリングをアバターの周りに表示する共通コンポーネント。
// サイト内でアイコンが表示される箇所はすべて円形に統一し、リング画像の形が崩れないようにする。
// アバター本体はリングの内側の穴に収まるよう76%サイズで中央配置。
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

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: '12%',
          left: '12%',
          width: '76%',
          height: '76%',
          borderRadius: '9999px',
          overflow: 'hidden',
        }}
      >
        {avatarInner}
      </div>
      <img
        src={ring.image}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

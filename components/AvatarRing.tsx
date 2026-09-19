import { ReactNode } from 'react'
import { getIconRing } from '@/lib/iconRings'

// 購入したアイコンリングをアバターの周りに表示する共通コンポーネント。
// ringId が未装着(null)なら、リングの余白を作らずそのまま表示する。
export default function AvatarRing({
  src,
  alt,
  size,
  ringId,
  rounded = 'full',
  fallback,
}: {
  src?: string | null
  alt: string
  size: number
  ringId?: string | null
  rounded?: 'full' | '2xl'
  fallback?: ReactNode
}) {
  const ring = getIconRing(ringId)
  const radius = rounded === 'full' ? '9999px' : '1rem'

  const inner = src ? (
    <img
      src={src}
      alt={alt}
      style={{ width: '100%', height: '100%', borderRadius: radius }}
      className="object-cover block"
    />
  ) : (
    fallback ?? (
      <div
        style={{ width: '100%', height: '100%', borderRadius: radius }}
        className="bg-sky-100"
      />
    )
  )

  if (!ring) {
    return (
      <div style={{ width: size, height: size, borderRadius: radius }}>{inner}</div>
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        padding: Math.max(2, Math.round(size * 0.06)),
        background: ring.background,
      }}
    >
      {inner}
    </div>
  )
}

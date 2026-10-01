'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getRecentlyViewed, RecentlyViewedCreator } from '@/lib/recentlyViewed'
import AvatarRing from '@/components/AvatarRing'

// 「最近見たクリエイター」の横スクロール一覧。履歴そのものはlocalStorageだけで完結する。
// アイコンリングは付け替えられることがあるため履歴には保存せず、表示するときに
// 今装着しているリングをまとめて1回だけ取得する。履歴が無い場合は何も表示しない。
export default function RecentlyViewedCreators() {
  const [items, setItems] = useState<RecentlyViewedCreator[]>([])
  const [ringMap, setRingMap] = useState<Record<string, string | null>>({})

  useEffect(() => {
    const list = getRecentlyViewed()
    setItems(list)
    if (list.length === 0) return

    let active = true
    supabase
      .from('public_equipped_rings')
      .select('user_id, equipped_ring_id')
      .in(
        'user_id',
        list.map((c) => c.userId)
      )
      .then(({ data }) => {
        if (!active || !data) return
        setRingMap(Object.fromEntries(data.map((r: any) => [r.user_id, r.equipped_ring_id])))
      })
    return () => {
      active = false
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
        🕐 最近見たクリエイター
      </h2>
      <div className="flex gap-3 overflow-x-auto py-2.5 -mx-2 px-2.5">
        {items.map((item) => (
          <Link
            key={item.userId}
            href={`/creator/${item.userId}`}
            className="shrink-0 w-20 flex flex-col items-center gap-1.5 group"
          >
            <div className="transition-transform group-hover:scale-105">
              <AvatarRing
                src={item.avatarUrl || item.thumbnailUrl}
                alt=""
                size={56}
                ringId={ringMap[item.userId]}
                fallback={
                  <div className="w-full h-full rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300 text-lg">
                    👤
                  </div>
                }
              />
            </div>
            <span className="text-[10px] font-bold text-slate-600 text-center line-clamp-1 w-full">
              {item.displayName}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

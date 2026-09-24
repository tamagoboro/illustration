'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getRecentlyViewed, RecentlyViewedCreator } from '@/lib/recentlyViewed'

// 「最近見たクリエイター」の横スクロール一覧。localStorageだけで完結するので、
// どのページに置いても追加の通信は発生しない。履歴が無い場合は何も表示しない。
export default function RecentlyViewedCreators() {
  const [items, setItems] = useState<RecentlyViewedCreator[]>([])

  useEffect(() => {
    setItems(getRecentlyViewed())
  }, [])

  if (items.length === 0) return null

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
        🕐 最近見たクリエイター
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {items.map((item) => (
          <Link
            key={item.userId}
            href={`/creator/${item.userId}`}
            className="shrink-0 w-20 flex flex-col items-center gap-1.5 group"
          >
            <div className="w-14 h-14 rounded-full overflow-hidden border border-slate-200 bg-slate-100 group-hover:border-sky-300 transition-colors">
              {item.avatarUrl || item.thumbnailUrl ? (
                <img
                  src={item.avatarUrl || item.thumbnailUrl || ''}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300 text-lg">👤</div>
              )}
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

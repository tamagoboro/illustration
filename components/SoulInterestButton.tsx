'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// 魂募集の「気になる」ボタン。押した人数を表示し、押すとクリエイターに通知が届く（DBのトリガー）
export default function SoulInterestButton({
  soulListingId,
  creatorId,
  size = 'md',
}: {
  soulListingId: string
  creatorId: string
  size?: 'md' | 'sm'
}) {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [interested, setInterested] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    supabase.rpc('get_soul_interest_count', { p_soul_listing_id: soulListingId }).then(({ data }) => {
      if (active && typeof data === 'number') setCount(data)
    })
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active || !data.user) return
      setUserId(data.user.id)
      const { data: row } = await supabase
        .from('soul_interests')
        .select('soul_listing_id')
        .eq('user_id', data.user.id)
        .eq('soul_listing_id', soulListingId)
        .maybeSingle()
      if (active) setInterested(!!row)
    })
    return () => {
      active = false
    }
  }, [soulListingId])

  const toggle = async () => {
    if (!userId) {
      router.push('/login')
      return
    }
    if (busy || userId === creatorId) return
    setBusy(true)
    const was = interested
    const { error } = was
      ? await supabase.from('soul_interests').delete().eq('user_id', userId).eq('soul_listing_id', soulListingId)
      : await supabase.from('soul_interests').insert({ user_id: userId, soul_listing_id: soulListingId })
    setBusy(false)
    if (error) {
      console.error('「気になる」の更新エラー:', error)
      return
    }
    setInterested(!was)
    setCount((c) => (c === null ? c : Math.max(0, c + (was ? -1 : 1))))
  }

  const isOwner = userId === creatorId
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || isOwner}
      aria-pressed={interested}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full border font-black transition-all active:scale-95 cursor-pointer disabled:cursor-default ${
        size === 'sm' ? 'h-12 px-4 text-xs' : 'w-full py-3 text-sm'
      } ${
        interested
          ? 'bg-pink-50 border-pink-300 text-pink-600'
          : 'bg-white border-slate-200 text-slate-600 hover:border-pink-300 hover:text-pink-600'
      }`}
    >
      <span className={interested ? 'scale-110' : ''}>{interested ? '💗' : '🤍'}</span>
      <span>{isOwner ? '気になる' : interested ? '気になる済み' : '気になる'}</span>
      {count !== null && count > 0 && <span className="tabular-nums opacity-80">{count}</span>}
    </button>
  )
}

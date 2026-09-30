'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// クリエイターのフォローボタン。フォローすると、受付再開・フィード投稿・キャンペーン開始が通知で届く。
// 「お気に入り」は比較・保存用、「フォロー」は新着を通知で受け取るため、という役割分担。
export default function FollowButton({
  creatorId,
  currentUserId,
}: {
  creatorId: string
  currentUserId: string | null
}) {
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let isMounted = true
    supabase.rpc('get_follower_count', { p_creator_id: creatorId }).then(({ data }) => {
      if (isMounted && typeof data === 'number') setFollowerCount(data)
    })
    if (currentUserId) {
      supabase
        .from('creator_follows')
        .select('creator_id')
        .eq('follower_id', currentUserId)
        .eq('creator_id', creatorId)
        .maybeSingle()
        .then(({ data }) => {
          if (isMounted) setIsFollowing(!!data)
        })
    }
    return () => {
      isMounted = false
    }
  }, [creatorId, currentUserId])

  // 自分自身はフォローできない
  if (currentUserId === creatorId) return null

  if (!currentUserId) {
    return (
      <Link
        href="/login"
        className="w-full py-2.5 text-xs font-bold rounded-xl border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 transition-all flex items-center justify-center gap-2"
      >
        <span>🔔</span>
        <span>ログインしてフォロー</span>
      </Link>
    )
  }

  const handleToggle = async () => {
    if (busy) return
    setBusy(true)
    const wasFollowing = isFollowing
    const { error } = wasFollowing
      ? await supabase.from('creator_follows').delete().eq('follower_id', currentUserId).eq('creator_id', creatorId)
      : await supabase.from('creator_follows').insert({ follower_id: currentUserId, creator_id: creatorId })
    setBusy(false)

    if (error) {
      console.error('フォローの更新エラー:', error)
      alert('フォローの更新に失敗しました')
      return
    }
    setIsFollowing(!wasFollowing)
    setFollowerCount((c) => (c === null ? c : Math.max(0, c + (wasFollowing ? -1 : 1))))
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={busy}
      className={`w-full py-2.5 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 ${
        isFollowing
          ? 'bg-sky-500 border-sky-500 text-white hover:bg-sky-600'
          : 'bg-white border-sky-200 text-sky-700 hover:bg-sky-50'
      }`}
    >
      <span>{isFollowing ? '✓' : '🔔'}</span>
      <span>
        {isFollowing ? 'フォロー中' : 'フォローして新着を受け取る'}
        {followerCount !== null && followerCount > 0 && ` (${followerCount})`}
      </span>
    </button>
  )
}

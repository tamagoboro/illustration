'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BlockKind, BLOCK_KIND_LABELS, setUserBlock, removeUserBlock } from '@/lib/userBlocks'

// クリエイターページに置く、ミュート／ブロックの小さなボタン。フィードの「⋯」メニューと同じ user_blocks を使う。
// ログインしていない人と本人には出さない。
export default function UserBlockButtons({
  targetUserId,
  targetName,
  currentUserId,
}: {
  targetUserId: string
  targetName: string
  currentUserId: string | null
}) {
  const [kind, setKind] = useState<BlockKind | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!currentUserId || currentUserId === targetUserId) return
    let isMounted = true
    supabase
      .from('user_blocks')
      .select('kind')
      .eq('user_id', currentUserId)
      .eq('target_id', targetUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (isMounted) setKind((data?.kind as BlockKind | undefined) ?? null)
      })
    return () => {
      isMounted = false
    }
  }, [currentUserId, targetUserId])

  if (!currentUserId || currentUserId === targetUserId) return null

  const handleSet = async (next: BlockKind) => {
    if (busy) return
    const message =
      next === 'block'
        ? `${targetName}さんをブロックしますか？\n\n・相手の投稿・コメントがフィードに表示されなくなります\n・相手は、あなたの投稿へのコメント・いいねと、あなたのフォローができなくなります\n・お互いのフォローは外れます`
        : `${targetName}さんをミュートしますか？\n\n・相手の投稿・コメントがフィードに表示されなくなります（相手には伝わりません）`
    if (!confirm(message)) return

    setBusy(true)
    const ok = await setUserBlock(currentUserId, targetUserId, next)
    setBusy(false)
    if (!ok) {
      alert('設定に失敗しました。時間をおいて再度お試しください。')
      return
    }
    setKind(next)
  }

  const handleRemove = async () => {
    if (busy) return
    setBusy(true)
    const ok = await removeUserBlock(currentUserId, targetUserId)
    setBusy(false)
    if (!ok) {
      alert('解除に失敗しました。時間をおいて再度お試しください。')
      return
    }
    setKind(null)
  }

  const buttonClass =
    'py-1.5 text-[10px] font-bold text-slate-300 hover:text-slate-600 transition-colors cursor-pointer disabled:opacity-50'

  if (kind) {
    return (
      <button type="button" onClick={handleRemove} disabled={busy} className={`w-full ${buttonClass}`}>
        {kind === 'block' ? '🚫' : '🔇'} {BLOCK_KIND_LABELS[kind]}中（押すと解除）
      </button>
    )
  }

  return (
    <div className="flex items-center justify-center gap-4">
      <button type="button" onClick={() => handleSet('mute')} disabled={busy} className={buttonClass}>
        🔇 ミュートする
      </button>
      <button type="button" onClick={() => handleSet('block')} disabled={busy} className={buttonClass}>
        🚫 ブロックする
      </button>
    </div>
  )
}

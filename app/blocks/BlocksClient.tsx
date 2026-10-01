'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { backgroundImageStyle } from '@/lib/background'
import SimpleHeader from '@/components/SimpleHeader'
import { BlockKind, BLOCK_KIND_LABELS, setUserBlock, removeUserBlock } from '@/lib/userBlocks'

type BlockedUser = {
  target_id: string
  kind: BlockKind
  created_at: string
  display_name: string | null
  avatar_url: string | null
}

// 自分がブロック・ミュートしている相手の一覧と解除。
// ブロック・ミュートした相手の投稿やコメントは画面に出なくなるので、解除はここから行う。
export default function BlocksClient() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<BlockedUser[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data?.user?.id || null
      setUserId(uid)
      if (uid) await loadUsers(uid)
      setLoading(false)
    }
    init()
  }, [])

  const loadUsers = async (uid: string) => {
    const { data, error } = await supabase
      .from('user_blocks')
      .select('target_id, kind, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('ブロック・ミュートの取得エラー:', error)
      return
    }

    const rows = (data || []) as { target_id: string; kind: BlockKind; created_at: string }[]
    const profileMap: Record<string, { display_name: string | null; avatar_url: string | null }> = {}
    if (rows.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', rows.map((r) => r.target_id))
      ;(profiles || []).forEach((p: any) => {
        profileMap[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url }
      })
    }

    setUsers(
      rows.map((r) => ({
        ...r,
        display_name: profileMap[r.target_id]?.display_name || null,
        avatar_url: profileMap[r.target_id]?.avatar_url || null,
      }))
    )
  }

  const handleChangeKind = async (target: BlockedUser, kind: BlockKind) => {
    if (!userId) return
    setBusyId(target.target_id)
    const ok = await setUserBlock(userId, target.target_id, kind)
    setBusyId(null)
    if (!ok) {
      alert('変更に失敗しました。時間をおいて再度お試しください。')
      return
    }
    setUsers((prev) => prev.map((u) => (u.target_id === target.target_id ? { ...u, kind } : u)))
  }

  const handleRemove = async (target: BlockedUser) => {
    if (!userId) return
    setBusyId(target.target_id)
    const ok = await removeUserBlock(userId, target.target_id)
    setBusyId(null)
    if (!ok) {
      alert('解除に失敗しました。時間をおいて再度お試しください。')
      return
    }
    setUsers((prev) => prev.filter((u) => u.target_id !== target.target_id))
  }

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="ブロック・ミュート" />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 space-y-5">
        <div className="px-1 space-y-1">
          <Link
            href="/feed"
            className="inline-flex items-center gap-1.5 text-[11px] font-black text-sky-700 bg-white/90 hover:bg-white border border-white/70 px-4 py-2 rounded-full shadow-2xs transition"
          >
            ← フィードに戻る
          </Link>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight drop-shadow-sm pt-3">ブロック・ミュートの管理</h1>
        </div>

        <div className="bg-white/90 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-white/70 shadow-sm space-y-1.5 text-[11px] font-bold text-slate-500 leading-relaxed">
          <p>
            <span className="text-slate-800 font-black">🔇 ミュート</span>
            ：相手の投稿・コメントが表示されなくなります。相手には伝わりません。
          </p>
          <p>
            <span className="text-slate-800 font-black">🚫 ブロック</span>
            ：ミュートに加えて、相手はあなたの投稿へのコメント・いいね、あなたのフォローができなくなります。
          </p>
        </div>

        {loading ? (
          <p className="text-xs text-slate-600 font-bold drop-shadow-sm text-center py-8">読み込み中...</p>
        ) : !userId ? (
          <div className="text-center py-12 px-4 bg-white/85 backdrop-blur-md rounded-3xl border border-white/70 space-y-3">
            <p className="text-sm font-black text-slate-600">ログインが必要です</p>
            <Link
              href="/login"
              className="inline-block text-xs font-black text-white bg-sky-500 hover:bg-sky-600 px-5 py-2.5 rounded-full shadow-sm transition"
            >
              ログインする
            </Link>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white/85 backdrop-blur-md rounded-3xl border border-white/70 space-y-2">
            <p className="text-sm font-black text-slate-600">ブロック・ミュートしているユーザーはいません</p>
            <p className="text-[11px] text-slate-400 font-bold">
              フィードの投稿やコメントの「⋯」から、ミュート・ブロックができます
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((u) => {
              const name = u.display_name || 'ユーザー'
              const otherKind: BlockKind = u.kind === 'block' ? 'mute' : 'block'
              return (
                <div
                  key={u.target_id}
                  className="bg-white/95 backdrop-blur-md rounded-3xl p-4 border border-white/70 shadow-sm flex items-center justify-between gap-3 flex-wrap"
                >
                  <Link href={`/creator/${u.target_id}`} className="flex items-center gap-3 min-w-0 group">
                    <div className="shrink-0 w-10 h-10 rounded-full overflow-hidden bg-sky-100 border border-sky-100">
                      {u.avatar_url && <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 group-hover:text-sky-600 transition-colors truncate">{name}</p>
                      <p className="text-[10px] font-bold text-slate-400">
                        {u.kind === 'block' ? '🚫' : '🔇'} {BLOCK_KIND_LABELS[u.kind]}中
                      </p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleChangeKind(u, otherKind)}
                      disabled={busyId === u.target_id}
                      className="text-[11px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition cursor-pointer disabled:opacity-50"
                    >
                      {BLOCK_KIND_LABELS[otherKind]}に変更
                    </button>
                    <button
                      onClick={() => handleRemove(u)}
                      disabled={busyId === u.target_id}
                      className="text-[11px] font-black text-sky-600 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-full transition cursor-pointer disabled:opacity-50"
                    >
                      解除する
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

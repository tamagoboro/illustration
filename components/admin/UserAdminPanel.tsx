'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useIconRings } from '@/lib/iconRings'
import CreatorImageManager, { ManagedUser } from './CreatorImageManager'

// ユーザー1人分の管理操作（ポイント・リング付与・画像の変更）をまとめたパネル。
// 「ユーザー管理」の一覧で名前をクリックしたときと、検索結果の表示の両方で使う。
export default function UserAdminPanel({
  user,
  onAvatarChanged,
}: {
  user: ManagedUser
  onAvatarChanged?: (avatarUrl: string | null) => void
}) {
  const iconRings = useIconRings()

  const [balance, setBalance] = useState<number | null>(null)
  const [pointAmount, setPointAmount] = useState('50')
  const [pointReason, setPointReason] = useState('')
  const [applyingPoints, setApplyingPoints] = useState(false)

  const [selectedRingId, setSelectedRingId] = useState('')
  const [grantingRing, setGrantingRing] = useState(false)

  const [message, setMessage] = useState('')

  // 残高は admin_search_users（ユーザーID一致）から取得する
  const refreshBalance = async () => {
    const { data } = await supabase.rpc('admin_search_users', { p_query: user.user_id })
    const row = (data || []).find((u: { user_id: string }) => u.user_id === user.user_id)
    setBalance(row ? (row.balance as number) : null)
  }

  useEffect(() => {
    setMessage('')
    refreshBalance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.user_id])

  const handleApplyPoints = async () => {
    const amount = Number(pointAmount)
    if (!Number.isFinite(amount) || amount === 0) {
      setMessage('数値（0以外）を入力してください。')
      return
    }

    setApplyingPoints(true)
    setMessage('')
    const { error } = await supabase.rpc('admin_adjust_points', {
      p_user_id: user.user_id,
      p_amount: amount,
      p_reason: pointReason.trim() || null,
    })
    setApplyingPoints(false)

    if (error) {
      console.error('ポイント操作エラー:', error)
      setMessage('ポイント操作に失敗しました。' + error.message)
      return
    }
    setMessage(`${amount > 0 ? '+' : ''}${amount}pt 反映しました。`)
    setPointReason('')
    await refreshBalance()
  }

  const handleGrantRing = async () => {
    if (!selectedRingId) return

    setGrantingRing(true)
    setMessage('')
    const { error } = await supabase.rpc('admin_grant_ring', {
      p_user_id: user.user_id,
      p_ring_id: selectedRingId,
    })
    setGrantingRing(false)

    if (error) {
      console.error('リング付与エラー:', error)
      setMessage('リング付与に失敗しました。' + error.message)
      return
    }
    setMessage('リングを付与しました。')
    setSelectedRingId('')
  }

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-5">
      {message && (
        <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-100 text-xs font-bold text-sky-700">{message}</div>
      )}

      {/* ポイント操作 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">ポイントを操作</h3>
          <span className="text-[11px] font-bold text-sky-600">
            {balance === null ? '' : `現在 ${balance.toLocaleString()} pt`}
          </span>
        </div>
        <p className="text-[10px] text-slate-400">プラスで付与、マイナスで減算します（残高は0未満になりません）。</p>
        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-2">
          <input
            type="number"
            value={pointAmount}
            onChange={(e) => setPointAmount(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
            placeholder="例: 50 / -50"
          />
          <input
            type="text"
            value={pointReason}
            onChange={(e) => setPointReason(e.target.value)}
            placeholder="理由（任意・履歴に記録されます）"
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
          />
        </div>
        <button
          onClick={handleApplyPoints}
          disabled={applyingPoints}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
        >
          {applyingPoints ? '処理中...' : '反映する'}
        </button>
      </section>

      {/* リング付与 */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">アイコンリングを付与</h3>
        <p className="text-[10px] text-slate-400">購入させずに直接付与します（ポイントは消費されません）。</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={selectedRingId}
            onChange={(e) => setSelectedRingId(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
          >
            <option value="">リングを選択...</option>
            {iconRings.map((ring) => (
              <option key={ring.id} value={ring.id}>
                {ring.name}（{ring.cost}pt相当）
              </option>
            ))}
          </select>
          <button
            onClick={handleGrantRing}
            disabled={grantingRing || !selectedRingId}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 shrink-0"
          >
            {grantingRing ? '処理中...' : '付与する'}
          </button>
        </div>
      </section>

      {/* 画像の変更 */}
      <section className="space-y-2">
        <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">画像の変更・削除</h3>
        <CreatorImageManager user={user} onChanged={(info) => onAvatarChanged?.(info.avatar_url)} />
      </section>
    </div>
  )
}

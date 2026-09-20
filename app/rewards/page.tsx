'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useIconRings, isRingAvailableNow } from '@/lib/iconRings'
import AvatarRing from '@/components/AvatarRing'

export default function RewardsPage() {
  const iconRings = useIconRings()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [balance, setBalance] = useState(0)
  const [equippedRingId, setEquippedRingId] = useState<string | null>(null)
  const [ownedRingIds, setOwnedRingIds] = useState<string[]>([])
  const [busyRingId, setBusyRingId] = useState<string | null>(null)
  const [referralCount, setReferralCount] = useState(0)
  const [linkCopied, setLinkCopied] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const refreshWallet = async (uid: string) => {
    // 互いに依存しないので並行実行（直列だと通信の往復時間が2倍かかる）
    const [walletRes, ownedRes] = await Promise.all([
      supabase.from('user_points').select('balance, equipped_ring_id').eq('user_id', uid).maybeSingle(),
      supabase.from('user_icon_rings').select('ring_id').eq('user_id', uid),
    ])

    setBalance(walletRes.data?.balance ?? 0)
    setEquippedRingId(walletRes.data?.equipped_ring_id ?? null)
    setOwnedRingIds((ownedRes.data || []).map((r) => r.ring_id))
  }

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data?.user?.id || null
      setUserId(uid)

      if (uid) {
        // 残高に影響しない項目とウェルカムボーナス付与は互いに依存しないため並行実行。
        // 残高の読み取りだけは、ボーナス付与が確実に終わってから行う必要があるので
        // このあとの refreshWallet で改めて直列にする。
        const [profileRes, adminRes, referralRes] = await Promise.all([
          supabase.from('profiles').select('avatar_url').eq('user_id', uid).maybeSingle(),
          supabase.from('admins').select('user_id').eq('user_id', uid).maybeSingle(),
          supabase.from('referrals').select('id', { count: 'exact', head: true }).eq('referrer_id', uid),
          // 初回アクセス時のウェルカムボーナス（DB側で1人1回だけになるよう制御済み）
          supabase.rpc('grant_starter_bonus').then(({ error }) => {
            if (error) console.error('ウェルカムボーナス付与エラー:', error)
          }),
        ])

        setAvatarUrl(profileRes.data?.avatar_url || null)
        setIsAdmin(!!adminRes.data)
        setReferralCount(referralRes.count || 0)

        await refreshWallet(uid)
      }

      setLoading(false)
    }
    init()
  }, [])

  const handlePurchase = async (ringId: string) => {
    if (!userId) return
    setBusyRingId(ringId)

    const { error } = await supabase.rpc('purchase_ring', { p_ring_id: ringId })

    setBusyRingId(null)

    if (error) {
      console.error('リング購入エラー:', error)
      alert(error.message?.includes('ポイントが不足')
        ? 'ポイントが不足しています。'
        : '購入に失敗しました。通信環境をご確認のうえ、もう一度お試しください。')
      return
    }

    await refreshWallet(userId)
  }

  const handleEquip = async (ringId: string | null) => {
    if (!userId) return
    setBusyRingId(ringId ?? 'none')

    const { error } = await supabase.rpc('equip_ring', { p_ring_id: ringId })

    setBusyRingId(null)

    if (error) {
      console.error('リング装着エラー:', error)
      alert('装着に失敗しました。通信環境をご確認のうえ、もう一度お試しください。')
      return
    }

    setEquippedRingId(ringId)
  }

  const referralLink = userId && typeof window !== 'undefined'
    ? `${window.location.origin}/login?ref=${userId}`
    : ''

  const handleCopyReferralLink = () => {
    if (!referralLink) return
    navigator.clipboard.writeText(referralLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  if (loading) {
    return <div className="p-8 text-center text-xs font-bold text-slate-400">読み込み中...</div>
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center space-y-3 max-w-sm w-full">
          <p className="text-sm font-bold text-slate-700">マイページはログインが必要です</p>
          <Link
            href="/login"
            className="inline-block px-5 py-2.5 bg-gradient-to-r from-sky-400 to-cyan-400 text-white font-bold text-xs rounded-xl shadow-sm"
          >
            ログイン / 新規登録
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-24">
      <header className="px-4 sm:px-6 py-3.5 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
            <span>←</span> サイトトップへ
          </Link>
          <h1 className="text-sm font-bold text-slate-900">マイページ・ポイント</h1>
          {isAdmin ? (
            <Link
              href="/admin/rings"
              className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors"
            >
              リング管理
            </Link>
          ) : (
            <span className="w-[3.5rem]" />
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* 残高・現在の装着状況 */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center gap-5">
          <AvatarRing
            src={avatarUrl}
            alt="自分のアイコン"
            size={72}
            ringId={equippedRingId}
            fallback={<div className="w-full h-full rounded-full bg-sky-100 flex items-center justify-center text-2xl">👤</div>}
          />
          <div className="flex-1 text-center sm:text-left">
            <span className="text-[11px] font-bold text-slate-400 block">保有ポイント</span>
            <span className="text-2xl font-black text-sky-600">{balance.toLocaleString()} pt</span>
          </div>
          {equippedRingId && (
            <button
              onClick={() => handleEquip(null)}
              disabled={busyRingId === 'none'}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              リングを外す
            </button>
          )}
        </div>

        {/* 友達紹介 */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">🎁 友達を紹介する</h2>
            <span className="text-[11px] font-bold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200">
              紹介した人数: {referralCount}人
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            このリンクから新規登録すると、あなたと登録した相手の両方に50ptプレゼントされます。
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              readOnly
              value={referralLink}
              onClick={(e) => e.currentTarget.select()}
              className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-mono text-slate-600"
            />
            <button
              onClick={handleCopyReferralLink}
              className="px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl transition cursor-pointer shrink-0"
            >
              {linkCopied ? '✓ コピーしました' : 'リンクをコピー'}
            </button>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-sky-50 border border-sky-100 text-xs text-sky-700 leading-relaxed">
          💡 新規登録すると、ログイン特典として100ptも進呈されます。
        </div>

        {/* リングショップ */}
        <div className="space-y-3">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">アイコンリング ショップ</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {iconRings
              .filter((ring) => ownedRingIds.includes(ring.id) || isRingAvailableNow(ring))
              .map((ring) => {
              const owned = ownedRingIds.includes(ring.id)
              const equipped = equippedRingId === ring.id
              const canAfford = balance >= ring.cost

              return (
                <div key={ring.id} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
                  <AvatarRing
                    src={avatarUrl}
                    alt={ring.name}
                    size={56}
                    ringId={ring.id}
                    fallback={<div className="w-full h-full rounded-full bg-sky-100 flex items-center justify-center text-lg">👤</div>}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-black text-slate-800 block">{ring.name}</span>
                    <span className="text-[11px] text-slate-400">{ring.cost.toLocaleString()} pt</span>
                  </div>
                  {owned ? (
                    <button
                      onClick={() => handleEquip(equipped ? null : ring.id)}
                      disabled={busyRingId === ring.id}
                      className={`px-3.5 py-2 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 shrink-0 ${
                        equipped
                          ? 'bg-sky-500 text-white'
                          : 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100'
                      }`}
                    >
                      {equipped ? '装着中' : '装着する'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePurchase(ring.id)}
                      disabled={!canAfford || busyRingId === ring.id}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-40 shrink-0"
                    >
                      {busyRingId === ring.id ? '購入中...' : canAfford ? '購入する' : 'pt不足'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

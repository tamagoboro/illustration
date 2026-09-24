'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useIconRings, isRingAvailableNow } from '@/lib/iconRings'
import AvatarRing from '@/components/AvatarRing'
import NotificationBell from '@/components/NotificationBell'
import RecentlyViewedCreators from '@/components/RecentlyViewedCreators'
import { backgroundImageStyle } from '@/lib/background'

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
  const [sentRequests, setSentRequests] = useState<
    { id: string; creator_id: string; content: string; status: string; creator_response: string | null; created_at: string; creator_display_name?: string | null }[]
  >([])
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [hasDashboardSetup, setHasDashboardSetup] = useState(false)

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

  const refreshSentRequests = async (uid: string) => {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('client_id', uid)
      .order('created_at', { ascending: false })

    if (error || !data) {
      if (error) console.error('送信済みリクエストの取得エラー:', error)
      return
    }

    const creatorIds = Array.from(new Set(data.map((r: any) => r.creator_id)))
    const nameMap: Record<string, string> = {}
    if (creatorIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', creatorIds)
      ;(profilesData || []).forEach((p: any) => {
        nameMap[p.user_id] = p.display_name
      })
    }

    setSentRequests(data.map((r: any) => ({ ...r, creator_display_name: nameMap[r.creator_id] || null })))
  }

  const cancelRequest = async (id: string) => {
    if (!confirm('このリクエストを取り下げますか？')) return
    setBusyRequestId(id)
    const { error } = await supabase.from('requests').update({ status: 'cancelled' }).eq('id', id)
    setBusyRequestId(null)

    if (error) {
      console.error('リクエストのキャンセルエラー:', error)
      alert('キャンセルに失敗しました。時間をおいて再度お試しください。')
      return
    }
    setSentRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)))
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
          supabase.from('profiles').select('avatar_url, has_dashboard_setup').eq('user_id', uid).maybeSingle(),
          supabase.from('admins').select('user_id').eq('user_id', uid).maybeSingle(),
          supabase.from('referrals').select('id', { count: 'exact', head: true }).eq('referrer_id', uid),
          // 初回アクセス時のウェルカムボーナス（DB側で1人1回だけになるよう制御済み）
          supabase.rpc('grant_starter_bonus').then(({ error }) => {
            if (error) console.error('ウェルカムボーナス付与エラー:', error)
          }),
        ])

        setAvatarUrl(profileRes.data?.avatar_url || null)
        setHasDashboardSetup(!!profileRes.data?.has_dashboard_setup)
        setIsAdmin(!!adminRes.data)
        setReferralCount(referralRes.count || 0)

        await refreshWallet(uid)
        await refreshSentRequests(uid)
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
      <div className="min-h-screen flex items-center justify-center p-4 relative bg-cover bg-center" style={backgroundImageStyle}>
        <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
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

  // 残高・現在の装着状況
  const walletSection = (
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
  )

  // 友達紹介
  const referralSection = (
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
  )

  const loginBonusTip = (
    <div className="p-4 rounded-2xl bg-sky-50 border border-sky-100 text-xs text-sky-700 leading-relaxed">
      💡 新規登録すると、ログイン特典として100ptも進呈されます。
    </div>
  )

  // 送信したリクエスト
  const sentRequestsSection = sentRequests.length > 0 && (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
      <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">📩 送ったリクエスト</h2>
      <div className="space-y-2">
        {sentRequests.map((r) => (
          <div
            key={r.id}
            className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 space-y-1.5"
          >
            <Link href={`/creator/${r.creator_id}`} className="block hover:opacity-80 transition-opacity space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-800">{r.creator_display_name || 'クリエイター'}</span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    r.status === 'pending'
                      ? 'bg-amber-100 text-amber-700'
                      : r.status === 'accepted'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {r.status === 'pending' ? '未回答' : r.status === 'accepted' ? '承諾済み' : r.status === 'declined' ? '辞退済み' : 'キャンセル済み'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-2">{r.content}</p>
              {r.creator_response && (
                <p className="text-[11px] text-sky-600 border-t border-slate-200 pt-1.5">
                  返信: {r.creator_response}
                </p>
              )}
            </Link>
            {r.status === 'pending' && (
              <button
                type="button"
                onClick={() => cancelRequest(r.id)}
                disabled={busyRequestId === r.id}
                className="text-[10px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer disabled:opacity-50"
              >
                {busyRequestId === r.id ? '処理中...' : 'このリクエストを取り下げる'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  // リングショップ
  const ringShopSection = (
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
  )

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <header className="px-4 sm:px-6 py-3.5 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
            <span>←</span> サイトトップへ
          </Link>
          <h1 className="text-sm font-bold text-slate-900">マイページ・ポイント</h1>
          <div className="flex items-center gap-3">
            <NotificationBell />
            {isAdmin && (
              <Link
                href="/admin/rings"
                className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors"
              >
                リング管理
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* クリエイター未登録の人への案内 */}
        {!hasDashboardSetup && (
          <div className="bg-gradient-to-r from-sky-50 to-cyan-50 rounded-3xl border border-sky-100 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎨</span>
              <div>
                <p className="text-xs font-extrabold text-slate-900">クリエイターとして活動してみませんか？</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ポートフォリオや料金メニューを登録すると、依頼者から見つけてもらえるようになります。依頼者としての利用はそのまま続けられます。
                </p>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="shrink-0 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              クリエイター登録する
            </Link>
          </div>
        )}

        {/* 依頼者アカウントの場合は「送ったリクエスト」「最近見たクリエイター」を先に見せる。
            クリエイターアカウントの場合は今まで通りポイント関連を先に見せる */}
        {!hasDashboardSetup && (
          <>
            {sentRequestsSection}
            <RecentlyViewedCreators />
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-2">
              <p className="text-xs font-black text-slate-700">クリエイターを探す</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/match" className="px-3 py-1.5 rounded-full bg-violet-50 text-violet-600 text-[11px] font-bold hover:bg-violet-100 transition-colors">
                  🔮 かんたん診断
                </Link>
                <Link href="/gallery" className="px-3 py-1.5 rounded-full bg-sky-50 text-sky-600 text-[11px] font-bold hover:bg-sky-100 transition-colors">
                  🖼 新着作品
                </Link>
                <Link href="/ranking" className="px-3 py-1.5 rounded-full bg-orange-50 text-orange-600 text-[11px] font-bold hover:bg-orange-100 transition-colors">
                  📊 注目クリエイター
                </Link>
                <Link href="/market" className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-bold hover:bg-emerald-100 transition-colors">
                  💰 相場マップ
                </Link>
                <Link href="/favorites" className="px-3 py-1.5 rounded-full bg-rose-50 text-rose-600 text-[11px] font-bold hover:bg-rose-100 transition-colors">
                  ♥ お気に入り一覧
                </Link>
              </div>
            </div>
          </>
        )}

        {walletSection}

        {hasDashboardSetup && <RecentlyViewedCreators />}

        {referralSection}
        {loginBonusTip}

        {hasDashboardSetup && sentRequestsSection}

        {ringShopSection}
      </div>
    </div>
  )
}

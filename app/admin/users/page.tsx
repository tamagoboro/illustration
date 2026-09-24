'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useIconRings } from '@/lib/iconRings'
import AvatarRing from '@/components/AvatarRing'
import { backgroundImageStyle } from '@/lib/background'

type FoundUser = {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  balance: number
}

export default function AdminUsersPage() {
  const iconRings = useIconRings()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [results, setResults] = useState<FoundUser[]>([])
  const [found, setFound] = useState<FoundUser | null>(null)

  const [pointAmount, setPointAmount] = useState('50')
  const [pointReason, setPointReason] = useState('')
  const [applyingPoints, setApplyingPoints] = useState(false)

  const [selectedRingId, setSelectedRingId] = useState('')
  const [grantingRing, setGrantingRing] = useState(false)

  const [message, setMessage] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data?.user?.id || null
      setLoggedIn(!!uid)

      if (uid) {
        const { data: adminRow } = await supabase
          .from('admins')
          .select('user_id')
          .eq('user_id', uid)
          .maybeSingle()
        setIsAdmin(!!adminRow)
      }
      setChecking(false)
    }
    init()
  }, [])

  const handleSearch = async () => {
    setSearchError('')
    setMessage('')
    if (!query.trim()) return

    setSearching(true)
    setFound(null)
    setResults([])
    const { data, error } = await supabase.rpc('admin_search_users', { p_query: query.trim() })
    setSearching(false)

    if (error) {
      console.error('ユーザー検索エラー:', error)
      setSearchError('検索に失敗しました。')
      return
    }
    if (!data || data.length === 0) {
      setSearchError('該当するユーザーが見つかりませんでした。')
      return
    }
    if (data.length === 1) {
      setFound(data[0])
    } else {
      setResults(data)
    }
  }

  const refreshFound = async () => {
    if (!found) return
    const { data } = await supabase.rpc('admin_search_users', { p_query: found.user_id })
    if (data && data.length > 0) setFound(data.find((u: FoundUser) => u.user_id === found.user_id) || data[0])
  }

  const handleApplyPoints = async () => {
    if (!found) return
    const amount = Number(pointAmount)
    if (!Number.isFinite(amount) || amount === 0) {
      setMessage('数値（0以外）を入力してください。')
      return
    }

    setApplyingPoints(true)
    setMessage('')
    const { error } = await supabase.rpc('admin_adjust_points', {
      p_user_id: found.user_id,
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
    await refreshFound()
  }

  const handleGrantRing = async () => {
    if (!found || !selectedRingId) return

    setGrantingRing(true)
    setMessage('')
    const { error } = await supabase.rpc('admin_grant_ring', {
      p_user_id: found.user_id,
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

  if (checking) {
    return <div className="p-8 text-center text-xs font-bold text-slate-400">読み込み中...</div>
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative bg-cover bg-center" style={backgroundImageStyle}>
        <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center space-y-3 max-w-sm w-full">
          <p className="text-sm font-bold text-slate-700">ログインが必要です</p>
          <Link
            href="/login"
            className="inline-block px-5 py-2.5 bg-gradient-to-r from-sky-400 to-cyan-400 text-white font-bold text-xs rounded-xl shadow-sm"
          >
            ログイン
          </Link>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative bg-cover bg-center" style={backgroundImageStyle}>
        <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center space-y-2 max-w-sm w-full">
          <p className="text-sm font-bold text-slate-700">このページへのアクセス権がありません</p>
          <p className="text-xs text-slate-400">管理者アカウントでログインしてください。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <header className="px-4 sm:px-6 py-3.5 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <Link href="/rewards" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
            <span>←</span> マイページへ
          </Link>
          <h1 className="text-sm font-bold text-slate-900">ユーザー管理</h1>
          <div className="flex items-center gap-3">
            <Link href="/admin/analytics" className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors">
              PV解析
            </Link>
            <Link href="/admin/rings" className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors">
              リング管理
            </Link>
            <Link href="/admin/reports" className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors">
              通報管理
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {/* 検索 */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">名前またはユーザーIDでユーザーを検索</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="表示名の一部、またはユーザーID"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 shrink-0"
            >
              {searching ? '検索中...' : '検索'}
            </button>
          </div>
          {searchError && <p className="text-[11px] font-bold text-rose-500">{searchError}</p>}
        </div>

        {/* 複数件ヒットしたときの候補一覧 */}
        {results.length > 0 && !found && (
          <div className="bg-white rounded-3xl p-3 border border-slate-100 shadow-sm space-y-1">
            <p className="text-[11px] font-bold text-slate-400 px-2 pt-1">{results.length}件見つかりました。選んでください。</p>
            {results.map((u) => (
              <button
                key={u.user_id}
                onClick={() => {
                  setFound(u)
                  setResults([])
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-50 transition cursor-pointer text-left"
              >
                <AvatarRing
                  src={u.avatar_url}
                  alt=""
                  size={36}
                  fallback={<div className="w-full h-full rounded-full bg-sky-100 flex items-center justify-center text-sm">👤</div>}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-slate-800 block truncate">{u.display_name || '（表示名未設定）'}</span>
                  <span className="text-[10px] text-slate-400 block truncate">{u.user_id}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {found && (
          <>
            {/* 対象ユーザー情報 */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
              <AvatarRing
                src={found.avatar_url}
                alt=""
                size={56}
                fallback={<div className="w-full h-full rounded-full bg-sky-100 flex items-center justify-center text-lg">👤</div>}
              />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-black text-slate-800 block truncate">
                  {found.display_name || '（表示名未設定）'}
                </span>
                <span className="text-[11px] font-bold text-sky-600">{found.balance.toLocaleString()} pt</span>
              </div>
              <button
                onClick={() => {
                  setFound(null)
                  setResults([])
                  setMessage('')
                }}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-600 shrink-0 cursor-pointer"
              >
                別のユーザーを検索
              </button>
            </div>

            {message && (
              <div className="p-3 rounded-2xl bg-sky-50 border border-sky-100 text-xs font-bold text-sky-700">
                {message}
              </div>
            )}

            {/* ポイント操作 */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">ポイントを操作</h2>
              <p className="text-[10px] text-slate-400">プラスで付与、マイナスで減算します（残高は0未満になりません）。</p>
              <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-2">
                <input
                  type="number"
                  value={pointAmount}
                  onChange={(e) => setPointAmount(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  placeholder="例: 50 / -50"
                />
                <input
                  type="text"
                  value={pointReason}
                  onChange={(e) => setPointReason(e.target.value)}
                  placeholder="理由（任意・履歴に記録されます）"
                  className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <button
                onClick={handleApplyPoints}
                disabled={applyingPoints}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                {applyingPoints ? '処理中...' : '反映する'}
              </button>
            </div>

            {/* リング付与 */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">アイコンリングを付与</h2>
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
            </div>
          </>
        )}
      </div>
    </div>
  )
}

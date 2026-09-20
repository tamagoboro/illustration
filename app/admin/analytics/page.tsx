'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type CreatorStatRow = {
  user_id: string
  display_name: string | null
  is_public: boolean
  status: string | null
  pv_7d: number
  pv_30d: number
  pv_total: number
  inquiry_30d: number
  new_favorites_7d: number
}

type SortKey = 'pv_7d' | 'pv_30d' | 'pv_total' | 'inquiry_30d' | 'new_favorites_7d'

export default function AdminAnalyticsPage() {
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)

  const [rows, setRows] = useState<CreatorStatRow[]>([])
  const [loadingRows, setLoadingRows] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('pv_30d')

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

        if (adminRow) {
          await refreshStats()
        }
      }
      setChecking(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshStats = async () => {
    setLoadingRows(true)
    setLoadError('')
    const { data, error } = await supabase.rpc('admin_get_creator_pv_stats')
    setLoadingRows(false)

    if (error) {
      console.error('PV統計の取得エラー:', error)
      setLoadError('データの取得に失敗しました。' + error.message)
      return
    }
    setRows((data || []) as CreatorStatRow[])
  }

  const visibleRows = useMemo(() => {
    const filtered = rows.filter((r) =>
      (r.display_name || '').toLowerCase().includes(query.toLowerCase())
    )
    return [...filtered].sort((a, b) => b[sortKey] - a[sortKey])
  }, [rows, query, sortKey])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        pv_7d: acc.pv_7d + r.pv_7d,
        pv_30d: acc.pv_30d + r.pv_30d,
        inquiry_30d: acc.inquiry_30d + r.inquiry_30d,
      }),
      { pv_7d: 0, pv_30d: 0, inquiry_30d: 0 }
    )
  }, [rows])

  if (checking) {
    return <div className="p-8 text-center text-xs font-bold text-slate-400">読み込み中...</div>
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center space-y-2 max-w-sm w-full">
          <p className="text-sm font-bold text-slate-700">このページへのアクセス権がありません</p>
          <p className="text-xs text-slate-400">管理者アカウントでログインしてください。</p>
        </div>
      </div>
    )
  }

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'pv_30d', label: '30日PV' },
    { key: 'pv_7d', label: '7日PV' },
    { key: 'pv_total', label: '累計PV' },
    { key: 'inquiry_30d', label: '問い合わせ数' },
    { key: 'new_favorites_7d', label: '新規お気に入り' },
  ]

  return (
    <div className="min-h-screen bg-slate-50/60 pb-24">
      <header className="px-4 sm:px-6 py-3.5 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <Link href="/rewards" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
            <span>←</span> マイページへ
          </Link>
          <h1 className="text-sm font-bold text-slate-900">全クリエイターPV解析</h1>
          <div className="flex items-center gap-3">
            <Link href="/admin/users" className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors">
              ユーザー管理
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

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {/* サマリー */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 block">全クリエイター 7日間PV合計</span>
            <span className="text-xl font-black text-slate-900">{totals.pv_7d.toLocaleString()}</span>
          </div>
          <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 block">全クリエイター 30日間PV合計</span>
            <span className="text-xl font-black text-slate-900">{totals.pv_30d.toLocaleString()}</span>
          </div>
          <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 block">全クリエイター 30日間問い合わせ合計</span>
            <span className="text-xl font-black text-slate-900">{totals.inquiry_30d.toLocaleString()}</span>
          </div>
        </div>

        {/* 検索・並び替え */}
        <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="表示名で絞り込み"
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <div className="flex flex-wrap gap-1.5">
            {sortOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSortKey(opt.key)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-xl transition cursor-pointer ${
                  sortKey === opt.key
                    ? 'bg-sky-500 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {opt.label}順
              </button>
            ))}
          </div>
        </div>

        {loadError && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-xs font-bold text-rose-600">
            {loadError}
          </div>
        )}

        {/* 一覧テーブル */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">クリエイター</th>
                  <th className="text-right px-3 py-2.5">7日PV</th>
                  <th className="text-right px-3 py-2.5">30日PV</th>
                  <th className="text-right px-3 py-2.5">累計PV</th>
                  <th className="text-right px-3 py-2.5">問い合わせ(30日)</th>
                  <th className="text-right px-4 py-2.5">新規お気に入り(7日)</th>
                </tr>
              </thead>
              <tbody>
                {loadingRows ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-300 font-bold">
                      読み込み中...
                    </td>
                  </tr>
                ) : visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-300 font-bold">
                      データがありません
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((r) => (
                    <tr key={r.user_id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/creator/${r.user_id}`}
                          target="_blank"
                          className="font-bold text-slate-800 hover:text-sky-600 transition-colors"
                        >
                          {r.display_name || '（表示名未設定）'}
                        </Link>
                        {!r.is_public && (
                          <span className="ml-1.5 text-[9px] font-black text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">
                            非公開
                          </span>
                        )}
                      </td>
                      <td className="text-right px-3 py-2.5 font-bold text-slate-700">{r.pv_7d.toLocaleString()}</td>
                      <td className="text-right px-3 py-2.5 font-bold text-slate-700">{r.pv_30d.toLocaleString()}</td>
                      <td className="text-right px-3 py-2.5 text-slate-400">{r.pv_total.toLocaleString()}</td>
                      <td className="text-right px-3 py-2.5 font-bold text-slate-700">{r.inquiry_30d.toLocaleString()}</td>
                      <td className="text-right px-4 py-2.5 text-slate-400">+{r.new_favorites_7d.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import CreatorImageManager, { ManagedUser } from '@/components/admin/CreatorImageManager'
import { backgroundImageStyle } from '@/lib/background'

type AuditRow = {
  id: string
  action: string
  target_user_id: string | null
  detail: { reason?: string; notified?: boolean } | null
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  remove_portfolio_item: '作品を削除',
  replace_portfolio_image: '作品画像を差し替え',
  remove_before_image: 'ビフォー画像を削除',
  replace_avatar: 'アイコンを差し替え',
  remove_avatar: 'アイコンを削除',
}

// 画像の削除・差し替え専用ページ。ユーザー管理の一覧（名前をクリックで開くパネル）でも同じ操作ができる。
// こちらは通報管理からのリンク（?user=<ユーザーID>）と、操作履歴の確認に使う。
export default function AdminImagesPage() {
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [results, setResults] = useState<ManagedUser[]>([])
  const [target, setTarget] = useState<ManagedUser | null>(null)

  const [auditRows, setAuditRows] = useState<AuditRow[]>([])
  const [nameMap, setNameMap] = useState<Record<string, string>>({})

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
          await refreshAudit()
          // 通報管理などから ?user=<ユーザーID> で開かれた場合は、そのユーザーを最初から表示する
          const presetUser = new URLSearchParams(window.location.search).get('user')
          if (presetUser) await searchUsers(presetUser, true)
        }
      }
      setChecking(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshAudit = async () => {
    const { data, error } = await supabase
      .from('admin_audit_log')
      .select('id, action, target_user_id, detail, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) {
      console.error('操作履歴の取得エラー:', error)
      return
    }
    const rows = (data || []) as AuditRow[]
    setAuditRows(rows)

    const ids = Array.from(new Set(rows.map((r) => r.target_user_id).filter((v): v is string => !!v)))
    if (ids.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, display_name').in('user_id', ids)
      const map: Record<string, string> = {}
      ;(profiles || []).forEach((p: any) => {
        map[p.user_id] = p.display_name
      })
      setNameMap(map)
    }
  }

  const searchUsers = async (q: string, autoOpen = false) => {
    setSearchError('')
    setResults([])
    if (!q.trim()) return

    setSearching(true)
    const { data, error } = await supabase.rpc('admin_search_users', { p_query: q.trim() })
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
    if (data.length === 1 || autoOpen) {
      setTarget(data[0] as ManagedUser)
    } else {
      setTarget(null)
      setResults(data as ManagedUser[])
    }
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
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <Link href="/rewards" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
            <span>←</span> マイページへ
          </Link>
          <h1 className="text-sm font-bold text-slate-900">画像管理</h1>
          <div className="flex items-center gap-3">
            <Link href="/admin/reports" className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors">
              通報管理
            </Link>
            <Link href="/admin/users" className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors">
              ユーザー管理
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-2">
          <h2 className="text-xs font-black text-slate-800">クリエイターを探す</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              searchUsers(query)
            }}
            className="flex gap-2"
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="表示名 または ユーザーID"
              className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-sky-400"
            />
            <button
              type="submit"
              disabled={searching}
              className="px-4 py-1.5 font-bold text-[11px] rounded-lg cursor-pointer disabled:opacity-50 transition bg-sky-500 hover:bg-sky-600 text-white"
            >
              {searching ? '検索中...' : '検索'}
            </button>
          </form>
          {searchError && <p className="text-[11px] font-bold text-rose-500">{searchError}</p>}
          {results.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {results.map((u) => (
                <button
                  key={u.user_id}
                  type="button"
                  onClick={() => {
                    setResults([])
                    setTarget(u)
                  }}
                  className="text-[11px] font-bold bg-slate-50 hover:bg-sky-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl cursor-pointer"
                >
                  {u.display_name || u.user_id}
                </button>
              ))}
            </div>
          )}
        </div>

        {target && (
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-900 truncate">{target.display_name || '（名前なし）'}</p>
              <Link href={`/creator/${target.user_id}`} target="_blank" className="text-[11px] font-bold text-sky-600 hover:underline shrink-0">
                公開ページを見る →
              </Link>
            </div>
            <CreatorImageManager key={target.user_id} user={target} onChanged={() => refreshAudit()} />
          </div>
        )}

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-2">
          <h2 className="text-xs font-black text-slate-800">最近の操作履歴</h2>
          {auditRows.length === 0 ? (
            <p className="text-[11px] text-slate-400">まだ操作はありません</p>
          ) : (
            <ul className="space-y-1.5">
              {auditRows.map((a) => (
                <li key={a.id} className="text-[11px] text-slate-600 flex flex-wrap gap-x-2">
                  <span className="text-slate-400">{new Date(a.created_at).toLocaleString('ja-JP')}</span>
                  <span className="font-bold">{ACTION_LABELS[a.action] || a.action}</span>
                  {a.target_user_id && <span>/ {nameMap[a.target_user_id] || a.target_user_id}</span>}
                  {a.detail?.reason && <span className="text-slate-400">（{a.detail.reason}）</span>}
                  {a.detail?.notified === false && (
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 rounded">通知なし</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

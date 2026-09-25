'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import AvatarRing from '@/components/AvatarRing'
import UserAdminPanel from '@/components/admin/UserAdminPanel'
import { backgroundImageStyle } from '@/lib/background'

type FoundUser = {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  balance: number
}

type ListedUser = {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  has_dashboard_setup: boolean
  is_public: boolean
  updated_at: string
}

const USERS_PAGE_SIZE = 50

export default function AdminUsersPage() {
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [results, setResults] = useState<FoundUser[]>([])
  const [found, setFound] = useState<FoundUser | null>(null)

  // 一覧で名前をクリックして開いている（管理パネルを表示中の）ユーザー
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  // 全ユーザー一覧（クリエイター/依頼者の種別を手動で直すため）
  const [listedUsers, setListedUsers] = useState<ListedUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersHasMore, setUsersHasMore] = useState(true)
  const [usersError, setUsersError] = useState('')
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const loadUsers = async (reset: boolean) => {
    setUsersLoading(true)
    setUsersError('')
    const offset = reset ? 0 : listedUsers.length
    const { data, error } = await supabase.rpc('admin_list_users', {
      p_limit: USERS_PAGE_SIZE,
      p_offset: offset,
    })
    setUsersLoading(false)

    if (error) {
      console.error('ユーザー一覧取得エラー:', error)
      setUsersError(error.message || '取得に失敗しました。')
      return
    }
    const rows = (data || []) as ListedUser[]
    setListedUsers((prev) => (reset ? rows : [...prev, ...rows]))
    setUsersHasMore(rows.length === USERS_PAGE_SIZE)
  }

  const handleSetAccountType = async (userId: string, isCreator: boolean) => {
    setUpdatingUserId(userId)
    const { error } = await supabase.rpc('admin_set_account_type', {
      p_user_id: userId,
      p_is_creator: isCreator,
    })
    setUpdatingUserId(null)

    if (error) {
      console.error('アカウント種別更新エラー:', error)
      alert('更新に失敗しました。' + error.message)
      return
    }
    setListedUsers((prev) =>
      prev.map((u) => (u.user_id === userId ? { ...u, has_dashboard_setup: isCreator } : u))
    )
  }

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
        if (adminRow) await loadUsers(true)
      }
      setChecking(false)
    }
    init()
  }, [])

  const handleSearch = async () => {
    setSearchError('')
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

        {/* 全ユーザー一覧：クリエイター/依頼者の種別を手動で直す */}
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">全ユーザー一覧（種別の手動設定）</h2>
            <span className="text-[10px] text-slate-400 font-bold">{listedUsers.length}件表示中</span>
          </div>
          <p className="text-[10px] text-slate-400">
            「ダッシュボードで保存したら自動でクリエイター扱い」の仕様上、意図せずクリエイター扱いになっているアカウントがあります。ここで手動で直せます（一覧への公開設定は変更しません）。
          </p>

          <div className="divide-y divide-slate-100">
            {listedUsers.map((u) => {
              const isExpanded = expandedUserId === u.user_id
              return (
              <div key={u.user_id}>
              <div className="flex items-center gap-3 py-2.5">
                {/* 名前（とアイコン）をクリックすると、下に管理パネルが開閉する */}
                <button
                  type="button"
                  onClick={() => setExpandedUserId(isExpanded ? null : u.user_id)}
                  aria-expanded={isExpanded}
                  className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer group"
                >
                  <AvatarRing
                    src={u.avatar_url}
                    alt=""
                    size={32}
                    fallback={<div className="w-full h-full rounded-full bg-sky-100 flex items-center justify-center text-xs">👤</div>}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-800 group-hover:text-sky-600 block truncate transition-colors">
                      {u.display_name || '（表示名未設定）'}
                    </span>
                    <span className="text-[9px] text-slate-300 block truncate">
                      {u.is_public ? '一覧公開中' : '一覧非公開'}
                    </span>
                  </div>
                  <span className={`text-[10px] text-slate-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleSetAccountType(u.user_id, true)}
                    disabled={updatingUserId === u.user_id}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black transition cursor-pointer disabled:opacity-50 ${
                      u.has_dashboard_setup ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    🎨 クリエイター
                  </button>
                  <button
                    onClick={() => handleSetAccountType(u.user_id, false)}
                    disabled={updatingUserId === u.user_id}
                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black transition cursor-pointer disabled:opacity-50 ${
                      !u.has_dashboard_setup ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    🙋 依頼者
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className="pb-3">
                  <UserAdminPanel
                    user={{ user_id: u.user_id, display_name: u.display_name, avatar_url: u.avatar_url }}
                    onAvatarChanged={(avatarUrl) =>
                      setListedUsers((prev) => prev.map((x) => (x.user_id === u.user_id ? { ...x, avatar_url: avatarUrl } : x)))
                    }
                  />
                </div>
              )}
              </div>
              )
            })}
            {usersError && (
              <p className="text-xs font-bold text-rose-500 text-center py-6">取得エラー: {usersError}</p>
            )}
            {!usersError && listedUsers.length === 0 && !usersLoading && (
              <p className="text-xs text-slate-400 text-center py-6">ユーザーがいません</p>
            )}
          </div>

          {usersHasMore && (
            <button
              onClick={() => loadUsers(false)}
              disabled={usersLoading}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              {usersLoading ? '読み込み中...' : 'もっと見る'}
            </button>
          )}
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
              </div>
              <button
                onClick={() => {
                  setFound(null)
                  setResults([])
                }}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-600 shrink-0 cursor-pointer"
              >
                別のユーザーを検索
              </button>
            </div>

            <UserAdminPanel key={found.user_id} user={found} />
          </>
        )}
      </div>
    </div>
  )
}

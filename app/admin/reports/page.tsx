'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { backgroundImageStyle } from '@/lib/background'
import { extractStoragePath } from '@/lib/storageUtils'

type ReportRow = {
  id: string
  reporter_id: string | null
  target_type: 'profile' | 'portfolio_item' | 'post' | 'post_comment' | 'wanted_post'
  target_id: string
  creator_id: string
  reason: string
  comment: string | null
  status: 'open' | 'reviewed' | 'dismissed'
  created_at: string
  creator_display_name?: string | null
  // コメントの通報（target_type = 'post_comment'）のときだけ：通報されたコメントの本文と、付いている投稿。
  // コメントがすでに削除されていれば、どちらも null
  reported_comment?: { post_id: string; content: string } | null
}

export default function AdminReportsPage() {
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)

  const [reports, setReports] = useState<ReportRow[]>([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'open' | 'reviewed' | 'dismissed' | 'all'>('open')
  const [busyId, setBusyId] = useState<string | null>(null)

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
        if (adminRow) await refreshReports()
      }
      setChecking(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshReports = async () => {
    setLoadingReports(true)
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('通報一覧の取得エラー:', error)
      setLoadingReports(false)
      return
    }

    const rows = (data || []) as ReportRow[]
    const creatorIds = Array.from(new Set(rows.map((r) => r.creator_id)))
    if (creatorIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', creatorIds)
      const nameMap: Record<string, string> = {}
      ;(profilesData || []).forEach((p: any) => {
        nameMap[p.user_id] = p.display_name
      })
      rows.forEach((r) => {
        r.creator_display_name = nameMap[r.creator_id] || null
      })
    }

    // 通報されたコメントの本文と、付いている投稿（投稿を見るリンク用）
    const commentIds = Array.from(new Set(rows.filter((r) => r.target_type === 'post_comment').map((r) => r.target_id)))
    if (commentIds.length > 0) {
      const { data: commentsData } = await supabase
        .from('post_comments')
        .select('id, post_id, content')
        .in('id', commentIds)
      const commentMap: Record<string, { post_id: string; content: string }> = {}
      ;(commentsData || []).forEach((c: any) => {
        commentMap[c.id] = { post_id: c.post_id, content: c.content }
      })
      rows.forEach((r) => {
        if (r.target_type === 'post_comment') r.reported_comment = commentMap[r.target_id] || null
      })
    }

    setReports(rows)
    setLoadingReports(false)
  }

  const updateStatus = async (id: string, status: 'reviewed' | 'dismissed') => {
    setBusyId(id)
    const { error } = await supabase.from('reports').update({ status }).eq('id', id)
    setBusyId(null)
    if (error) {
      console.error('通報ステータス更新エラー:', error)
      alert('更新に失敗しました。')
      return
    }
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  // 通報されたフィード投稿を削除する（admin_remove_post / supabase/improve_feed.sql）。
  // 投稿・いいね・コメントが消え、投稿者には理由つきで通知され、操作は admin_audit_log に残る。
  // その投稿への未対応の通報は、まとめて「対応済み」になる。
  const removeReportedPost = async (report: ReportRow) => {
    const reason = window.prompt('この投稿を削除します。理由を入力してください（投稿者に通知されます）。', report.reason)
    if (reason === null) return
    if (!reason.trim()) {
      alert('理由を入力してください。')
      return
    }

    setBusyId(report.id)
    const { data, error } = await supabase.rpc('admin_remove_post', {
      p_post_id: report.target_id,
      p_reason: reason.trim(),
      p_notify: true,
    })
    setBusyId(null)
    if (error) {
      console.error('投稿削除エラー:', error)
      alert('削除に失敗しました。' + error.message)
      return
    }

    // 投稿の画像ファイルをストレージから削除する。失敗しても投稿の削除自体は完了しているので、記録だけ残す
    const paths = ((data || []) as string[]).map((u) => extractStoragePath(u)).filter((p): p is string => !!p)
    if (paths.length > 0) {
      const { error: removeError } = await supabase.storage.from('portfolios').remove(paths)
      if (removeError) console.error('画像ファイルの削除エラー:', removeError)
    }

    // その投稿と、一緒に消えたコメントへの通報が「対応済み」になるので、一覧を取り直す
    await refreshReports()
  }

  // 通報されたコメントを削除する（admin_remove_post_comment）。本人に理由つきで通知され、操作履歴に残る
  const removeReportedComment = async (report: ReportRow) => {
    const reason = window.prompt('このコメントを削除します。理由を入力してください（本人に通知されます）。', report.reason)
    if (reason === null) return
    if (!reason.trim()) {
      alert('理由を入力してください。')
      return
    }

    setBusyId(report.id)
    const { error } = await supabase.rpc('admin_remove_post_comment', {
      p_comment_id: report.target_id,
      p_reason: reason.trim(),
      p_notify: true,
    })
    setBusyId(null)
    if (error) {
      console.error('コメント削除エラー:', error)
      alert('削除に失敗しました。' + error.message)
      return
    }
    await refreshReports()
  }

  // 同じクリエイターに、別々の人からの未対応通報が複数件来ている場合に目立たせる。
  // 同一人物の連投を「複数人が問題視している」と誤解しないよう、reporter_idの重複を除いた
  // ユニーク人数で数える（匿名通報はreporter_idがnullで区別できないため1件＝1人として扱う）。
  const MULTI_REPORT_THRESHOLD = 2

  const openCountByCreator = useMemo(() => {
    const reportersByCreator: Record<string, Set<string>> = {}
    reports.forEach((r) => {
      if (r.status !== 'open') return
      const reporterKey = r.reporter_id || `anon:${r.id}`
      if (!reportersByCreator[r.creator_id]) reportersByCreator[r.creator_id] = new Set()
      reportersByCreator[r.creator_id].add(reporterKey)
    })
    const map: Record<string, number> = {}
    Object.entries(reportersByCreator).forEach(([creatorId, set]) => {
      map[creatorId] = set.size
    })
    return map
  }, [reports])

  const flaggedCreators = useMemo(() => {
    const entries = Object.entries(openCountByCreator).filter(([, count]) => count >= MULTI_REPORT_THRESHOLD)
    return entries
      .map(([creatorId, count]) => ({
        creatorId,
        count,
        displayName: reports.find((r) => r.creator_id === creatorId)?.creator_display_name || creatorId,
      }))
      .sort((a, b) => b.count - a.count)
  }, [openCountByCreator, reports])

  const visibleReports = reports
    .filter((r) => statusFilter === 'all' || r.status === statusFilter)
    .sort((a, b) => {
      const diff = (openCountByCreator[b.creator_id] || 0) - (openCountByCreator[a.creator_id] || 0)
      if (diff !== 0) return diff
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

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

  const statusLabel = (s: ReportRow['status']) =>
    s === 'open' ? '未対応' : s === 'reviewed' ? '対応済み' : '却下'

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <header className="px-4 sm:px-6 py-3.5 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <Link href="/rewards" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
            <span>←</span> マイページへ
          </Link>
          <h1 className="text-sm font-bold text-slate-900">通報管理</h1>
          <div className="flex items-center gap-3">
            <Link href="/admin/analytics" className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors">
              PV解析
            </Link>
            <Link href="/admin/images" className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors">
              画像管理
            </Link>
            <Link href="/admin/users" className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors">
              ユーザー管理
            </Link>
            <Link href="/admin/agreements" className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors">
              取引トラブル
            </Link>
            <Link href="/admin/articles" className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors">
              記事
            </Link>
            <Link href="/admin/inquiries" className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors">
              お問い合わせ
            </Link>
            <Link href="/admin/maintenance" className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors">
              🚧 メンテナンス
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        {flaggedCreators.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
            <h2 className="text-xs font-black text-rose-700 flex items-center gap-1.5">
              🚨 複数の未対応通報があるクリエイター
            </h2>
            <div className="flex flex-wrap gap-2">
              {flaggedCreators.map((c) => (
                <Link
                  key={c.creatorId}
                  href={`/creator/${c.creatorId}`}
                  target="_blank"
                  className="text-[11px] font-bold bg-white border border-rose-200 text-rose-700 px-3 py-1.5 rounded-xl hover:bg-rose-100 transition-colors"
                >
                  {c.displayName}（{c.count}人）
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {(['open', 'reviewed', 'dismissed', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-xl transition cursor-pointer ${
                statusFilter === s ? 'bg-sky-500 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s === 'all' ? 'すべて' : statusLabel(s)}
              {s !== 'all' && ` (${reports.filter((r) => r.status === s).length})`}
            </button>
          ))}
        </div>

        {loadingReports ? (
          <p className="text-xs text-slate-600 font-bold drop-shadow-sm text-center py-8">読み込み中...</p>
        ) : visibleReports.length === 0 ? (
          <p className="text-xs text-slate-600 font-bold drop-shadow-sm text-center py-8">該当する通報はありません</p>
        ) : (
          <div className="space-y-3">
            {visibleReports.map((r) => {
              const openCount = openCountByCreator[r.creator_id] || 0
              const isFlagged = openCount >= MULTI_REPORT_THRESHOLD
              return (
              <div
                key={r.id}
                className={`rounded-2xl p-4 shadow-sm space-y-2 ${
                  isFlagged ? 'bg-rose-50/60 border-2 border-rose-300' : 'bg-white border border-slate-100'
                }`}
              >
                {isFlagged && (
                  <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white">
                    🚨 このクリエイターへの未対応通報が{openCount}人から届いています
                  </span>
                )}
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        r.status === 'open'
                          ? 'bg-rose-100 text-rose-700'
                          : r.status === 'reviewed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {statusLabel(r.status)}
                    </span>
                    <span className="ml-2 text-[10px] text-slate-400">
                      {new Date(r.created_at).toLocaleString('ja-JP')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.target_type === 'post' ? (
                      <Link
                        href={`/feed/${r.target_id}`}
                        target="_blank"
                        className="text-[11px] font-bold text-rose-600 hover:underline"
                      >
                        投稿を見る →
                      </Link>
                    ) : r.target_type === 'wanted_post' ? (
                      // 募集の削除は、開いた先のページの「管理者メニュー」から行う
                      <Link
                        href={`/wanted/${r.target_id}`}
                        target="_blank"
                        className="text-[11px] font-bold text-rose-600 hover:underline"
                      >
                        募集を見る・削除する →
                      </Link>
                    ) : r.target_type === 'post_comment' ? (
                      r.reported_comment && (
                        <Link
                          href={`/feed/${r.reported_comment.post_id}`}
                          target="_blank"
                          className="text-[11px] font-bold text-rose-600 hover:underline"
                        >
                          コメントのある投稿を見る →
                        </Link>
                      )
                    ) : (
                      <Link
                        href={`/admin/images?user=${r.creator_id}`}
                        className="text-[11px] font-bold text-rose-600 hover:underline"
                      >
                        画像を管理 →
                      </Link>
                    )}
                    <Link
                      href={`/creator/${r.creator_id}`}
                      target="_blank"
                      className="text-[11px] font-bold text-sky-600 hover:underline"
                    >
                      {r.creator_display_name || r.creator_id} のページを見る →
                    </Link>
                  </div>
                </div>

                <p className="text-xs font-bold text-slate-800">
                  {r.target_type === 'profile'
                    ? 'プロフィール全体'
                    : r.target_type === 'post'
                      ? `フィード投稿 (ID: ${r.target_id})`
                      : r.target_type === 'wanted_post'
                        ? `募集 (ID: ${r.target_id})`
                      : r.target_type === 'post_comment'
                        ? `コメント (ID: ${r.target_id})`
                        : `作品 (ID: ${r.target_id})`}{' '}
                  / {r.reason}
                </p>
                {r.target_type === 'post_comment' && (
                  <p className="text-xs text-slate-700 border-l-2 border-rose-200 pl-2.5 whitespace-pre-wrap break-words">
                    {r.reported_comment ? r.reported_comment.content : '（このコメントはすでに削除されています）'}
                  </p>
                )}
                {r.comment && (
                  <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl whitespace-pre-wrap">{r.comment}</p>
                )}
                <p className="text-[10px] text-slate-300">
                  通報者: {r.reporter_id ? r.reporter_id : '匿名'}
                </p>

                {r.status === 'open' && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => updateStatus(r.id, 'reviewed')}
                      disabled={busyId === r.id}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      対応済みにする
                    </button>
                    <button
                      onClick={() => updateStatus(r.id, 'dismissed')}
                      disabled={busyId === r.id}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      却下する
                    </button>
                    {r.target_type === 'post' && (
                      <button
                        onClick={() => removeReportedPost(r)}
                        disabled={busyId === r.id}
                        className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        投稿を削除する
                      </button>
                    )}
                    {r.target_type === 'post_comment' && r.reported_comment && (
                      <button
                        onClick={() => removeReportedComment(r)}
                        disabled={busyId === r.id}
                        className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        コメントを削除する
                      </button>
                    )}
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { backgroundImageStyle } from '@/lib/background'
import { inquiryCategoryLabel } from '@/lib/inquiries'

type InquiryRow = {
  id: string
  user_id: string | null
  name: string
  email: string
  category: string
  message: string
  status: 'open' | 'done'
  created_at: string
}

// お問い合わせフォーム（/contact）から届いた内容の一覧。管理者だけが見られる（RLSで制限）。
export default function AdminInquiriesPage() {
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [rows, setRows] = useState<InquiryRow[]>([])
  const [loadError, setLoadError] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'open' | 'done' | 'all'>('open')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data?.user?.id || null
      setLoggedIn(!!uid)
      if (uid) {
        const { data: adminRow } = await supabase.from('admins').select('user_id').eq('user_id', uid).maybeSingle()
        setIsAdmin(!!adminRow)
        if (adminRow) {
          const { data: list, error } = await supabase.from('inquiries').select('*').order('created_at', { ascending: false })
          if (error) {
            console.error('お問い合わせ一覧の取得エラー:', error)
            setLoadError(true)
          }
          setRows((list || []) as InquiryRow[])
        }
      }
      setChecking(false)
    }
    init()
  }, [])

  const updateStatus = async (id: string, status: InquiryRow['status']) => {
    setBusyId(id)
    const { error } = await supabase.from('inquiries').update({ status }).eq('id', id)
    setBusyId(null)
    if (error) {
      console.error('お問い合わせのステータス更新エラー:', error)
      alert('更新に失敗しました。')
      return
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  if (checking) {
    return <div className="p-8 text-center text-xs font-bold text-slate-400">読み込み中...</div>
  }

  if (!loggedIn || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative bg-cover bg-center" style={backgroundImageStyle}>
        <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center space-y-3 max-w-sm w-full">
          {loggedIn ? (
            <>
              <p className="text-sm font-bold text-slate-700">このページへのアクセス権がありません</p>
              <p className="text-xs text-slate-400">管理者アカウントでログインしてください。</p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-slate-700">ログインが必要です</p>
              <a
                href="/login?next=%2Fadmin%2Finquiries"
                className="inline-block px-5 py-2.5 bg-gradient-to-r from-sky-400 to-cyan-400 text-white font-bold text-xs rounded-xl shadow-sm"
              >
                ログイン
              </a>
            </>
          )}
        </div>
      </div>
    )
  }

  const openCount = rows.filter((r) => r.status === 'open').length
  const visible = rows.filter((r) => statusFilter === 'all' || r.status === statusFilter)

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <header className="px-4 sm:px-6 py-3.5 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <Link href="/rewards" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
            <span>←</span> マイページへ
          </Link>
          <h1 className="text-sm font-bold text-slate-900">お問い合わせ</h1>
          <div className="flex items-center gap-3">
            <Link href="/admin/reports" className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors">
              通報管理
            </Link>
            <Link href="/admin/articles" className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors">
              記事
            </Link>
            <Link href="/admin/users" className="text-[11px] font-bold text-slate-400 hover:text-sky-600 transition-colors">
              ユーザー管理
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        {loadError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-bold">
            一覧を読み込めませんでした。supabase/add_inquiries_and_google_signup.sql を実行済みか確認してください。
          </div>
        )}

        <div className="flex gap-2">
          {(
            [
              ['open', `未対応（${openCount}）`],
              ['done', '対応済み'],
              ['all', 'すべて'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                statusFilter === value ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center text-xs font-bold text-slate-400 border border-slate-100">
            お問い合わせはありません
          </div>
        ) : (
          visible.map((row) => (
            <article key={row.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                    row.status === 'open' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  {row.status === 'open' ? '未対応' : '対応済み'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[10px] font-black">
                  {inquiryCategoryLabel(row.category)}
                </span>
                <span className="text-[11px] text-slate-400 font-bold ml-auto">
                  {new Date(row.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                </span>
              </div>

              <div className="text-xs text-slate-600 space-y-0.5">
                <p className="font-black text-slate-800">
                  {row.name}
                  {row.user_id && (
                    <Link href={`/creator/${row.user_id}`} target="_blank" className="ml-2 text-[10px] font-bold text-sky-600 hover:underline">
                      （登録ユーザー）
                    </Link>
                  )}
                </p>
                <a href={`mailto:${row.email}`} className="font-bold text-sky-600 hover:underline break-all">
                  {row.email}
                </a>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words bg-slate-50 rounded-2xl p-4">{row.message}</p>

              <div className="flex justify-end gap-2">
                <a
                  href={`mailto:${row.email}?subject=${encodeURIComponent('【Drawker】お問い合わせへのご返信')}`}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  ✉ メールで返信
                </a>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => updateStatus(row.id, row.status === 'open' ? 'done' : 'open')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                    row.status === 'open' ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {row.status === 'open' ? '対応済みにする' : '未対応に戻す'}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}

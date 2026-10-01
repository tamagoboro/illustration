'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { backgroundImageStyle } from '@/lib/background'
import { ARTICLE_LIST_COLUMNS, categoryInfo, formatArticleDate, type Article } from '@/lib/articles'

// 記事の管理（管理者だけ）。下書きも含めた一覧と、新規作成・編集への入口。
export default function AdminArticlesPage() {
  const [checking, setChecking] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [articles, setArticles] = useState<Article[]>([])
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id
      setLoggedIn(!!uid)
      if (uid) {
        const { data: adminRow } = await supabase.from('admins').select('user_id').eq('user_id', uid).maybeSingle()
        setIsAdmin(!!adminRow)
        if (adminRow) {
          const { data: list, error } = await supabase.from('articles').select(ARTICLE_LIST_COLUMNS).order('updated_at', { ascending: false })
          if (error) {
            console.error('記事一覧の取得エラー:', error)
            setLoadError(true)
          }
          setArticles((list || []) as Article[])
        }
      }
      setChecking(false)
    }
    init()
  }, [])

  if (checking) return <div className="p-8 text-center text-xs font-bold text-slate-400">読み込み中...</div>

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center" style={backgroundImageStyle}>
        <div className="bg-white rounded-3xl p-8 shadow-sm text-center space-y-3 max-w-sm w-full">
          <p className="text-sm font-bold text-slate-700">{loggedIn ? 'このページへのアクセス権がありません' : 'ログインが必要です'}</p>
          {!loggedIn && (
            <Link href="/login?next=%2Fadmin%2Farticles" className="inline-block px-5 py-2.5 bg-sky-500 text-white font-bold text-xs rounded-xl">
              ログイン
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24 bg-cover bg-center" style={backgroundImageStyle}>
      <header className="px-4 sm:px-6 py-3.5 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <Link href="/rewards" className="text-xs font-bold text-slate-500 hover:text-slate-800">
            ← マイページへ
          </Link>
          <h1 className="text-sm font-bold text-slate-900">記事の管理</h1>
          <Link href="/articles" target="_blank" className="text-[11px] font-bold text-slate-400 hover:text-sky-600">
            公開ページ ↗
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <Link
          href="/admin/articles/new"
          className="block text-center rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 py-3.5 text-sm font-black text-white shadow-sm hover:brightness-105"
        >
          ✏️ 新しい記事を書く
        </Link>

        {loadError && (
          <p className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-bold">
            記事を読み込めませんでした。supabase/add_articles.sql を実行済みか確認してください。
          </p>
        )}

        {articles.length === 0 ? (
          <p className="bg-white rounded-3xl p-10 text-center text-xs font-bold text-slate-400">まだ記事がありません</p>
        ) : (
          <ul className="space-y-2">
            {articles.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/admin/articles/${a.id}`}
                  className="flex items-center gap-3 bg-white rounded-2xl p-3 shadow-2xs border border-slate-100 hover:border-sky-200 transition"
                >
                  <span className="w-20 aspect-[1200/630] rounded-lg overflow-hidden bg-sky-50 shrink-0 flex items-center justify-center">
                    {a.cover_image_url ? <img src={a.cover_image_url} alt="" className="w-full h-full object-cover" /> : categoryInfo(a.category).emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-slate-800 truncate">{a.title}</span>
                    <span className="block text-[11px] text-slate-400 font-bold">
                      {categoryInfo(a.category).label} ・ 更新 {formatArticleDate(a.updated_at)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-[10px] font-black px-2.5 py-1 rounded-full ${
                      a.status === 'published' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {a.status === 'published' ? '公開中' : '下書き'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

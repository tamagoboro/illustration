'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import NotificationBell from './NotificationBell'

// トップページ以外の各ページで共通して使うヘッダー。
// トップページ以外に来ると通知ベルやマイページ導線が無く行き止まりになっていたため、
// 各ページで個別にヘッダーを書く代わりにこれを共通化して埋め込む。
// ロゴとメニューはトップページのヘッダーと同じ見た目にそろえ、どのページからでも移動できるようにする。
const NAV_LINKS = [
  { href: '/', label: 'ホーム' },
  { href: '/wanted', label: '募集ボード' },
  { href: '/feed', label: 'フィード' },
  { href: '/agreements/new', label: '📝 控えの作成' },
  { href: '/articles', label: '記事' },
  { href: '/ranking', label: '注目クリエイター' },
  { href: '/gallery', label: '新着作品' },
  { href: '/market', label: '相場マップ' },
  { href: '/updates', label: 'お知らせ' },
]

// スマホでいつも見せる項目（それ以外は「その他」を開くと出る）
const MOBILE_MAIN_HREFS = ['/', '/wanted', '/feed', '/agreements/new']

export default function SimpleHeader({ label }: { label: string }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const pathname = usePathname()

  // ページを移動したら「その他」を閉じる
  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  useEffect(() => {
    let isMounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (isMounted) setIsLoggedIn(!!data?.user)
    })
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <header className="sticky top-0 z-30 px-4 sm:px-8 pt-3 pb-2 bg-white/85 backdrop-blur-md border-b border-sky-100/60 shadow-xs">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        {/* ロゴ（トップページと同じ） */}
        <Link href="/" className="flex items-center gap-2.5 group select-none shrink-0" aria-label="Drawker トップへ">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-400 via-sky-300 to-cyan-300 flex items-center justify-center text-white font-black text-base shadow-sm group-hover:scale-105 transition-transform">
            ☁
          </div>
          <div className="flex flex-col">
            <span className="text-base font-black tracking-tight text-slate-800 group-hover:text-sky-600 transition-colors">
              Drawker
            </span>
            <span className="text-[9px] font-extrabold text-sky-500/80 tracking-wider -mt-1 truncate max-w-[9rem]">
              {label}
            </span>
          </div>
        </Link>

        {/* メニュー（PC） */}
        <nav className="hidden lg:flex items-center gap-1 text-xs font-bold">
          {NAV_LINKS.map((nav) => (
            <Link
              key={nav.href}
              href={nav.href}
              className={`px-3 py-2 rounded-xl transition-colors whitespace-nowrap ${
                pathname === nav.href ? 'bg-sky-50 text-sky-600' : 'text-slate-600 hover:bg-sky-50 hover:text-sky-600'
              }`}
            >
              {nav.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {isLoggedIn && <NotificationBell />}
          {isLoggedIn ? (
            <Link
              href="/rewards"
              className="px-3.5 py-2 text-xs font-bold rounded-2xl border border-sky-100 bg-white/90 hover:bg-white text-slate-600 hover:text-sky-600 shadow-2xs transition-all"
            >
              🎁<span className="hidden sm:inline ml-1">マイページ</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 text-xs font-bold rounded-2xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:brightness-105 text-white shadow-sm transition-all"
            >
              ログイン
            </Link>
          )}
        </div>
      </div>

      {/* メニュー（スマホ・タブレット）：よく使う4つ＋「その他」 */}
      <nav className="lg:hidden max-w-6xl mx-auto flex gap-1.5 pt-2 text-[11px] font-bold">
        {/* 幅の狭い画面では、ここだけ横に送れる（「その他」は右端に固定） */}
        <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto">
          {NAV_LINKS.filter((nav) => MOBILE_MAIN_HREFS.includes(nav.href)).map((nav) => (
            <Link
              key={nav.href}
              href={nav.href}
              className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                pathname === nav.href ? 'bg-sky-500 text-white' : 'bg-sky-50/80 text-slate-600 hover:text-sky-600'
              }`}
            >
              {nav.label}
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          className={`shrink-0 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
            moreOpen ? 'bg-slate-800 text-white' : 'bg-sky-50/80 text-slate-600 hover:text-sky-600'
          }`}
        >
          その他 {moreOpen ? '▲' : '▼'}
        </button>
      </nav>
      {moreOpen && (
        <nav className="lg:hidden max-w-6xl mx-auto grid grid-cols-2 gap-1.5 pt-2 pb-1 text-xs font-bold" aria-label="その他のメニュー">
          {NAV_LINKS.filter((nav) => !MOBILE_MAIN_HREFS.includes(nav.href)).map((nav) => (
            <Link
              key={nav.href}
              href={nav.href}
              className={`px-3 py-2.5 rounded-xl transition-colors ${
                pathname === nav.href ? 'bg-sky-500 text-white' : 'bg-white border border-sky-100 text-slate-700 hover:text-sky-600'
              }`}
            >
              {nav.label}
            </Link>
          ))}
          <Link href="/guide" className="px-3 py-2.5 rounded-xl bg-white border border-sky-100 text-slate-700 hover:text-sky-600">
            使い方ガイド
          </Link>
        </nav>
      )}
    </header>
  )
}

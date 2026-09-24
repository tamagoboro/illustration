'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import NotificationBell from './NotificationBell'

// 新規に作った単機能ページ（診断・ギャラリー・相場マップ等）で共通して使う簡易ヘッダー。
// トップページ以外に来ると通知ベルやマイページ導線が無く行き止まりになっていたため、
// 各ページで個別にヘッダーを書く代わりにこれを共通化して埋め込む。
export default function SimpleHeader({ label }: { label: string }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

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
    <header className="sticky top-0 z-30 px-4 sm:px-8 py-3 bg-white/80 backdrop-blur-md border-b border-sky-100/60">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        <Link href="/" className="text-sm font-black text-sky-700 flex items-center gap-1.5 shrink-0">
          <span>←</span> Drawker
        </Link>
        <span className="hidden sm:inline text-[10px] font-bold text-slate-400 tracking-widest truncate">{label}</span>
        <div className="flex items-center gap-2 shrink-0">
          {isLoggedIn && <NotificationBell />}
          {isLoggedIn ? (
            <Link
              href="/rewards"
              className="px-3 py-1.5 text-[11px] font-bold rounded-xl border border-sky-100 bg-white/90 hover:bg-white text-slate-600 hover:text-sky-600 transition-all"
            >
              🎁 マイページ
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 text-[11px] font-bold rounded-xl bg-sky-500 hover:bg-sky-600 text-white transition-all"
            >
              ログイン
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

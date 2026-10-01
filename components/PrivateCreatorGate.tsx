'use client'

import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import PrivatePortfolioNotice from '@/components/PrivatePortfolioNotice'

// 非公開のページの入口。サーバーからは中身を送らず、ここでログイン中のユーザーを確かめる。
//   ・本人 … load() でブラウザ側から中身を読み込み、上部に「プレビュー中」の帯を付けて表示する
//   ・それ以外 … 「現在非公開のポートフォリオです」と案内してトップページへ誘導する
export default function PrivateCreatorGate<T>({
  creatorId,
  load,
  render,
  bannerText = 'このページは非公開です。あなた以外の人には「非公開のポートフォリオです」と表示されます。',
  bannerLink = { href: '/dashboard', label: 'ダッシュボードで公開する →' },
  deniedVariant = 'private',
}: {
  creatorId: string
  load: () => Promise<T | null>
  render: (data: T) => ReactNode
  bannerText?: string
  bannerLink?: { href: string; label: string }
  deniedVariant?: 'private' | 'notFound'
}) {
  const [state, setState] = useState<{ kind: 'checking' } | { kind: 'denied' } | { kind: 'preview'; data: T }>({
    kind: 'checking',
  })

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return
      if (data.user?.id !== creatorId) {
        setState({ kind: 'denied' })
        return
      }
      const loaded = await load()
      if (!active) return
      setState(loaded ? { kind: 'preview', data: loaded } : { kind: 'denied' })
    })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorId])

  if (state.kind === 'checking') {
    return <div className="min-h-screen flex items-center justify-center text-xs font-bold text-slate-400">読み込み中...</div>
  }
  if (state.kind === 'denied') return <PrivatePortfolioNotice variant={deniedVariant} />

  return (
    <>
      <div className="sticky top-0 z-[60] bg-amber-400 text-amber-950 px-4 py-2.5 shadow-sm">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-black">👀 プレビュー中：{bannerText}</p>
          <Link
            href={bannerLink.href}
            className="shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full bg-amber-950 text-amber-50 hover:bg-amber-900 transition-colors"
          >
            {bannerLink.label}
          </Link>
        </div>
      </div>
      {render(state.data)}
    </>
  )
}

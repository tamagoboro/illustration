'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  WantedPost,
  WANTED_POST_COLUMNS,
  normalizeWantedPost,
  isWantedOpen,
  todayInJapan,
  formatBudget,
  loadApplicationCounts,
} from '@/lib/wanted'

const TEASER_COUNT = 3

// トップページに出す「募集中の依頼」。受付中の募集を新しい順に数件だけ見せ、募集ボードへ案内する。
// 「実際に依頼したい人がいる」ことが見えると、クリエイターが登録する理由になる。
// 募集が1件もないとき（機能を入れた直後など）は、依頼者向けに募集を出す案内だけを出す。
export default function WantedTeaser() {
  const [loaded, setLoaded] = useState(false)
  const [posts, setPosts] = useState<WantedPost[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      const { data, error } = await supabase
        .from('wanted_posts')
        .select(WANTED_POST_COLUMNS)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(TEASER_COUNT * 3)
      // テーブルがまだ無い（SQLが未適用）などで読めないときは、この欄ごと出さない
      if (error || !isMounted) return

      const today = todayInJapan()
      const open = ((data || []) as any[])
        .map(normalizeWantedPost)
        .filter((p) => isWantedOpen(p, today))
        .slice(0, TEASER_COUNT)
      const countMap = await loadApplicationCounts(open.map((p) => p.id))
      if (!isMounted) return
      setPosts(open)
      setCounts(countMap)
      setLoaded(true)
    }
    load()
    return () => {
      isMounted = false
    }
  }, [])

  if (!loaded) return null

  return (
    <section className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-sky-100 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-black text-xs tracking-wider text-sky-700">WANTED / 募集中の依頼</h2>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            「こういうイラストを描ける人を探しています」という募集です。クリエイターはそのまま応募できます。
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/wanted/new"
            className="text-[11px] font-black text-white bg-sky-500 hover:bg-sky-600 px-4 py-2 rounded-full shadow-2xs transition"
          >
            ＋ 募集を出す
          </Link>
          <Link href="/wanted" className="text-[11px] text-sky-600 hover:text-sky-800 font-bold hover:underline">
            一覧 →
          </Link>
        </div>
      </div>

      {posts.length === 0 ? (
        <p className="text-xs text-slate-500 font-bold bg-sky-50/70 border border-sky-100 rounded-2xl px-4 py-3">
          いま受付中の募集はありません。描いてほしいイラストがある方は、無料で募集を出せます。
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/wanted/${post.id}`}
              className="block p-4 rounded-2xl bg-white border border-sky-100 hover:border-sky-300 hover:shadow-md transition-all space-y-2"
            >
              <p className="text-xs font-black text-slate-800 leading-snug line-clamp-2 break-words">{post.title}</p>
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                <span className="text-sky-700">💰 {formatBudget(post)}</span>
                <span className="text-slate-400 shrink-0">応募 {counts[post.id] || 0}件</span>
              </div>
              {post.tastes.length > 0 && (
                <p className="text-[10px] font-bold text-pink-500 truncate">
                  {post.tastes.map((taste) => `#${taste}`).join(' ')}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

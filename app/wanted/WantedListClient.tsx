'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { backgroundImageStyle } from '@/lib/background'
import SimpleHeader from '@/components/SimpleHeader'
import WantedCard from '@/components/wanted/WantedCard'
import {
  WantedPost,
  PosterProfile,
  WANTED_POST_COLUMNS,
  normalizeWantedPost,
  isWantedOpen,
  todayInJapan,
  loadProfilesByIds,
  loadApplicationCounts,
} from '@/lib/wanted'

const WANTED_PAGE_SIZE = 30

// 募集ボードの一覧。受付中の募集を新しい順に並べる。
// ログイン中の人には、自分が出した募集（締め切ったものも含む）を上にまとめて出す。
export default function WantedListClient() {
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [posts, setPosts] = useState<WantedPost[]>([])
  const [myPosts, setMyPosts] = useState<WantedPost[]>([])
  const [posters, setPosters] = useState<Record<string, PosterProfile>>({})
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [selectedTaste, setSelectedTaste] = useState('')
  const today = todayInJapan()

  useEffect(() => {
    const load = async () => {
      const { data: userResp } = await supabase.auth.getUser()
      const uid = userResp.user?.id || null
      setCurrentUserId(uid)

      const [openRes, mineRes] = await Promise.all([
        supabase
          .from('wanted_posts')
          .select(WANTED_POST_COLUMNS)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(WANTED_PAGE_SIZE),
        uid
          ? supabase
              .from('wanted_posts')
              .select(WANTED_POST_COLUMNS)
              .eq('user_id', uid)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ])

      if (openRes.error) {
        console.error('募集の取得エラー:', openRes.error)
        setLoadFailed(true)
        setLoading(false)
        return
      }

      // 締切日を過ぎた募集は、締め切り操作をしていなくても一覧からは外す
      const openPosts = ((openRes.data || []) as any[]).map(normalizeWantedPost).filter((p) => isWantedOpen(p, today))
      const mine = ((mineRes.data || []) as any[]).map(normalizeWantedPost)
      setPosts(openPosts)
      setMyPosts(mine)

      const all = [...openPosts, ...mine]
      const [profileMap, countMap] = await Promise.all([
        loadProfilesByIds(all.map((p) => p.user_id)),
        loadApplicationCounts(Array.from(new Set(all.map((p) => p.id)))),
      ])
      setPosters(profileMap)
      setCounts(countMap)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 受付中の募集で使われているジャンル（絞り込み用）
  const tasteOptions = Array.from(new Set(posts.flatMap((p) => p.tastes)))
  const visiblePosts = selectedTaste ? posts.filter((p) => p.tastes.includes(selectedTaste)) : posts

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="募集ボード" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 px-1">
          <div>
            <p className="text-[10px] font-black text-sky-600 tracking-[0.2em] drop-shadow-xs">WANTED</p>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight drop-shadow-sm">募集ボード</h1>
            <p className="text-[11px] text-slate-600 font-medium drop-shadow-xs leading-relaxed">
              「こういうイラストを描ける人を探しています」という募集が並びます。
              <br className="hidden sm:inline" />
              応募の内容は、募集した人にしか見えません。
            </p>
          </div>
          <Link
            href="/wanted/new"
            className="shrink-0 self-start sm:self-auto text-center bg-gradient-to-r from-sky-500 to-cyan-500 hover:brightness-105 text-white font-black text-xs px-6 py-3 rounded-full shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            ＋ 募集を出す（無料）
          </Link>
        </div>

        {/* 自分が出した募集 */}
        {myPosts.length > 0 && (
          <section className="bg-white/70 backdrop-blur-md rounded-3xl p-4 border border-white/70 space-y-3">
            <h2 className="text-xs font-black text-slate-700 px-1">あなたが出した募集</h2>
            <div className="space-y-3">
              {myPosts.map((post) => (
                <WantedCard
                  key={post.id}
                  post={post}
                  poster={posters[post.user_id]}
                  applicationCount={counts[post.id] || 0}
                  today={today}
                />
              ))}
            </div>
          </section>
        )}

        {/* ジャンルでの絞り込み */}
        {tasteOptions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedTaste('')}
              className={`text-[11px] font-black px-3.5 py-1.5 rounded-full border transition cursor-pointer shadow-2xs ${
                selectedTaste === '' ? 'bg-sky-500 text-white border-sky-500' : 'bg-white/85 text-slate-500 border-white/70 hover:text-sky-600'
              }`}
            >
              すべて
            </button>
            {tasteOptions.map((taste) => (
              <button
                key={taste}
                onClick={() => setSelectedTaste(selectedTaste === taste ? '' : taste)}
                className={`text-[11px] font-black px-3.5 py-1.5 rounded-full border transition cursor-pointer shadow-2xs ${
                  selectedTaste === taste
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'bg-white/85 text-slate-500 border-white/70 hover:text-sky-600'
                }`}
              >
                #{taste}
              </button>
            ))}
          </div>
        )}

        {/* 受付中の募集 */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white/85 rounded-3xl p-5 space-y-3 animate-pulse border border-white/70">
                <div className="h-4 w-2/3 bg-sky-100 rounded" />
                <div className="h-3 w-full bg-sky-50 rounded" />
                <div className="h-3 w-1/2 bg-sky-50 rounded" />
              </div>
            ))}
          </div>
        ) : loadFailed ? (
          <div className="text-center py-16 px-4 bg-white/85 backdrop-blur-md rounded-3xl border border-white/70">
            <p className="text-sm font-black text-slate-600">募集を読み込めませんでした。時間をおいて、もう一度お試しください。</p>
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white/85 backdrop-blur-md rounded-3xl border border-white/70 space-y-2">
            <p className="text-3xl">📣</p>
            <p className="text-sm font-black text-slate-600">
              {selectedTaste ? 'このジャンルの募集は、いまはありません' : 'いま受付中の募集はありません'}
            </p>
            <p className="text-[11px] text-slate-400 font-bold">
              描いてほしいイラストがある方は、「募集を出す」から最初の募集を出してみましょう
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visiblePosts.map((post) => (
              <WantedCard
                key={post.id}
                post={post}
                poster={posters[post.user_id]}
                applicationCount={counts[post.id] || 0}
                today={today}
              />
            ))}
          </div>
        )}

        {/* クリエイター向けの案内（ログインしていない人に） */}
        {!loading && !currentUserId && (
          <div className="bg-gradient-to-br from-sky-500 to-cyan-400 rounded-3xl p-5 text-white shadow-sm space-y-2">
            <p className="text-sm font-black">イラストレーター・クリエイターの方へ</p>
            <p className="text-[11px] text-sky-50 font-medium leading-relaxed">
              無料でポートフォリオを登録すると、気になる募集にそのまま応募できます。応募したことは、募集した人以外には見えません。
            </p>
            <Link
              href="/login?signup=creator"
              className="inline-block mt-1 text-[11px] font-black bg-white text-sky-700 px-4 py-2 rounded-full hover:bg-sky-50 transition"
            >
              無料でクリエイター登録する →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

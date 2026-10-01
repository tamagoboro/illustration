'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import ProtectedImage from '@/components/ProtectedImage'

type RecentPost = {
  id: string
  content: string
  image_urls: string[] | null
  is_sensitive: boolean
  created_at: string
}

const RECENT_POST_LIMIT = 3

// クリエイターページの「最近の投稿」。フィードの新しい投稿を数件だけ見せ、押すと投稿の個別ページ（/feed/[postId]）へ。
// 依頼を検討している人に、いま何を描いているか・活動しているかが伝わるようにする。投稿が無ければ何も出さない。
export default function CreatorRecentPosts({
  creatorId,
  creatorName,
  titleClassName,
}: {
  creatorId: string
  creatorName: string
  titleClassName: string
}) {
  const [posts, setPosts] = useState<RecentPost[]>([])

  useEffect(() => {
    let isMounted = true
    supabase
      .from('posts')
      .select('id, content, image_urls, is_sensitive, created_at')
      .eq('user_id', creatorId)
      .order('created_at', { ascending: false })
      .limit(RECENT_POST_LIMIT)
      .then(({ data }) => {
        if (isMounted) setPosts((data || []) as RecentPost[])
      })
    return () => {
      isMounted = false
    }
  }, [creatorId])

  if (posts.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <h2 className={titleClassName}>最近の投稿</h2>
        <Link
          href="/feed"
          className="text-[11px] font-black text-sky-600 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full border border-white shadow-2xs hover:bg-white transition"
        >
          フィードを見る →
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {posts.map((post) => {
          const cover = post.image_urls?.[0]
          return (
            <Link
              key={post.id}
              href={`/feed/${post.id}`}
              className="group block bg-white/85 backdrop-blur-md rounded-2xl overflow-hidden shadow-sm border border-white/80 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            >
              {cover && (
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                  <ProtectedImage
                    src={cover}
                    alt=""
                    watermarkText={creatorName}
                    loading="lazy"
                    decoding="async"
                    className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                      post.is_sensitive ? 'blur-2xl scale-110' : ''
                    }`}
                  />
                  {post.is_sensitive && (
                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-black text-white bg-slate-900/60 px-3 py-1 rounded-full">
                        センシティブな内容
                      </span>
                    </span>
                  )}
                </div>
              )}
              <div className="p-3 space-y-1.5">
                {post.content && (
                  <p className={`text-xs text-slate-700 leading-relaxed break-words ${cover ? 'line-clamp-2' : 'line-clamp-6'}`}>
                    {post.content}
                  </p>
                )}
                <time dateTime={post.created_at} className="block text-[10px] font-bold text-slate-400">
                  {new Date(post.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })}
                </time>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

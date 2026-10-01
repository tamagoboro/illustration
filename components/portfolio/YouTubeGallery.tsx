'use client'

import { useState } from 'react'
import Reveal from '@/components/Reveal'
import type { PortfolioVideo } from '@/lib/portfolioDesign'

// YouTube動画の一覧。最初はサムネイルだけ表示し、タップされた動画だけ埋め込みを読み込む
// （ページを開いた時点で全部の動画プレイヤーを読み込むと重くなるため）。
// プライバシー強化モード（youtube-nocookie.com）で埋め込む。
export default function YouTubeGallery({ videos }: { videos: PortfolioVideo[] }) {
  const [playing, setPlaying] = useState<string | null>(null)
  if (videos.length === 0) return null

  return (
    <div className={`grid gap-4 ${videos.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
      {videos.map((video, i) => (
        <Reveal key={video.youtubeId} delay={(i % 2) * 100}>
          <div className="rounded-2xl overflow-hidden bg-slate-900 shadow-lg border-2 border-white/80">
            <div className="relative aspect-video">
              {playing === video.youtubeId ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
                  title={video.title || 'YouTube動画'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPlaying(video.youtubeId)}
                  className="group absolute inset-0 w-full h-full cursor-pointer"
                  aria-label={`${video.title || '動画'}を再生`}
                >
                  <img
                    src={`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/10 transition-colors" />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-11 rounded-2xl bg-red-600 group-hover:bg-red-500 group-hover:scale-110 transition-all shadow-lg flex items-center justify-center">
                    <span className="ml-1 w-0 h-0 border-y-[9px] border-y-transparent border-l-[15px] border-l-white" />
                  </span>
                </button>
              )}
            </div>
            {video.title && <p className="px-4 py-2.5 text-xs font-bold text-white/90 truncate bg-slate-900">{video.title}</p>}
          </div>
        </Reveal>
      ))}
    </div>
  )
}

import Link from 'next/link'
import { WantedPost, PosterProfile, formatBudget, formatDate, isWantedOpen } from '@/lib/wanted'

// 募集ボードの一覧に並べる、募集1件分のカード。押すと募集の詳細ページへ
export default function WantedCard({
  post,
  poster,
  applicationCount,
  today,
}: {
  post: WantedPost
  poster?: PosterProfile
  applicationCount: number
  today: string
}) {
  const open = isWantedOpen(post, today)

  return (
    <Link
      href={`/wanted/${post.id}`}
      className="block bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-white/70 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm sm:text-base font-black text-slate-800 leading-snug break-words min-w-0">{post.title}</h2>
        <span
          className={`shrink-0 text-[10px] font-black px-2.5 py-1 rounded-full ${
            open ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {open ? '募集中' : '締切'}
        </span>
      </div>

      {post.description && (
        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 break-words">{post.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
        <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100">💰 {formatBudget(post)}</span>
        {post.desired_deadline && (
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">⏱ 希望納期 {formatDate(post.desired_deadline)}</span>
        )}
        {post.commercial_use && <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">🏢 商用利用あり</span>}
        {post.tastes.map((taste) => (
          <span key={taste} className="px-2.5 py-1 rounded-full bg-pink-50 text-pink-600">
            #{taste}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-2 min-w-0 pt-2.5">
          <div className="shrink-0 w-6 h-6 rounded-full overflow-hidden bg-sky-100">
            {poster?.avatar_url && <img src={poster.avatar_url} alt="" className="w-full h-full object-cover" />}
          </div>
          <span className="text-[11px] font-bold text-slate-500 truncate">{poster?.display_name || 'ユーザー'}</span>
        </div>
        <div className="shrink-0 flex items-center gap-3 text-[10px] font-bold text-slate-400 pt-2.5">
          {post.apply_until && <span>締切 {formatDate(post.apply_until)}</span>}
          <span className="text-sky-600">応募 {applicationCount}件</span>
        </div>
      </div>
    </Link>
  )
}

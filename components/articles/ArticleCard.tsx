import Link from 'next/link'
import { categoryInfo, formatArticleDate, type Article } from '@/lib/articles'

type CardArticle = Pick<Article, 'slug' | 'title' | 'description' | 'category' | 'cover_image_url' | 'published_at' | 'created_at'>

// 記事一覧・関連記事のカード
export default function ArticleCard({ article }: { article: CardArticle }) {
  const category = categoryInfo(article.category)
  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group flex flex-col bg-white/95 rounded-3xl overflow-hidden border border-white/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
    >
      <div className="relative aspect-[1200/630] bg-gradient-to-br from-sky-100 to-cyan-50 overflow-hidden">
        {article.cover_image_url ? (
          <img
            src={article.cover_image_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-5xl opacity-60">{category.emoji}</span>
        )}
        <span className="absolute top-3 left-3 text-[10px] font-black px-2.5 py-1 rounded-full bg-white/90 text-sky-700 shadow-2xs">
          {category.emoji} {category.label}
        </span>
      </div>
      <div className="p-4 sm:p-5 flex-1 flex flex-col gap-2">
        <h2 className="text-base font-black text-slate-800 leading-snug group-hover:text-sky-600 transition-colors line-clamp-2">
          {article.title}
        </h2>
        {article.description && <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{article.description}</p>}
        <p className="mt-auto pt-1 text-[11px] font-bold text-slate-400">{formatArticleDate(article.published_at || article.created_at)}</p>
      </div>
    </Link>
  )
}

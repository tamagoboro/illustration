import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import SimpleHeader from '@/components/SimpleHeader'
import ArticleCard from '@/components/articles/ArticleCard'
import { backgroundImageStyle } from '@/lib/background'
import { ARTICLE_CATEGORIES, ARTICLE_LIST_COLUMNS, type Article } from '@/lib/articles'

export const metadata: Metadata = {
  title: '記事 | はじめてのイラスト依頼ガイド',
  description:
    '一枚絵・立ち絵とは？IRIAMやTRPG、Twitch向けのイラストに必要なものは？はじめて依頼を受けるイラストレーターに向けて、基礎知識・準備・依頼を受けられるプラットフォームをわかりやすくまとめています。',
  alternates: { canonical: '/articles' },
}

// 記事は管理者が書いたときだけ増えるので、5分ごとに作り直せば十分
export const revalidate = 300

// セッションを持たないクライアント（公開中の記事だけを読む）
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

type Props = { searchParams: Promise<{ category?: string }> }

export default async function ArticlesPage({ searchParams }: Props) {
  const { category } = await searchParams
  const activeCategory = ARTICLE_CATEGORIES.some((c) => c.value === category) ? category : undefined

  let query = supabase
    .from('articles')
    .select(ARTICLE_LIST_COLUMNS)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(100)
  if (activeCategory) query = query.eq('category', activeCategory)
  const { data } = await query
  const articles = (data || []) as Article[]

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="記事" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 space-y-6">
        <div className="text-center space-y-2">
          <span className="inline-block px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-black tracking-widest">ARTICLES</span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 drop-shadow-sm">はじめてのイラスト依頼ガイド</h1>
          <p className="text-sm text-slate-600 font-medium drop-shadow-sm leading-relaxed">
            イラストの基礎知識から、依頼を受ける準備、
            <br className="sm:hidden" />
            依頼を受けられるサービスまでまとめています。
          </p>
        </div>

        {/* カテゴリ */}
        <nav className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:justify-center" aria-label="カテゴリ">
          <Link
            href="/articles"
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-black border transition ${
              !activeCategory ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white/90 border-white/70 text-slate-600 hover:text-sky-600'
            }`}
          >
            すべて
          </Link>
          {ARTICLE_CATEGORIES.map((c) => (
            <Link
              key={c.value}
              href={`/articles?category=${c.value}`}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-black border transition whitespace-nowrap ${
                activeCategory === c.value ? 'bg-sky-500 border-sky-500 text-white' : 'bg-white/90 border-white/70 text-slate-600 hover:text-sky-600'
              }`}
            >
              {c.emoji} {c.label}
            </Link>
          ))}
        </nav>

        {articles.length === 0 ? (
          <div className="text-center py-16 bg-white/85 backdrop-blur-md rounded-3xl border border-white/70 space-y-2">
            <p className="text-3xl">📚</p>
            <p className="text-sm font-black text-slate-600">{activeCategory ? 'このカテゴリの記事はまだありません' : '記事を準備中です'}</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import { cache } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import SimpleHeader from '@/components/SimpleHeader'
import ArticleBody from '@/components/articles/ArticleBody'
import ArticleToc from '@/components/articles/ArticleToc'
import ArticleReactions from '@/components/articles/ArticleReactions'
import ArticleCard from '@/components/articles/ArticleCard'
import { backgroundImageStyle } from '@/lib/background'
import { serializeJsonLd } from '@/lib/safeUrl'
import {
  ARTICLE_LIST_COLUMNS,
  SLUG_PATTERN,
  articleCardVersion,
  categoryInfo,
  extractToc,
  formatArticleDate,
  readingMinutes,
  type Article,
} from '@/lib/articles'

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://drawker.com').replace(/\/$/, '')

// 公開中の記事だけを読む（下書きは記入ページのプレビューで確認する）
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

const loadArticle = cache(async (slug: string) => {
  if (!SLUG_PATTERN.test(slug)) return null
  const { data } = await supabase.from('articles').select('*').eq('slug', slug).eq('status', 'published').maybeSingle()
  return (data as Article | null) ?? null
})

const ogImageUrl = (article: Article) => `${BASE_URL}/api/og/article/${article.slug}?v=${articleCardVersion(article.updated_at)}`

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = await loadArticle(slug)
  if (!article) return { title: '記事が見つかりません', robots: { index: false, follow: false } }
  const image = ogImageUrl(article)
  const description = article.description || `${categoryInfo(article.category).label}の記事です。`
  return {
    title: article.title,
    description,
    alternates: { canonical: `${BASE_URL}/articles/${article.slug}` },
    openGraph: {
      title: article.title,
      description,
      type: 'article',
      url: `${BASE_URL}/articles/${article.slug}`,
      publishedTime: article.published_at || undefined,
      modifiedTime: article.updated_at,
      images: [{ url: image, width: 1200, height: 630, alt: article.title }],
    },
    twitter: { card: 'summary_large_image', title: article.title, description, images: [image] },
  }
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const article = await loadArticle(slug)
  if (!article) notFound()

  const category = categoryInfo(article.category)
  const toc = extractToc(article.body)
  const { data: relatedData } = await supabase
    .from('articles')
    .select(ARTICLE_LIST_COLUMNS)
    .eq('status', 'published')
    .eq('category', article.category)
    .neq('id', article.id)
    .order('published_at', { ascending: false })
    .limit(3)
  const related = (relatedData || []) as Article[]

  // シェア用カード画像を先に作ってCDNにキャッシュさせておく（Xのクローラーが来た時にすぐ返せるように）
  after(async () => {
    try {
      await fetch(ogImageUrl(article), { cache: 'no-store' })
    } catch {
      // 失敗してもページ表示には影響しない
    }
  })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    image: article.cover_image_url ? [article.cover_image_url] : undefined,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    publisher: { '@type': 'Organization', name: 'Drawker' },
    mainEntityOfPage: `${BASE_URL}/articles/${article.slug}`,
  }
  const updatedLater =
    article.published_at && new Date(article.updated_at).getTime() - new Date(article.published_at).getTime() > 24 * 60 * 60 * 1000

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="記事" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-4">
        <nav className="text-[11px] font-bold text-slate-600 drop-shadow-xs flex flex-wrap items-center gap-1.5">
          <Link href="/articles" className="hover:text-sky-600 hover:underline">
            記事
          </Link>
          <span>›</span>
          <Link href={`/articles?category=${category.value}`} className="hover:text-sky-600 hover:underline">
            {category.label}
          </Link>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] items-start">
          <article className="bg-white rounded-3xl shadow-sm border border-white/80 overflow-hidden min-w-0">
            {article.cover_image_url && (
              <img src={article.cover_image_url} alt="" className="w-full aspect-[1200/630] object-cover bg-sky-50" />
            )}
            <div className="px-5 sm:px-10 py-7 sm:py-9">
              <header className="space-y-3 pb-6 border-b border-slate-100">
                <Link
                  href={`/articles?category=${category.value}`}
                  className="inline-block text-[11px] font-black px-3 py-1 rounded-full bg-sky-50 text-sky-700 hover:bg-sky-100"
                >
                  {category.emoji} {category.label}
                </Link>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-snug">{article.title}</h1>
                {article.description && <p className="text-sm text-slate-500 leading-relaxed">{article.description}</p>}
                <p className="text-[11px] font-bold text-slate-400 flex flex-wrap gap-x-3">
                  <span>公開 {formatArticleDate(article.published_at)}</span>
                  {updatedLater && <span>更新 {formatArticleDate(article.updated_at)}</span>}
                  <span>約{readingMinutes(article.body)}分で読めます</span>
                </p>
              </header>

              {/* スマホ・タブレットでは本文の前に目次（PCは右側） */}
              <ArticleToc items={toc} className="mt-6 lg:hidden" />

              <ArticleBody body={article.body} />

              <ArticleReactions articleId={article.id} slug={article.slug} title={article.title} />
            </div>
          </article>

          <aside className="hidden lg:block sticky top-24 space-y-4">
            <ArticleToc items={toc} className="bg-white/95" />
            <Link
              href="/articles"
              className="block text-center text-xs font-black text-sky-700 bg-white/90 border border-white/70 px-4 py-2.5 rounded-full hover:bg-white transition"
            >
              ← 記事一覧へ
            </Link>
          </aside>
        </div>

        {related.length > 0 && (
          <section className="pt-6 space-y-3">
            <h2 className="text-base font-black text-slate-800 drop-shadow-xs px-1">同じカテゴリの記事</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <ArticleCard key={r.id} article={r} />
              ))}
            </div>
          </section>
        )}

        <div className="text-center pt-4 lg:hidden">
          <Link href="/articles" className="inline-block text-xs font-black text-sky-700 bg-white/90 px-6 py-2.5 rounded-full shadow-sm">
            ← 記事一覧へ
          </Link>
        </div>
      </div>
    </div>
  )
}

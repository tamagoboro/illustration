import type { Metadata } from 'next'
import Link from 'next/link'
import { supabase, Profile } from '@/lib/supabase'
import ProtectedImage from '@/components/ProtectedImage'

type Props = {
  params: Promise<{ tag: string }>
}

const SITE_NAME = 'Drawker（ドローカー）'
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://drawker.com'

const getPublicProfilesForTag = async (tag: string): Promise<Profile[]> => {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_public', true)
    .contains('tastes', [tag])
  return data || []
}

// ビルド時に、実際に使われているタグの分だけページを生成する
// （存在しないタグの空ページを大量発生させて薄いコンテンツになるのを防ぐため）
export async function generateStaticParams() {
  const { data } = await supabase.from('profiles').select('tastes').eq('is_public', true)

  const tagSet = new Set<string>()
  ;(data || []).forEach((p: any) => {
    ;(p.tastes || []).forEach((t: string) => {
      if (t) tagSet.add(t)
    })
  })

  return Array.from(tagSet).map((tag) => ({ tag }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params
  const profiles = await getPublicProfilesForTag(tag)

  if (profiles.length === 0) {
    return {
      title: `「${tag}」のクリエイターは見つかりませんでした | ${SITE_NAME}`,
      robots: { index: false, follow: true },
    }
  }

  const title = `「${tag}」が得意なイラストレーター${profiles.length}人 | ${SITE_NAME}`
  const description = `「${tag}」に対応しているイラストレーター・クリエイターの一覧。料金・納期・商用利用条件を比較して直接依頼できます。掲載無料・手数料0円のイラスト依頼サイトDrawker。`
  const canonicalUrl = `${BASE_URL}/tags/${encodeURIComponent(tag)}`

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      locale: 'ja_JP',
      type: 'website',
    },
  }
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params
  const profiles = await getPublicProfilesForTag(tag)

  const userIds = profiles.map((p) => p.user_id)
  const { data: thumbData } =
    userIds.length > 0
      ? await supabase.from('first_portfolio_thumbnails').select('user_id, image_url').in('user_id', userIds)
      : { data: [] as { user_id: string; image_url: string }[] }

  const thumbMap: Record<string, string> = {}
  ;(thumbData || []).forEach((t: any) => {
    thumbMap[t.user_id] = t.image_url
  })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `「${tag}」のイラストレーター一覧`,
    url: `${BASE_URL}/tags/${encodeURIComponent(tag)}`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: profiles.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${BASE_URL}/creator/${p.user_id}`,
        name: p.display_name,
      })),
    },
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="px-4 sm:px-6 py-3.5 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
            <span>←</span> 検索トップへ
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            「{tag}」が得意なイラストレーター
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {profiles.length}人のクリエイターが見つかりました。料金・納期・商用利用条件を比較して、気になる方に直接ご相談ください。
          </p>
        </div>

        {profiles.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
            <p className="text-sm font-bold text-slate-400">該当するクリエイターが見つかりませんでした</p>
            <Link href="/" className="inline-block mt-3 text-xs font-bold text-sky-600 hover:underline">
              トップページで他の条件を探す →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {profiles.map((profile) => (
              <Link
                key={profile.user_id}
                href={`/creator/${profile.user_id}`}
                className="bg-white rounded-3xl border border-slate-100 shadow-xs hover:shadow-md transition-all overflow-hidden group"
              >
                <div className="relative w-full aspect-square bg-slate-50 overflow-hidden">
                  {thumbMap[profile.user_id] ? (
                    <ProtectedImage
                      src={thumbMap[profile.user_id]}
                      alt={profile.display_name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 text-[10px] font-black tracking-widest">
                      NO PORTFOLIO
                    </div>
                  )}
                </div>
                <div className="p-3.5 space-y-1">
                  <h2 className="font-bold text-xs text-slate-800 truncate">{profile.display_name}</h2>
                  <p className="text-[10px] text-slate-500 line-clamp-2">
                    {profile.status_comment || 'プロフィール文は設定されていません。'}
                  </p>
                  <span className="text-[10px] font-black text-sky-600 block pt-1">
                    {profile.price_min ? `¥${profile.price_min.toLocaleString()}〜` : '応相談'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

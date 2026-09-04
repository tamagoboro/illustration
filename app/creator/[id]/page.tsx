import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import CreatorClient from './CreatorClient'

type Props = {
  params: Promise<{ id: string }>
}

const SITE_NAME = 'Drawker（ドローカー）'
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://drawker.app'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', id)
    .single()

  if (!profile) {
    return {
      title: `クリエイターが見つかりません | ${SITE_NAME}`,
      robots: { index: false, follow: false },
    }
  }

  const title = `${profile.display_name}のイラスト料金・ポートフォリオ依頼 | ${SITE_NAME}`
  const commercialText = profile.commercial_use_allowed ? '商用利用可' : '個人利用限定'
  const leadTimeText = profile.lead_time_days ? `最短${profile.lead_time_days}日でお届け` : '納期要相談'
  const description = `イラストレーター【${profile.display_name}】への直接依頼・見積もりページ。${leadTimeText} / ${commercialText}。SNSアイコン、キャラデザイン、立ち絵、ヘッダー等の制作実績・料金表を公開中！`
  const ogImage = profile.avatar_url || `${BASE_URL}/OGP-img.png`
  const canonicalUrl = `${BASE_URL}/creator/${id}`

  return {
    title,
    description,
    keywords: [
      profile.display_name,
      'イラスト依頼',
      '絵師',
      '立ち絵依頼',
      'アイコン制作',
      'ポートフォリオ',
      'イラスト料金表',
      'Drawker',
      'ドローカー',
      ...(profile.tastes || []),
    ],
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      locale: 'ja_JP',
      type: 'profile',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${profile.display_name}のポートフォリオ`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
      ...(profile.twitter_url && {
        creator: `@${profile.twitter_url.split('/').pop()}`,
      }),
    },
  }
}

export default async function Page({ params }: Props) {
  const { id } = await params

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', id)
    .single()

  if (!profile) {
    notFound()
  }

  const { data: initialWorks } = await supabase
    .from('portfolio_items')
    .select('*')
    .eq('user_id', id)
    .order('sort_order', { ascending: true })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.display_name,
    description: profile.status_comment || `${profile.display_name}のイラスト制作ポートフォリオ`,
    image: profile.avatar_url,
    jobTitle: 'Illustrator / Creator',
    url: `${BASE_URL}/creator/${id}`,
    knowsAbout: profile.tastes || ['Illustration', 'Design'],
    sameAs: [
      profile.twitter_url,
      profile.instagram_url,
      profile.pixiv_url,
      profile.website_url,
    ].filter(Boolean),
    offers: {
      '@type': 'Offer',
      availability:
        profile.status === 'available'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Person',
        name: profile.display_name,
      },
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CreatorClient
        id={id}
        initialProfile={profile}
        initialWorks={initialWorks || []}
      />
    </>
  )
}
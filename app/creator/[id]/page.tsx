import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import CreatorClient from './CreatorClient'

type Props = {
  params: Promise<{ id: string }>
}

// 動的メタデータ生成（Google・SNS用）
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', id)
    .single()

  if (!profile) {
    return {
      title: 'クリエイターが見つかりません',
    }
  }

  const title = `${profile.display_name}のイラスト料金表・ポートフォリオ`
  const description = `${profile.display_name}へのイラスト依頼・相談ページです。納期目安: ${profile.lead_time_days ?? '-'}日以内 / 商用利用: ${profile.commercial_use_allowed ? '可能' : '不可'}。実績・ポートフォリオを多数掲載中。`
  const ogImage = profile.avatar_url || '/OGP-img.png'

  return {
    title,
    description,
    keywords: [
      profile.display_name,
      'イラスト依頼',
      'ポートフォリオ',
      ...(profile.tastes || []),
    ],
    openGraph: {
      title,
      description,
      images: [{ url: ogImage }],
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

// サーバーコンポーネント本体
export default async function Page({ params }: Props) {
  const { id } = await params

  // 構造化データ（JSON-LD）の作成
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', id)
    .single()

  const jsonLd = profile
    ? {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: profile.display_name,
        description: profile.status_comment,
        image: profile.avatar_url,
        jobTitle: 'Illustrator / Creator',
        sameAs: [
          profile.twitter_url,
          profile.instagram_url,
          profile.pixiv_url,
          profile.website_url,
        ].filter(Boolean),
      }
    : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <CreatorClient id={id} />
    </>
  )
}
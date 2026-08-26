import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params

  // クリエイター名を取得して OGP タイトルに反映
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', id)
    .single()

  const name = profile?.display_name || 'クリエイター'
  const ogImageUrl = `/api/og/creator/${id}`

  return {
    title: `${name} | クリエイターポートフォリオ`,
    openGraph: {
      title: `${name} のポートフォリオ`,
      description: `${name} の作品集・参考価格・お問い合わせページです。`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} のポートフォリオ`,
      description: `${name} の作品集・参考価格・お問い合わせページです。`,
      images: [ogImageUrl],
    },
  }
}

export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
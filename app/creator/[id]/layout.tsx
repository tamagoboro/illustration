import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'

type Props = {
  params: Promise<{ id: string }>
}

// 古いURL形式を補正するヘルパー関数
const normalizeStorageUrl = (url: string): string => {
  if (!url) return ''
  const trimmed = url.trim()
  if (trimmed.includes('/storage/v1/object/portfolios/')) {
    return trimmed.replace('/storage/v1/object/portfolios/', '/storage/v1/object/public/portfolios/')
  }
  return trimmed
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params

  // 1. プロフィール情報（表示名）の取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', id)
    .single()

  // 2. ポートフォリオの1枚目の画像（sort_order順で先頭）を取得
  const { data: firstPortfolio } = await supabase
    .from('portfolio_items')
    .select('image_url')
    .eq('user_id', id)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  const name = profile?.display_name || 'クリエイター'
  
  // 1枚目の画像があればそれを優先使用。なければ動的OGP（またはデフォルト画像）へフォールバック
  const mainImageUrl = firstPortfolio?.image_url 
    ? normalizeStorageUrl(firstPortfolio.image_url)
    : `/api/og/creator/${id}`

  return {
    title: `${name} | クリエイターポートフォリオ`,
    openGraph: {
      title: `${name} のポートフォリオ`,
      description: `${name} の作品集・参考価格・お問い合わせページです。`,
      images: [
        {
          url: mainImageUrl,
          width: 1200,
          height: 630,
          alt: `${name} の代表作品`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} のポートフォリオ`,
      description: `${name} の作品集・参考価格・お問い合わせページです。`,
      images: [mainImageUrl],
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
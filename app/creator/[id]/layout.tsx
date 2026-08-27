import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'

type Props = {
  params: Promise<{ id: string }>
}

// サイトのベースURLを取得（環境変数またはデフォルト）
const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const siteUrl = rawSiteUrl.startsWith('http') ? rawSiteUrl : `https://${rawSiteUrl}`

// Supabase Storageの画像パスを「完全なPublic URL (https://...)」に変換・正規化するヘルパー
const getFullImageUrl = (url: string | null | undefined, fallbackUrl: string): string => {
  if (!url || !url.trim()) return fallbackUrl

  const trimmed = url.trim()

  // すでに完全な https:// URL の場合
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // 古い形式の補正が必要な場合のみ書き換え
    if (trimmed.includes('/storage/v1/object/portfolios/')) {
      return trimmed.replace('/storage/v1/object/portfolios/', '/storage/v1/object/public/portfolios/')
    }
    return trimmed
  }

  // ドメインが含まれていないストレージパスの場合、SupabaseのPublic URLを組み立て
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  if (supabaseUrl) {
    const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed
    return `${supabaseUrl}/storage/v1/object/public/portfolios/${cleanPath}`
  }

  return fallbackUrl
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

  // フォールバック（動的OGP画像）の絶対URL
  const fallbackOgUrl = `${siteUrl}/api/og/creator/${id}`

  // 1枚目の画像URLを取得・生成
  const mainImageUrl = getFullImageUrl(firstPortfolio?.image_url, fallbackOgUrl)

  return {
    title: `${name} | クリエイターポートフォリオ`,
    openGraph: {
      title: `${name} のポートフォリオ`,
      description: `${name} の作品集・参考価格・お問い合わせページです。`,
      images: [
        {
          url: mainImageUrl, // 必ず https://... の完全なURLが入る
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
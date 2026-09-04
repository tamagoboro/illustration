import type { Metadata } from 'next'
import './globals.css'

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const siteUrl = rawSiteUrl.startsWith('http') ? rawSiteUrl : `https://${rawSiteUrl}`

const siteTitle = ' Drawker | イラスト依頼・ポートフォリオ比較プラットフォーム'
const siteDescription = '【掲載無料・手数料0円】イラストレーターやクリエイターの料金表・納期・商用利用条件を一括比較！SNSアイコン、VTuber立ち絵、一枚絵などの依頼相談がスムーズに行える検索サイトです。'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: '%s |  Drawker',
  },
  description: siteDescription,
  keywords: [
    'イラスト依頼',
    'クリエイター検索',
    'ポートフォリオ',
    'VTuber 立ち絵 依頼',
    'アイコン作成 料金',
    'イラストレーター 比較',
    '商用利用 イラスト',
    'イラストレーター',
    'イラスト検索サイト',
    'クリエイター検索',
    'Drawker',
    'ポートフォリオ比較',
    'おすすめ'
  ],
  verification: {
    google: 'ux6pHBdkGJujCh1iPf8N9sQ4-JiPnCTibobcaWsA2sE',
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: ' Drawker',
    images: [
      {
        url: '/OGP-img.png',
        width: 1200,
        height: 630,
        alt: 'Drawker メインイメージ',
      },
    ],
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
    images: [`https://qcklfkslqtjnxufqcqyi.supabase.co/storage/v1/object/public/portfolios/OGP-Drawker.png`], // 絶対パスにする
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Drawker',
    url: siteUrl,
    description: siteDescription,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/?q={search_term_string}`,

      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <html lang="ja">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}

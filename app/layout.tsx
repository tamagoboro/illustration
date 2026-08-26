import type { Metadata } from 'next'
import './globals.css'

// 環境変数の先頭に https:// が含まれている場合にも安全に対応
const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const siteUrl = rawSiteUrl.startsWith('http') ? rawSiteUrl : `https://${rawSiteUrl}`

export const metadata: Metadata = {
  // メタデータで使用するベースURLを定義
  metadataBase: new URL(siteUrl),

  title: 'クリエイター検索・比較',
  description: 'クリエイターのポートフォリオ検索・比較サービス',

  // Google Search Console 所有権確認用コード
  verification: {
    google: 'ux6pHBdkGJujCh1iPf8N9sQ4-JiPnCTibobcaWsA2sE',
  },

  // Twitter（X）用の表示設定
  twitter: {
    card: 'summary_large_image',
    title: 'クリエイター検索・比較',
    description: 'クリエイターのポートフォリオ検索・比較サービス',
    images: ['/icon.png'], // 'public/' を削除し '/' から始める
  },

  // LINE, Facebook, Discord等用の共通表示設定（OGP）
  openGraph: {
    title: 'クリエイター検索・比較',
    description: 'クリエイターのポートフォリオ検索・比較サービス',
    url: siteUrl,
    siteName: 'クリエイター検索・比較',
    images: [
      {
        url: '/icon.png', // 'public/' を削除し '/' から始める
        width: 1200,
        height: 630,
        alt: 'クリエイター検索・比較のメインイメージ',
      },
    ],
    locale: 'ja_JP',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>
        {children}
      </body>
    </html>
  )
}
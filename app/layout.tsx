import type { Metadata } from 'next'
import './globals.css'

// 本番環境のURLを設定（開発環境は localhost にフォールバック）
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL 
  ? `https://${process.env.NEXT_PUBLIC_SITE_URL}` 
  : 'http://localhost:3000'

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
    card: 'summary_large_image', // 画像を大きく表示するタイプ
    title: 'クリエイター検索・比較',
    description: 'クリエイターのポートフォリオ検索・比較サービス',
    images: ['app/icon.png'], // public/ogp-image.png を参照（metadataBaseにより自動で絶対パス化されます）
  },

  // LINE, Facebook, Discord等用の共通表示設定（OGP）
  openGraph: {
    title: 'クリエイター検索・比較',
    description: 'クリエイターのポートフォリオ検索・比較サービス',
    url: siteUrl,
    siteName: 'クリエイター検索・比較',
    images: [
      {
        url: 'app/icon.png', // 推奨サイズ: 1200 x 630 px
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
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'クリエイター検索・比較',
  description: 'クリエイターのポートフォリオ検索・比較サービス',
  // Google Search Console 所有権確認用コードを追加
  verification: {
    google: 'ux6pHBdkGJujCh1iPf8N9sQ4-JiPnCTibobcaWsA2sE',
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
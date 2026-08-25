import type { Metadata } from 'next'
import './globals.css' // <-- 追加！

export const metadata: Metadata = {
  title: 'クリエイター検索・比較',
  description: 'クリエイターのポートフォリオ検索・比較サービス',
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
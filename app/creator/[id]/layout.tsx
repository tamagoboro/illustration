import React from 'react'

type Props = {
  children: React.ReactNode
}

// メタデータ（OGP・SEO）は page.tsx の generateMetadata に一本化しています。
// layout.tsx と page.tsx の両方で generateMetadata を定義すると、
// Next.js は同じキーを page 側の値で上書きするため、
// ここに書いたロジックが実行されても結果が使われない「デッドコード」になり、
// かつ同じプロフィール行を無駄にもう1回 Supabase から取得することになります。
export default function CreatorLayout({ children }: Props) {
  return <>{children}</>
}
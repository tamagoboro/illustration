import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '記事の管理',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

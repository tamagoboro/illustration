import type { Metadata } from 'next'
import PrivatePortfolioNotice from '@/components/PrivatePortfolioNotice'

export const metadata: Metadata = {
  title: 'ページが見つかりません',
  robots: { index: false, follow: false },
}

// サイト全体の404ページ。素っ気ない標準の画面の代わりに、トップページへ誘導する
export default function NotFound() {
  return <PrivatePortfolioNotice variant="notFound" />
}

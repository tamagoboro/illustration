import { buildPageMetadata } from '@/lib/pageMetadata'

// このページ本体はブラウザ側で動く部品（'use client'）でタイトルを指定できないため、ここで指定する
export const metadata = buildPageMetadata({
  title: 'クリエイター比較',
  description: '気になるクリエイターの料金・納期・制作条件を並べて比較できます。',
  path: '/compare',
  noindex: true,
})

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

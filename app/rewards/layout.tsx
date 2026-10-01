import { buildPageMetadata } from '@/lib/pageMetadata'

// このページ本体はブラウザ側で動く部品（'use client'）でタイトルを指定できないため、ここで指定する
export const metadata = buildPageMetadata({
  title: 'マイページ',
  description: 'ポイント・アイコンリング・送ったリクエストを確認できます。',
  path: '/rewards',
  noindex: true,
})

export default function RewardsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

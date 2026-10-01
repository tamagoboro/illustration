import { buildPageMetadata } from '@/lib/pageMetadata'

// このページ本体はブラウザ側で動く部品（'use client'）でタイトルを指定できないため、ここで指定する
export const metadata = buildPageMetadata({
  title: 'かんたん診断｜4つの質問でぴったりのクリエイターを探す',
  description: '予算・好みのジャンル・納期・商用利用の4つの質問に答えるだけで、条件に合うイラストレーター・クリエイターを提案します。',
  path: '/match',
})

export default function MatchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

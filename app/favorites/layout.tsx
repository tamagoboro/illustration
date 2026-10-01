import { buildPageMetadata } from '@/lib/pageMetadata'

// このページ本体はブラウザ側で動く部品（'use client'）でタイトルを指定できないため、ここで指定する
export const metadata = buildPageMetadata({
  title: 'お気に入り',
  description: 'お気に入りに登録したクリエイターの一覧です。',
  path: '/favorites',
  noindex: true,
})

export default function FavoritesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

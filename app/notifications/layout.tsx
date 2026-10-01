import { buildPageMetadata } from '@/lib/pageMetadata'

// このページ本体はブラウザ側で動く部品（'use client'）でタイトルを指定できないため、ここで指定する
export const metadata = buildPageMetadata({
  title: '通知',
  description: 'あなたへの通知の一覧です。',
  path: '/notifications',
  noindex: true,
})

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

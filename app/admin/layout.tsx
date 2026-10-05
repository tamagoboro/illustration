import { buildPageMetadata } from '@/lib/pageMetadata'

// 管理画面は 'use client' のページばかりでタイトルを指定できないため、ここでまとめて指定する（検索にも出さない）
export const metadata = buildPageMetadata({
  title: '管理画面',
  description: 'Drawker の運営用の管理画面です。',
  path: '/admin',
  noindex: true,
})

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

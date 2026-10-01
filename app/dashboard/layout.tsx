import { buildPageMetadata } from '@/lib/pageMetadata'

// このページ本体はブラウザ側で動く部品（'use client'）でタイトルを指定できないため、ここで指定する
export const metadata = buildPageMetadata({
  title: 'ダッシュボード',
  description: 'ポートフォリオ・料金・受付条件を設定するクリエイター向けの管理画面です。',
  path: '/dashboard',
  noindex: true,
})

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

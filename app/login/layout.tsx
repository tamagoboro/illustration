import { buildPageMetadata } from '@/lib/pageMetadata'

// このページ本体はブラウザ側で動く部品（'use client'）でタイトルを指定できないため、ここで指定する
export const metadata = buildPageMetadata({
  title: 'ログイン・新規登録',
  description: 'Drawkerへのログイン・新規登録はこちらから。メールアドレスまたはGoogleアカウントで登録できます。',
  path: '/login',
  noindex: true,
})

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

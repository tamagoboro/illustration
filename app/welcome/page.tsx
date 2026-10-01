import type { Metadata } from 'next'
import WelcomeClient from './WelcomeClient'

export const metadata: Metadata = {
  title: 'はじめの設定',
  // 登録直後の本人だけが使う画面なので検索には出さない
  robots: { index: false, follow: false },
}

export default function WelcomePage() {
  return <WelcomeClient />
}

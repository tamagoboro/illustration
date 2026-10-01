import type { Metadata } from 'next'
import BlocksClient from './BlocksClient'

export const metadata: Metadata = {
  title: 'ブロック・ミュートの管理',
  // 本人専用の設定ページなので検索には出さない
  robots: { index: false, follow: false },
}

export default function BlocksPage() {
  return <BlocksClient />
}

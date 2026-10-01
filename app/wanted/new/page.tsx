import { buildPageMetadata } from '@/lib/pageMetadata'
import WantedFormClient from './WantedFormClient'

export const metadata = buildPageMetadata({
  title: '募集を出す',
  description: '描いてほしいイラストの内容・予算・希望納期を書いて、クリエイターからの応募を受け付けます。',
  path: '/wanted/new',
  // 入力フォームなので検索には出さない（検索に出すのは募集ボードの一覧と各募集のページ）
  noindex: true,
})

export default function WantedNewPage() {
  return <WantedFormClient />
}

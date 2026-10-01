import { buildPageMetadata } from '@/lib/pageMetadata'
import WantedListClient from './WantedListClient'

export const metadata = buildPageMetadata({
  title: '募集ボード｜イラストレーター・クリエイターを募集する',
  description:
    '「こういうイラストを描ける人を探しています」という募集を出して、クリエイターからの応募を受けられます。クリエイターは、条件を見て応募するだけ。応募の内容は募集した人にしか見えません。',
  path: '/wanted',
})

export default function WantedPage() {
  return <WantedListClient />
}

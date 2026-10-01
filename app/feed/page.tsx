import type { Metadata } from 'next'
import { DEFAULT_OG_IMAGE_URL } from '@/lib/ogCard'
import FeedClient from './FeedClient'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://drawker.com'

const title = 'フィード｜みんなの制作日記'
const description =
  'イラストレーター・クリエイターの制作中の作品や近況が集まるフィード。気になる絵柄を見つけたら、そのまま料金や納期を確認して依頼の相談ができます。'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${BASE_URL}/feed` },
  openGraph: {
    title: `${title}｜Drawker`,
    description,
    url: `${BASE_URL}/feed`,
    siteName: 'Drawker（ドローカー）',
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: DEFAULT_OG_IMAGE_URL, alt: 'Drawker メインイメージ' }],
  },
  twitter: { card: 'summary_large_image', title: `${title}｜Drawker`, description, images: [DEFAULT_OG_IMAGE_URL] },
}

// 画面の中身は FeedClient にあり、投稿の個別ページ（/feed/[postId]）と共用している
export default function FeedPage() {
  return <FeedClient />
}

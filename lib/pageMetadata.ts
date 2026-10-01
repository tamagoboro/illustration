import type { Metadata } from 'next'
import { DEFAULT_OG_IMAGE_URL } from '@/lib/ogCard'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://drawker.com'
const SITE_NAME = 'Drawker（ドローカー）'

// 各ページのタイトル・説明文（検索結果・ブラウザのタブ・SNSのカード）をまとめて作る。
// ページごとに title を指定しないと、どのページもサイト共通のタイトルで表示されてしまう。
//   title       … ページ名だけを渡す（「| Drawker」は app/layout.tsx のテンプレートが付ける）
//   path        … そのページのパス（正規URLに使う）
//   noindex     … 本人専用のページなど、検索に出さないページ
// openGraph を指定すると app/layout.tsx の openGraph が丸ごと置き換わる（画像も消える）ため、
// サイト共通のカード画像をここで入れ直している。
export function buildPageMetadata({
  title,
  description,
  path,
  noindex = false,
}: {
  title: string
  description: string
  path: string
  noindex?: boolean
}): Metadata {
  const url = `${BASE_URL}${path}`
  const shareTitle = `${title}｜Drawker`

  return {
    title,
    description,
    alternates: { canonical: url },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: shareTitle,
      description,
      url,
      siteName: SITE_NAME,
      locale: 'ja_JP',
      type: 'website',
      images: [{ url: DEFAULT_OG_IMAGE_URL, alt: 'Drawker メインイメージ' }],
    },
    twitter: { card: 'summary_large_image', title: shareTitle, description, images: [DEFAULT_OG_IMAGE_URL] },
  }
}

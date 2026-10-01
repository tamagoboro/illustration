import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { DEFAULT_OG_IMAGE_URL } from '@/lib/ogCard'
import { loadPostPageData, POST_OG_DESIGN_VERSION } from '@/lib/postPageData'
import FeedClient from '../FeedClient'

const SITE_NAME = 'Drawker（ドローカー）'
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://drawker.com'

// 投稿された画像に透かしを入れたシェア用カード画像（app/api/og/post/[postId]）
const getPostOgImageUrl = (postId: string) => `${BASE_URL}/api/og/post/${postId}?v=${POST_OG_DESIGN_VERSION}`

type Props = { params: Promise<{ postId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId } = await params
  const post = await loadPostPageData(postId)
  if (!post) return { title: '投稿が見つかりません', robots: { index: false, follow: false } }

  const title = `${post.authorName}さんの投稿`
  const shareTitle = `${title}｜Drawker`
  const text = post.content.replace(/\s+/g, ' ').trim()
  const description = text
    ? text.length > 100
      ? `${text.slice(0, 100)}…`
      : text
    : `${post.authorName}さんの投稿をDrawkerのフィードでチェック`
  const canonicalUrl = `${BASE_URL}/feed/${post.id}`
  // 画像のない投稿・センシティブな投稿は、サイト共通のカード画像にする
  const ogImage =
    post.ogImageSources.length > 0
      ? { url: getPostOgImageUrl(post.id), width: 1200, height: 630, alt: title }
      : { url: DEFAULT_OG_IMAGE_URL, alt: 'Drawker メインイメージ' }

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: shareTitle,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      locale: 'ja_JP',
      type: 'article',
      images: [ogImage],
    },
    twitter: { card: 'summary_large_image', title: shareTitle, description, images: [ogImage.url] },
  }
}

export default async function PostPage({ params }: Props) {
  const { postId } = await params
  const post = await loadPostPageData(postId)
  if (!post) notFound()

  // シェア用カード画像を先に作ってCDNにキャッシュさせておく（Xのクローラーが来た時にすぐ返せるように）
  if (post.ogImageSources.length > 0) {
    after(async () => {
      try {
        await fetch(getPostOgImageUrl(post.id), { cache: 'no-store' })
      } catch {
        // 失敗してもページ表示には影響しない
      }
    })
  }

  return <FeedClient postId={post.id} />
}

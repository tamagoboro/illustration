import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { buildPageMetadata } from '@/lib/pageMetadata'
import { formatBudget } from '@/lib/wanted'
import { loadWantedPost } from '@/lib/wantedPageData'
import WantedDetailClient from './WantedDetailClient'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const post = await loadWantedPost(id)
  if (!post) return { title: '募集が見つかりません', robots: { index: false, follow: false } }

  const text = post.description.replace(/\s+/g, ' ').trim()
  const summary = text.length > 90 ? `${text.slice(0, 90)}…` : text
  return buildPageMetadata({
    title: `【クリエイター募集】${post.title}`,
    description: `予算: ${formatBudget(post)}${summary ? ` ／ ${summary}` : ''}`,
    path: `/wanted/${post.id}`,
    // 締め切った募集は検索に出さない
    noindex: post.status !== 'open',
  })
}

export default async function WantedDetailPage({ params }: Props) {
  const { id } = await params
  const post = await loadWantedPost(id)
  if (!post) notFound()

  return <WantedDetailClient postId={post.id} />
}

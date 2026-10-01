import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import SoulDetailView from '@/components/SoulDetailView'
import { getSoulCardVersion, todayInJapan } from '@/lib/soulListings'
import { loadSoulPageData, isSoulPageRestricted } from '@/lib/soulPageData'
import PrivateSoulPreview from './PrivateSoulPreview'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://drawker.com'

// 魂募集専用のシェア用カード画像（app/api/og/soul/[soulId]）。内容やデザインが変わるとURLも変わる
const getSoulOgImageUrl = (soulId: string, updatedAt?: string | null) =>
  `${BASE_URL}/api/og/soul/${soulId}?v=${getSoulCardVersion(updatedAt)}`

type Props = { params: Promise<{ id: string; soulId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, soulId } = await params
  const data = await loadSoulPageData(id, soulId)
  if (!data) return { title: '魂募集が見つかりません', robots: { index: false, follow: false } }
  if (isSoulPageRestricted(data, todayInJapan())) return { title: '非公開の魂募集', robots: { index: false, follow: false } }
  const { listing, profile } = data
  const title = `【魂募集】${listing.title}｜${profile.display_name}`
  const description = (listing.target_audience || listing.description || `${profile.display_name}さんの魂募集イラスト`).slice(0, 120)
  const ogImage = getSoulOgImageUrl(listing.id, listing.updated_at)
  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/creator/${id}/souls/${soulId}` },
    openGraph: {
      title,
      description,
      type: 'article',
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${listing.title}の魂募集` }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}

export default async function SoulDetailPage({ params }: Props) {
  const { id, soulId } = await params
  const data = await loadSoulPageData(id, soulId)
  if (!data) notFound()

  // ポートフォリオが非公開、または掲載開始前：サーバーからは中身を送らず、本人だけブラウザ側でプレビューできる
  if (isSoulPageRestricted(data, todayInJapan())) {
    return (
      <PrivateSoulPreview id={id} soulId={soulId} reason={data.profile.is_public === false ? 'privateProfile' : 'upcoming'} />
    )
  }

  // シェア用カード画像を先に作ってCDNにキャッシュさせておく（Xのクローラーが来た時にすぐ返せるように）
  after(async () => {
    try {
      await fetch(getSoulOgImageUrl(data.listing.id, data.listing.updated_at), { cache: 'no-store' })
    } catch {
      // 失敗してもページ表示には影響しない
    }
  })

  return <SoulDetailView id={id} {...data} />
}

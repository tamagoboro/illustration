import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { serializeJsonLd } from '@/lib/safeUrl'
import CreatorClient from './CreatorClient'

type Props = {
  params: Promise<{ id: string }>
}

const SITE_NAME = 'Drawker（ドローカー）'
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://drawker.com'

// Supabase Storageの画像パスを完全なPublic URLに変換するヘルパー
const getFullImageUrl = (url: string | null | undefined, fallbackUrl: string): string => {
  if (!url || !url.trim()) return fallbackUrl
  const trimmed = url.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.includes('/storage/v1/object/portfolios/')) {
      return trimmed.replace('/storage/v1/object/portfolios/', '/storage/v1/object/public/portfolios/')
    }
    return trimmed
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  if (supabaseUrl) {
    const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed
    return `${supabaseUrl}/storage/v1/object/public/portfolios/${cleanPath}`
  }
  return fallbackUrl
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', id)
    .single()

  if (!profile || profile.is_public === false) {
    return {
      title: `クリエイターが見つかりません | ${SITE_NAME}`,
      robots: { index: false, follow: false },
    }
  }

  // 代表作品の画像を取得（アバター未設定時のOGP画像フォールバック用）
  const { data: firstPortfolio } = await supabase
    .from('portfolio_items')
    .select('image_url')
    .eq('user_id', id)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  const title = `${profile.display_name}のイラスト料金・ポートフォリオ依頼 | ${SITE_NAME}`
  const commercialText = profile.commercial_use_allowed ? '商用利用可' : '個人利用限定'
  const leadTimeText = profile.lead_time_days ? `最短${profile.lead_time_days}日でお届け` : '納期要相談'
  const description = `イラストレーター【${profile.display_name}】への直接依頼・見積もりページ。${leadTimeText} / ${commercialText}。SNSアイコン、キャラデザイン、立ち絵、ヘッダー等の制作実績・料金表を公開中！`

  // SNSシェア時（OGP・Twitterカード）はSEO用タイトルと分け、シンプルな個人カードにする
  // 改行はX(Twitter)のカードでは無視され price と comment がくっついて表示されるため、
  // 区切り文字「／」で連結する。プロフィール文が長い場合はカード側で不自然に
  // 切れないよう、ここで先に90文字＋「…」に丸める。
  const priceText = profile.price_min
    ? `最低参考価格${profile.price_min.toLocaleString()}円〜`
    : '料金：応相談'
  const rawProfileText =
    profile.status_comment?.trim() || `${profile.display_name}のポートフォリオ・見積もりページ`
  const profileText =
    rawProfileText.length > 90 ? `${rawProfileText.slice(0, 90)}…` : rawProfileText
  const shareTitle = `Drawker｜${profile.display_name}`
  const shareDescription = `${priceText} ／ ${profileText}`

  // 最初のポートフォリオ画像（なければアバター）を、正規化した完全URLで使用
  // どちらも無いクリエイターは、名前・アバター・代表作を合成した動的OGPカードにフォールバック
  const fallbackOgUrl = `${BASE_URL}/api/og/creator/${id}`
  const rawOgImage = firstPortfolio?.image_url || profile.avatar_url
  const ogImage = getFullImageUrl(rawOgImage, fallbackOgUrl)
  const canonicalUrl = `${BASE_URL}/creator/${id}`

  // Twitter URLの末尾スラッシュを除去してからユーザー名を抽出
  const twitterHandle = profile.twitter_url
    ? profile.twitter_url.replace(/\/$/, '').split('/').pop()
    : null

  return {
    title,
    description,
    keywords: [
      profile.display_name,
      'イラスト依頼',
      '絵師',
      '立ち絵依頼',
      'アイコン制作',
      'ポートフォリオ',
      'イラスト料金表',
      'Drawker',
      'ドローカー',
      ...(profile.tastes || []),
    ],
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
    other: {
      robots: 'noai, noimageai',
      googlebot: 'noai, noimageai',
    },
    openGraph: {
      title: shareTitle,
      description: shareDescription,
      url: canonicalUrl,
      siteName: SITE_NAME,
      locale: 'ja_JP',
      type: 'profile',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${profile.display_name}のポートフォリオ`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: shareTitle,
      description: shareDescription,
      images: [ogImage],
      ...(twitterHandle && {
        creator: `@${twitterHandle}`,
      }),
    },
  }
}

export default async function Page({ params }: Props) {
  const { id } = await params

  // 互いに依存しないクエリはPromise.allでまとめて並行実行し、サーバー応答を高速化する
  // （直列だと1件ずつ待つ分だけページの初期表示が遅くなっていた）
  const [profileRes, worksRes, formsRes, reviewRowsRes, creatorRingRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', id).single(),
    supabase.from('portfolio_items').select('*').eq('user_id', id).order('sort_order', { ascending: true }),
    // 複数の見積もりフォームに対応。新形式（estimate_forms）が無ければ
    // 旧形式（profiles.form_config）を1件だけのフォームとして扱う（後方互換）
    supabase.from('estimate_forms').select('*').eq('user_id', id).order('sort_order', { ascending: true }),
    // レビュー・評価。reviewer_id は auth.users のみ参照しており profiles を
    // 持たない一般ユーザーも投稿できるため、表示名・アイコンは別クエリで取得して手動で合成する
    supabase.from('reviews').select('*').eq('creator_id', id).order('created_at', { ascending: false }),
    // クリエイター本人の装着中アイコンリング
    supabase.from('public_equipped_rings').select('equipped_ring_id').eq('user_id', id).maybeSingle(),
  ])

  const profile = profileRes.data

  if (!profile || profile.is_public === false) {
    notFound()
  }

  const initialWorks = worksRes.data
  const estimateForms = formsRes.data
  const reviewRows = reviewRowsRes.data
  const creatorRingRow = creatorRingRes.data

  let reviewerProfileMap: Record<string, { display_name: string | null; avatar_url: string | null }> = {}
  let reviewerRingMap: Record<string, string> = {}
  if (reviewRows && reviewRows.length > 0) {
    const reviewerIds = Array.from(new Set(reviewRows.map((r) => r.reviewer_id)))
    const { data: reviewerProfiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', reviewerIds)

    reviewerProfileMap = Object.fromEntries(
      (reviewerProfiles || []).map((p) => [p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url }])
    )

    // アイコンリング（装着中のもののみ、残高は含まない公開ビューから取得）
    const { data: reviewerRings } = await supabase
      .from('public_equipped_rings')
      .select('user_id, equipped_ring_id')
      .in('user_id', reviewerIds)

    reviewerRingMap = Object.fromEntries(
      (reviewerRings || []).map((r) => [r.user_id, r.equipped_ring_id as string])
    )
  }

  const initialReviews = (reviewRows || []).map((r) => ({
    ...r,
    reviewer_display_name: reviewerProfileMap[r.reviewer_id]?.display_name || null,
    reviewer_avatar_url: reviewerProfileMap[r.reviewer_id]?.avatar_url || null,
    reviewer_ring_id: reviewerRingMap[r.reviewer_id] || null,
  }))

  const creatorRingId = creatorRingRow?.equipped_ring_id || null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.display_name,
    description: profile.status_comment || `${profile.display_name}のイラスト制作ポートフォリオ`,
    image: profile.avatar_url,
    jobTitle: 'Illustrator / Creator',
    url: `${BASE_URL}/creator/${id}`,
    knowsAbout: profile.tastes || ['Illustration', 'Design'],
    sameAs: [
      profile.twitter_url,
      profile.instagram_url,
      profile.pixiv_url,
      profile.website_url,
    ].filter(Boolean),
    offers: {
      '@type': 'Offer',
      availability:
        profile.status === 'available'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Person',
        name: profile.display_name,
      },
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <CreatorClient
        id={id}
        initialProfile={profile}
        initialWorks={initialWorks || []}
        initialForms={estimateForms || []}
        initialReviews={initialReviews}
        creatorRingId={creatorRingId}
      />
    </>
  )
}
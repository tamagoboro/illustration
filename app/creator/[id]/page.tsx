import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { supabase } from '@/lib/supabase'
import { serializeJsonLd } from '@/lib/safeUrl'
import { getOgCardVersion } from '@/lib/ogCard'
import { loadCreatorPageData } from '@/lib/creatorPageData'
import CreatorClient from './CreatorClient'
import PrivateCreatorPreview from './PrivateCreatorPreview'

type Props = {
  params: Promise<{ id: string }>
}

const SITE_NAME = 'Drawker（ドローカー）'
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://drawker.com'

// シェア用カード画像のURL。プロフィール更新やカードのデザイン変更で v が変わり、新しい画像として取り直される（lib/ogCard.ts）
const getOgImageUrl = (id: string, updatedAt?: string | null) =>
  `${BASE_URL}/api/og/creator/${id}?v=${getOgCardVersion(updatedAt)}`

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', id)
    .single()

  if (!profile) {
    return {
      title: `ページが見つかりません | ${SITE_NAME}`,
      robots: { index: false, follow: false },
    }
  }
  if (profile.is_public === false) {
    return {
      title: `非公開のポートフォリオ | ${SITE_NAME}`,
      robots: { index: false, follow: false },
    }
  }

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

  // 作品・名前・最安料金・受付状況・★評価・タグを1枚にまとめた動的カード（app/api/og/creator/[id]）
  const ogImage = getOgImageUrl(id, profile.updated_at)
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
    // ページ自体は検索に出すが、作品・アイコン画像は画像検索に載せない（無断転載・画像の一人歩き対策）。
    // 画像はSupabase Storage（別ドメイン）にあり画像側にヘッダーを付けられないため、
    // 画像を載せているこのページ側で noimageindex を指定する。
    robots: {
      index: true,
      follow: true,
      noimageindex: true,
      'max-image-preview': 'none',
      'max-snippet': -1,
      googleBot: {
        index: true,
        follow: true,
        noimageindex: true,
        'max-image-preview': 'none',
        'max-snippet': -1,
      },
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

  const data = await loadCreatorPageData(id)
  if (!data) notFound()
  const { profile, initialWorks, estimateForms, initialReviews, creatorRingId, initialSouls } = data

  // 非公開ページ：サーバーからは中身を一切送らない（ページのソースからも見えないように）。
  // 本人ならブラウザ側で読み込んでプレビュー表示し、それ以外の人には「非公開です」と案内する
  if (profile.is_public === false) {
    return <PrivateCreatorPreview id={id} />
  }

  // シェア用カード画像を先に作ってCDNにキャッシュさせておく（ページの応答を返した後に実行）。
  // カード画像の生成には数秒かかるため、Xのクローラーが初めて取りに来た時に生成が間に合わず
  // カードが出ない、ということを防ぐ。キャッシュ済みなら一瞬で返るので負荷はほぼ無い。
  after(async () => {
    try {
      await fetch(getOgImageUrl(id, profile.updated_at), { cache: 'no-store' })
    } catch {
      // 失敗してもページ表示には影響しない
    }
  })

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.display_name,
    description: profile.status_comment || `${profile.display_name}のイラスト制作ポートフォリオ`,
    // image（アイコン）は載せない。構造化データに画像URLがあると画像検索の対象になりやすいため
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
        initialWorks={initialWorks}
        initialForms={estimateForms}
        initialReviews={initialReviews}
        creatorRingId={creatorRingId}
        initialSouls={initialSouls}
      />
    </>
  )
}
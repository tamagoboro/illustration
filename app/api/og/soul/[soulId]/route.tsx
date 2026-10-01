import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import {
  WIDTH,
  HEIGHT,
  PADDING,
  MAIN,
  innerSize,
  fetchImage,
  fetchAndResize,
  loadFonts,
  renderWatermarkTile,
  placeWorks,
  composeBase,
  toJpegDataUrl,
  DrawkerLogo,
  type Placed,
} from '@/lib/ogImage'
import { COMMERCIAL_USE_LABELS, formatPrice, formatSoulPeriod, normalizeSoulListing } from '@/lib/soulListings'

// 魂募集をX等でシェアしたときのカード画像（1200×630）。
// キャラクターの画像（最大4枚・透かし焼き込み）・名前・金額・掲載期間・どんな人向けかを1枚に載せる。
// 画像の合成・透かし・フォント・速さの工夫は lib/ogImage.tsx を参照。
export const runtime = 'nodejs'

const VIOLET = '#7c3aed'
const SKY = '#0284c7'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text)

export async function GET(_request: Request, { params }: { params: Promise<{ soulId: string }> }) {
  const { soulId } = await params

  const { data: row } = await supabase.from('soul_listings').select('*').eq('id', soulId).maybeSingle()
  const { data: profile } = row
    ? await supabase.from('profiles').select('display_name, avatar_url, is_public').eq('user_id', row.user_id).maybeSingle()
    : { data: null }

  const isPublic = !!row && !!profile && profile.is_public !== false
  const listing = isPublic ? normalizeSoulListing(row) : null
  const creatorName = isPublic ? profile!.display_name?.trim() || 'クリエイター' : 'Drawker'
  const title = listing?.title || '魂募集'
  const prices = (listing?.prices || []).slice(0, 3)
  const periodText = listing ? `掲載 ${formatSoulPeriod(listing)}` : ''
  const commercialText = listing ? COMMERCIAL_USE_LABELS[listing.commercial_use] : ''
  const target = listing?.target_audience ? truncate(listing.target_audience.replace(/\s+/g, ' '), 40) : ''
  const watermark = `© ${creatorName}  drawker.com`

  const allText = [
    title,
    creatorName,
    watermark,
    periodText,
    commercialText,
    target,
    ...prices.map((p) => `${p.label}${formatPrice(p.price)}`),
    '魂募集中こんな方に',
    'drawker.com ｜ イラスト依頼・比較サイト',
    'Drawker',
    '🎭',
  ].join('')

  const imageUrls = listing?.image_urls || []
  const [fonts, mainRaw, avatarRaw, ...subRaws] = await Promise.all([
    loadFonts(allText),
    imageUrls[0] ? fetchAndResize(imageUrls[0], ...innerSize(MAIN)) : Promise.resolve(null),
    isPublic && profile!.avatar_url ? fetchAndResize(profile!.avatar_url, 96, 96) : Promise.resolve(null),
    // 小さい画像は、取得できた枚数で大きさが決まるので元画像のまま取得し、後で切り抜く
    ...imageUrls.slice(1, 4).map((u) => fetchImage(u)),
  ])

  const tile = mainRaw ? await renderWatermarkTile(watermark, fonts) : null
  const placed: Placed[] = mainRaw && tile ? await placeWorks(mainRaw, subRaws.filter(Boolean) as Buffer[], tile) : []
  const worksRight = placed.length > 0 ? Math.max(...placed.map((p) => p.left + p.width)) : PADDING - 36
  const infoLeft = worksRight + 36
  const infoWidth = WIDTH - PADDING - infoLeft

  const [base, avatar] = await Promise.all([
    composeBase(mainRaw, placed, { left: infoLeft, width: infoWidth }),
    avatarRaw ? toJpegDataUrl(avatarRaw) : null,
  ])

  const titleFontSize = title.length > 12 ? 36 : title.length > 8 ? 42 : 48

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', fontFamily: 'NotoSansJP' }}>
        {/* 背景・画像・透かし・影は sharp で合成済みの1枚 */}
        <img src={base} width={WIDTH} height={HEIGHT} style={{ position: 'absolute', top: 0, left: 0 }} />

        {/* 情報カード */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'absolute',
            left: infoLeft,
            top: PADDING,
            width: infoWidth,
            height: HEIGHT - PADDING * 2,
            padding: '28px 30px',
            borderRadius: 32,
            background: 'rgba(255,255,255,0.93)',
            border: '2px solid #ffffff',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* 魂募集中バッジ */}
            <div
              style={{
                display: 'flex',
                alignSelf: 'flex-start',
                alignItems: 'center',
                gap: 8,
                padding: '4px 16px',
                borderRadius: 999,
                fontSize: 19,
                fontWeight: 900,
                color: '#ffffff',
                background: `linear-gradient(90deg, ${VIOLET}, #c026d3)`,
              }}
            >
              🎭 魂募集中
            </div>

            {/* キャラクター名 */}
            <div style={{ display: 'flex', fontSize: titleFontSize, fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
              {title}
            </div>

            {/* クリエイター */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {avatar && <img src={avatar} width={30} height={30} style={{ borderRadius: 15, border: `2px solid ${VIOLET}` }} />}
              <div style={{ display: 'flex', fontSize: 18, fontWeight: 700, color: '#475569' }}>{creatorName}</div>
            </div>

            {/* 金額 */}
            {prices.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  padding: '8px 16px',
                  borderRadius: 18,
                  background: '#f8fafc',
                  border: '2px solid #f1f5f9',
                }}
              >
                {prices.map((p) => (
                  <div key={p.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: '#475569' }}>{truncate(p.label, 14)}</div>
                    <div style={{ display: 'flex', fontSize: 25, fontWeight: 900, color: SKY }}>{formatPrice(p.price)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* 期間・商用利用 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[periodText, commercialText].filter(Boolean).map((t) => (
                <div
                  key={t}
                  style={{
                    display: 'flex',
                    padding: '3px 12px',
                    borderRadius: 10,
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#334155',
                    background: '#f1f5f9',
                  }}
                >
                  {t}
                </div>
              ))}
            </div>

            {/* どんな人向けか */}
            {target && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', fontSize: 14, fontWeight: 900, color: VIOLET }}>こんな方に</div>
                <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: '#334155', lineHeight: 1.3 }}>{target}</div>
              </div>
            )}
          </div>

          {/* ブランド */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 12, borderTop: '2px solid #f1f5f9' }}>
            <DrawkerLogo size={38} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>Drawker</div>
              <div style={{ display: 'flex', fontSize: 14, fontWeight: 700, color: '#64748b' }}>
                drawker.com ｜ イラスト依頼・比較サイト
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts,
      headers: {
        // SNS側のクローラーが何度も叩いても重くならないよう、CDNで1時間キャッシュする
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        // SNSのカード表示には使うが、画像検索には載せない
        'X-Robots-Tag': 'noindex, noimageindex',
      },
    }
  )
}

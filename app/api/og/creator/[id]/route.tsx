import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import {
  WIDTH,
  HEIGHT,
  PADDING,
  MAIN,
  MODERATED_PLACEHOLDER_URL,
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

// クリエイターページをX等でシェアしたときのカード画像（1200×630）。
// 作品（最大3枚）・名前・最安料金・受付状況・★評価・タグ・納期をまとめて1枚に載せる。
// 画像の合成・透かし・フォント・速さの工夫は lib/ogImage.tsx を参照。
export const runtime = 'nodejs'

// アイコンの枠・料金・タグの色。どの作品の上でも読みやすいサイトの水色に固定
const ACCENT = '#0284c7'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: profile }, { data: works }, { data: reviews }] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, avatar_url, price_min, status, tastes, lead_time_days, commercial_use_allowed, is_public')
      .eq('user_id', id)
      .maybeSingle(),
    supabase
      .from('portfolio_items')
      .select('image_url')
      .eq('user_id', id)
      .order('sort_order', { ascending: true })
      .limit(5),
    supabase.from('reviews').select('rating').eq('creator_id', id),
  ])

  const isPublic = !!profile && profile.is_public !== false
  const name = isPublic ? profile.display_name?.trim() || 'クリエイター' : 'Drawker'
  const priceText = isPublic && profile.price_min ? `¥${profile.price_min.toLocaleString()}〜` : '応相談'
  const isAvailable = profile?.status === 'available'
  const statusText = isAvailable ? '受付中・即対応可' : '相談受付中'
  const tags: string[] = isPublic && Array.isArray(profile.tastes) ? profile.tastes.slice(0, 4) : []
  const leadTimeText = isPublic && profile.lead_time_days ? `納期目安 ${profile.lead_time_days}日` : '納期 要相談'
  const commercialText = isPublic && profile.commercial_use_allowed ? '商用利用OK' : ''
  const watermark = `© ${name}  drawker.com`

  const reviewCount = isPublic ? (reviews || []).length : 0
  const reviewAvg = reviewCount > 0 ? (reviews || []).reduce((sum, r) => sum + (r.rating || 0), 0) / reviewCount : 0
  const roundedAvg = Math.round(reviewAvg * 2) / 2
  const ratingText = reviewCount > 0 ? `${reviewAvg.toFixed(1)}（${reviewCount}件）` : ''

  const workUrls = isPublic
    ? (works || [])
        .map((w) => w.image_url as string)
        .filter((u) => u && u !== MODERATED_PLACEHOLDER_URL)
        .slice(0, 3)
    : []

  const allText = [
    name,
    watermark,
    priceText,
    statusText,
    leadTimeText,
    commercialText,
    ratingText,
    '最安目安',
    'レビューはまだありません',
    'drawker.com ｜ イラスト依頼・比較サイト',
    'Drawker',
    '#★　',
    ...tags,
  ].join('')

  // 画像の取得・縮小とフォントの取得は互いに独立しているので、すべて並行して行う
  const [fonts, mainRaw, avatarRaw, ...subRaws] = await Promise.all([
    loadFonts(allText),
    workUrls[0] ? fetchAndResize(workUrls[0], ...innerSize(MAIN)) : Promise.resolve(null),
    isPublic && profile.avatar_url ? fetchAndResize(profile.avatar_url, 184, 184) : Promise.resolve(null),
    // 小さい作品は、取得できた枚数で大きさが決まるので元画像のまま取得し、後で切り抜く
    ...workUrls.slice(1).map((u) => fetchImage(u)),
  ])

  // 作品の配置（大1枚＋小2枚まで）。作品が無ければ情報カードを全幅にする
  const tile = mainRaw ? await renderWatermarkTile(watermark, fonts) : null
  const placed: Placed[] = mainRaw && tile ? await placeWorks(mainRaw, subRaws.filter(Boolean) as Buffer[], tile) : []
  const worksRight = placed.length > 0 ? Math.max(...placed.map((p) => p.left + p.width)) : PADDING - 36
  const infoLeft = worksRight + 36
  const infoWidth = WIDTH - PADDING - infoLeft

  const [base, avatar] = await Promise.all([
    composeBase(mainRaw, placed, { left: infoLeft, width: infoWidth }),
    avatarRaw ? toJpegDataUrl(avatarRaw) : null,
  ])

  const nameFontSize = name.length > 12 ? 38 : name.length > 8 ? 46 : 54

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', fontFamily: 'NotoSansJP' }}>
        {/* 背景・作品・透かし・影は sharp で合成済みの1枚 */}
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
            padding: '30px 32px',
            borderRadius: 32,
            background: 'rgba(255,255,255,0.92)',
            border: '2px solid #ffffff',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* アイコン・名前・受付状況 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {avatar && (
                <img src={avatar} width={92} height={92} style={{ borderRadius: 46, border: `4px solid ${ACCENT}` }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignSelf: 'flex-start',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 14px',
                    borderRadius: 999,
                    fontSize: 18,
                    fontWeight: 700,
                    color: isAvailable ? '#047857' : '#b45309',
                    background: isAvailable ? '#d1fae5' : '#fef3c7',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      background: isAvailable ? '#10b981' : '#f59e0b',
                    }}
                  />
                  {statusText}
                </div>
                <div style={{ display: 'flex', fontSize: nameFontSize, fontWeight: 900, color: '#0f172a', lineHeight: 1.15 }}>
                  {name}
                </div>
              </div>
            </div>

            {/* ★評価 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {reviewCount > 0 ? (
                <>
                  <div style={{ display: 'flex', fontSize: 28 }}>
                    {[1, 2, 3, 4, 5].map((i) => {
                      const fill = roundedAvg >= i ? 1 : roundedAvg >= i - 0.5 ? 0.5 : 0
                      return (
                        <div key={i} style={{ display: 'flex', position: 'relative', color: '#e2e8f0' }}>
                          ★
                          <div
                            style={{
                              display: 'flex',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: `${fill * 100}%`,
                              overflow: 'hidden',
                              color: '#f59e0b',
                            }}
                          >
                            ★
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', fontSize: 22, fontWeight: 900, color: '#334155' }}>{ratingText}</div>
                </>
              ) : (
                <div style={{ display: 'flex', fontSize: 18, fontWeight: 700, color: '#94a3b8' }}>
                  ★ レビューはまだありません
                </div>
              )}
            </div>

            {/* 料金 */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: '#64748b' }}>最安目安</div>
              <div style={{ display: 'flex', fontSize: 72, fontWeight: 900, color: ACCENT, lineHeight: 1.05 }}>
                {priceText}
              </div>
            </div>

            {/* 条件・タグ */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[leadTimeText, commercialText].filter(Boolean).map((t) => (
                <div
                  key={t}
                  style={{
                    display: 'flex',
                    padding: '5px 14px',
                    borderRadius: 12,
                    fontSize: 19,
                    fontWeight: 700,
                    color: '#334155',
                    background: '#f1f5f9',
                  }}
                >
                  {t}
                </div>
              ))}
              {tags.map((t) => (
                <div
                  key={t}
                  style={{
                    display: 'flex',
                    padding: '5px 14px',
                    borderRadius: 999,
                    fontSize: 19,
                    fontWeight: 700,
                    color: ACCENT,
                    background: `${ACCENT}14`,
                    border: `2px solid ${ACCENT}40`,
                  }}
                >
                  #{t}
                </div>
              ))}
            </div>
          </div>

          {/* ブランド */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 16, borderTop: '2px solid #f1f5f9' }}>
            <DrawkerLogo />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 24, fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
                Drawker
              </div>
              <div style={{ display: 'flex', fontSize: 15, fontWeight: 700, color: '#64748b' }}>
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

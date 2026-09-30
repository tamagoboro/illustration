import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

// クリエイターページをX等でシェアしたときのカード画像（1200×630）。
// 作品（最大3枚）・名前・最安料金・受付状況・★評価・タグ・納期をまとめて1枚に載せる。
//
// ・イラスト保護 … 作品の上に「© クリエイター名 drawker.com」の透かしを斜めに敷き詰める。
//   出力は1枚のPNGなので透かしは画像に焼き込まれ、カード画像を保存されても作者名が残る。
//   作品は表示サイズの約1.5倍までしか埋め込まないため、カードから高解像度の原画は取り出せない。
// ・背景 … 1枚目の作品を強くぼかして敷き、クリエイターごとに作品の色味に合ったカードにする。
// ・Node.jsランタイム … 作品画像はWebPで保存されているが、next/og（satori）はWebPを読めないため、
//   sharpでJPEGに変換してから埋め込む（Edgeランタイムではsharpが使えない）。
// ・日本語フォント … next/og の標準フォントには日本語が無く□になるため、
//   Google Fontsから「このカードで使う文字だけ」を含むNoto Sans JPを取得して使う。
//   透かしもsharp（サーバーのフォント依存）ではなくこちらで描くので、日本語の名前でも文字化けしない。
export const runtime = 'nodejs'

const WIDTH = 1200
const HEIGHT = 630
const MODERATED_PLACEHOLDER_URL = '/moderated-placeholder.svg'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

// アクセントカラー（アイコンの枠・料金・タグ）。クリエイターのテーマカラーではなく、
// どの作品の上でも読みやすいサイトの水色に固定する
const ACCENT = '#0284c7'

// 画像を取得し、指定サイズに切り抜いたJPEGのdata URLにする（失敗時はnull）
async function toJpegDataUrl(url: string, width: number, height: number, options: { blur?: number } = {}) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const input = Buffer.from(await res.arrayBuffer())
    let pipeline = sharp(input).resize(Math.round(width * 1.5), Math.round(height * 1.5), {
      fit: 'cover',
      position: sharp.strategy.attention,
    })
    if (options.blur) pipeline = pipeline.blur(options.blur).modulate({ brightness: 1.08, saturation: 1.2 })
    const output = await pipeline.jpeg({ quality: options.blur ? 60 : 82 }).toBuffer()
    return `data:image/jpeg;base64,${output.toString('base64')}`
  } catch (e) {
    console.error('OGP画像の変換エラー:', url, e)
    return null
  }
}

// Google Fontsから、textに含まれる文字だけのサブセットフォント（TTF）を取得する
async function loadJapaneseFont(text: string, weight: 400 | 700 | 900) {
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${weight}&text=${encodeURIComponent(text)}`
      )
    ).text()
    const fontUrl = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1]
    if (!fontUrl) return null
    return await (await fetch(fontUrl)).arrayBuffer()
  } catch (e) {
    console.error('OGPフォントの取得エラー:', e)
    return null
  }
}

// 作品1枚分（画像＋焼き込み透かし）
function ProtectedWork({ src, width, height, watermark }: { src: string; width: number; height: number; watermark: string }) {
  const rows = Math.ceil((height * 2) / 40)
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width,
        height,
        borderRadius: 24,
        overflow: 'hidden',
        border: '6px solid rgba(255,255,255,0.95)',
        boxShadow: '0 16px 40px rgba(15,23,42,0.28)',
      }}
    >
      <img src={src} width={width} height={height} style={{ objectFit: 'cover' }} />
      {/* 透かし：画像より大きい面を回転させて敷き詰め、はみ出しは overflow で切る */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          position: 'absolute',
          top: -height * 0.5,
          left: -width * 0.8,
          width: width * 2.6,
          height: height * 2,
          transform: 'rotate(-28deg)',
          gap: 18,
        }}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              fontSize: 17,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.42)',
              textShadow: '0 0 2px rgba(15,23,42,0.35)',
              whiteSpace: 'nowrap',
              marginLeft: i % 2 === 0 ? 0 : -90,
            }}
          >
            {`${watermark}　　`.repeat(6)}
          </div>
        ))}
      </div>
    </div>
  )
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: profile }, { data: works }, { data: reviews }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'display_name, avatar_url, price_min, status, tastes, lead_time_days, commercial_use_allowed, is_public'
      )
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

  // 作品の並べ方: 大1枚＋小2枚（2枚のときは小1枚）。背景は1枚目を強くぼかしたもの
  const [mainImage, background, ...subImages] = await Promise.all([
    workUrls[0] ? toJpegDataUrl(workUrls[0], 380, 530) : Promise.resolve(null),
    workUrls[0] ? toJpegDataUrl(workUrls[0], WIDTH / 3, HEIGHT / 3, { blur: 18 }) : Promise.resolve(null),
    ...workUrls.slice(1).map((u) => toJpegDataUrl(u, 210, 257)),
  ])
  const avatar = isPublic && profile.avatar_url ? await toJpegDataUrl(profile.avatar_url, 92, 92) : null
  const validSubImages = subImages.filter(Boolean) as string[]

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
    'イラスト依頼・ポートフォリオ比較',
    'Drawker',
    'drawker.com',
    '#★　',
    ...tags,
  ].join('')
  const [regular, bold, black] = await Promise.all([
    loadJapaneseFont(allText, 400),
    loadJapaneseFont(allText, 700),
    loadJapaneseFont(allText, 900),
  ])
  const fonts = [
    regular && { name: 'NotoSansJP', data: regular, weight: 400 as const, style: 'normal' as const },
    bold && { name: 'NotoSansJP', data: bold, weight: 700 as const, style: 'normal' as const },
    black && { name: 'NotoSansJP', data: black, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 700 | 900; style: 'normal' }[]

  const nameFontSize = name.length > 12 ? 38 : name.length > 8 ? 46 : 54

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          fontFamily: 'NotoSansJP',
          background: `linear-gradient(135deg, #e0f2fe 0%, #f8fafc 55%, ${ACCENT}33 100%)`,
        }}
      >
        {/* ぼかした作品の背景＋白いベール */}
        {background && (
          <img
            src={background}
            width={WIDTH}
            height={HEIGHT}
            style={{ position: 'absolute', top: 0, left: 0, objectFit: 'cover' }}
          />
        )}
        {background && (
          <div
            style={{
              display: 'flex',
              position: 'absolute',
              top: 0,
              left: 0,
              width: WIDTH,
              height: HEIGHT,
              background:
                'linear-gradient(90deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.55) 100%)',
            }}
          />
        )}

        <div style={{ display: 'flex', width: '100%', height: '100%', padding: 44, gap: 36 }}>
          {/* 作品エリア */}
          {mainImage && (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <ProtectedWork src={mainImage} width={380} height={530} watermark={watermark} />
              {validSubImages.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {validSubImages.map((src, i) => (
                    <ProtectedWork key={i} src={src} width={210} height={257} watermark={watermark} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 情報カード */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              flex: 1,
              minWidth: 0,
              padding: '30px 32px',
              borderRadius: 32,
              background: 'rgba(255,255,255,0.9)',
              border: '2px solid rgba(255,255,255,1)',
              boxShadow: '0 16px 40px rgba(15,23,42,0.18)',
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
              <div
                style={{
                  display: 'flex',
                  width: 44,
                  height: 44,
                  borderRadius: 15,
                  background: 'linear-gradient(45deg, #38bdf8, #67e8f9)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="30" height="30" viewBox="0 0 100 100">
                  <g fill="#ffffff">
                    <circle cx="32" cy="52" r="16" />
                    <circle cx="52" cy="39" r="21" />
                    <circle cx="71" cy="53" r="15" />
                    <rect x="18" y="54" width="64" height="22" rx="11" />
                  </g>
                </svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: 24, fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
                  Drawker
                </div>
                <div style={{ display: 'flex', fontSize: 15, fontWeight: 400, color: '#64748b' }}>
                  イラスト依頼・ポートフォリオ比較
                </div>
              </div>
              <div style={{ display: 'flex', marginLeft: 'auto', fontSize: 18, fontWeight: 700, color: '#0284c7' }}>
                drawker.com
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

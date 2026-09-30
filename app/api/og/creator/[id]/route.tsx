import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

// クリエイターページをX等でシェアしたときのカード画像（1200×630）。
// 作品（最大3枚）・名前・最安料金・受付状況・★評価・タグ・納期をまとめて1枚に載せる。
//
// ・イラスト保護 … 作品の上に「© クリエイター名 drawker.com」の透かしを斜めに敷き詰めて焼き込む。
//   カードを保存されても作者名が残り、作品はカードの表示サイズでしか埋め込まないため高解像度の原画は取り出せない。
// ・背景 … 1枚目の作品を強くぼかして敷き、クリエイターごとに作品の色味に合ったカードにする。
//
// ■ 速さについて（Xのクローラーは数秒で諦めるため、生成は数秒以内に収める必要がある）
//   next/og（satori）は、大量の文字・影（ぼかし）・大きな画像の描画がとても遅い。
//   以前は透かし文字を数千文字並べ、影も付けていたため生成に30秒以上かかり、Xにカードが表示されなかった。
//   そこで画像まわり（背景・作品・透かし・白枠・角丸・影）はすべて sharp で1枚の画像に合成しておき、
//   satori には「その1枚＋右側の情報カードの文字」だけを描かせる。
//
// ・Node.jsランタイム … 作品画像はWebPで保存されているが satori はWebPを読めず、sharpで処理する必要があるため。
// ・日本語フォント … next/og の標準フォントには日本語が無いため、Google Fontsから
//   「このカードで使う文字だけ」を含むNoto Sans JPを取得して使う（透かしの文字も同じフォントで描く）。
export const runtime = 'nodejs'

const WIDTH = 1200
const HEIGHT = 630
const PADDING = 44
const GAP = 16
const BORDER = 6
const MODERATED_PLACEHOLDER_URL = '/moderated-placeholder.svg'

// 作品カードの大きさ（白枠込み）
const MAIN = { width: 392, height: 542 }
const SUB = { width: 222, height: 263 }
// 作品が2枚だけのときは、2枚目も縦長にして大きい1枚目と高さをそろえる（空白が出ないように）
const SUB_TALL = { width: 222, height: 542 }

// アイコンの枠・料金・タグの色。どの作品の上でも読みやすいサイトの水色に固定
const ACCENT = '#0284c7'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

type OgFont = { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }
type Placed = { image: Buffer; left: number; top: number; width: number; height: number }

// 画像を取得する（失敗時はnull）
async function fetchImage(url: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch (e) {
    console.error('OGP画像の取得エラー:', url, e)
    return null
  }
}

// 画像を指定サイズに切り抜く（絵の目立つ部分が残るように位置を自動で選ぶ）
const cropTo = (input: Buffer, width: number, height: number) =>
  sharp(input).resize(width, height, { fit: 'cover', position: sharp.strategy.attention }).png().toBuffer()

// 画像を取得し、指定サイズに切り抜く（失敗時はnull）
async function fetchAndResize(url: string, width: number, height: number) {
  const input = await fetchImage(url)
  if (!input) return null
  try {
    return await cropTo(input, width, height)
  } catch (e) {
    console.error('OGP画像の変換エラー:', url, e)
    return null
  }
}

// Google Fontsから、textに含まれる文字だけのサブセットフォント（TTF）を取得する
async function loadJapaneseFont(text: string, weight: 700 | 900) {
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

// 透かしの「1コマ」（2行・互い違い）を透明PNGで作る。文字を描くのはこの小さな1コマだけにし、
// 敷き詰めは sharp の画像合成で行う
const TILE_WIDTH = 380
const TILE_HEIGHT = 84
async function renderWatermarkTile(text: string, fonts: OgFont[]) {
  const fontSize = text.length > 26 ? 12 : text.length > 20 ? 14 : 16
  const line = (left: number, top: number) => (
    <div
      style={{
        display: 'flex',
        position: 'absolute',
        left,
        top,
        fontSize,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.5)',
        textShadow: '0 0 2px rgba(15,23,42,0.45)',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  )
  const tile = new ImageResponse(
    (
      <div style={{ display: 'flex', position: 'relative', width: TILE_WIDTH, height: TILE_HEIGHT }}>
        {line(8, 8)}
        {line(8 - TILE_WIDTH / 2, 8 + TILE_HEIGHT / 2)}
        {line(8 + TILE_WIDTH / 2, 8 + TILE_HEIGHT / 2)}
      </div>
    ),
    { width: TILE_WIDTH, height: TILE_HEIGHT, fonts }
  )
  return Buffer.from(await tile.arrayBuffer())
}

// 画像に透かしを斜めに敷き詰めて焼き込む
async function burnWatermark(image: Buffer, width: number, height: number, tile: Buffer) {
  // 回転後も画像全体を覆えるよう、対角線より大きい正方形に敷き詰めてから回転し、中央を切り出す
  const size = Math.ceil(Math.hypot(width, height)) + TILE_WIDTH
  const pattern = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: tile, tile: true, top: 0, left: 0 }])
    .png()
    .toBuffer()
  const rotated = await sharp(pattern)
    .rotate(-28, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer({ resolveWithObject: true })
  const overlay = await sharp(rotated.data)
    .extract({
      left: Math.floor((rotated.info.width - width) / 2),
      top: Math.floor((rotated.info.height - height) / 2),
      width,
      height,
    })
    .png()
    .toBuffer()
  return sharp(image).composite([{ input: overlay }]).png().toBuffer()
}

const roundedRectSvg = (width: number, height: number, radius: number, fill: string) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="${fill}"/></svg>`
  )

// 作品を白枠・角丸のカードにする（width/heightは白枠込み）
async function framedWork(work: Buffer, width: number, height: number) {
  const inner = await sharp(work)
    .composite([{ input: roundedRectSvg(width - BORDER * 2, height - BORDER * 2, 18, '#fff'), blend: 'dest-in' }])
    .png()
    .toBuffer()
  return sharp(roundedRectSvg(width, height, 24, 'rgba(255,255,255,0.96)'))
    .composite([{ input: inner, left: BORDER, top: BORDER }])
    .png()
    .toBuffer()
}

// 背景（ぼかした作品＋白いベール）・影・作品カードを1枚に合成する
async function composeBase(backgroundRaw: Buffer | null, works: Placed[], infoCard: { left: number; width: number }) {
  const veil = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"><defs><linearGradient id="v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.15"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0.55"/></linearGradient></defs><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#v)"/></svg>`
  )
  const plain = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0f2fe"/><stop offset="0.55" stop-color="#f8fafc"/><stop offset="1" stop-color="#cffafe"/></linearGradient></defs><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)"/></svg>`
  )
  const background = backgroundRaw
    ? await sharp(backgroundRaw)
        .resize(WIDTH, HEIGHT, { fit: 'cover' })
        .blur(30)
        .modulate({ brightness: 1.08, saturation: 1.2 })
        .composite([{ input: veil }])
        .png()
        .toBuffer()
    : await sharp(plain).png().toBuffer()

  // 影：作品カードと情報カードの形の黒い角丸をぼかして、少し下にずらして敷く
  const shadowRects = [
    ...works.map((w) => `<rect x="${w.left}" y="${w.top + 12}" width="${w.width}" height="${w.height}" rx="24" fill="#0f172a" fill-opacity="0.28"/>`),
    `<rect x="${infoCard.left}" y="${PADDING + 12}" width="${infoCard.width}" height="${HEIGHT - PADDING * 2}" rx="32" fill="#0f172a" fill-opacity="0.16"/>`,
  ].join('')
  const shadow = await sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">${shadowRects}</svg>`)
  )
    .blur(16)
    .png()
    .toBuffer()

  const cards = await Promise.all(works.map((w) => framedWork(w.image, w.width, w.height)))
  const base = await sharp(background)
    .composite([{ input: shadow }, ...cards.map((card, i) => ({ input: card, left: works[i].left, top: works[i].top }))])
    .jpeg({ quality: 85 })
    .toBuffer()
  return `data:image/jpeg;base64,${base.toString('base64')}`
}

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
  const inner = (size: { width: number; height: number }) => [size.width - BORDER * 2, size.height - BORDER * 2] as const
  const [boldFont, blackFont, mainRaw, avatarRaw, ...subRaws] = await Promise.all([
    loadJapaneseFont(allText, 700),
    loadJapaneseFont(allText, 900),
    workUrls[0] ? fetchAndResize(workUrls[0], ...inner(MAIN)) : Promise.resolve(null),
    isPublic && profile.avatar_url ? fetchAndResize(profile.avatar_url, 184, 184) : Promise.resolve(null),
    // 小さい作品は、取得できた枚数で大きさが決まるので元画像のまま取得し、後で切り抜く
    ...workUrls.slice(1).map((u) => fetchImage(u)),
  ])
  const fonts = [
    boldFont && { name: 'NotoSansJP', data: boldFont, weight: 700 as const, style: 'normal' as const },
    blackFont && { name: 'NotoSansJP', data: blackFont, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as OgFont[]

  // 作品の配置: 大1枚＋小2枚（小が1枚なら縦長1枚）。作品が無ければ情報カードを全幅にする
  const tile = mainRaw ? await renderWatermarkTile(watermark, fonts) : null
  const validSubs = subRaws.filter(Boolean) as Buffer[]
  const placed: Placed[] = []
  if (mainRaw && tile) {
    const [mw, mh] = inner(MAIN)
    placed.push({ image: await burnWatermark(mainRaw, mw, mh, tile), left: PADDING, top: PADDING, ...MAIN })
    const subSize = validSubs.length >= 2 ? SUB : SUB_TALL
    const [sw, sh] = inner(subSize)
    const subLeft = PADDING + MAIN.width + GAP
    const subTops = validSubs.length >= 2 ? [PADDING, HEIGHT - PADDING - SUB.height] : [PADDING]
    const burned = await Promise.all(
      validSubs.slice(0, 2).map(async (original) => {
        try {
          return await burnWatermark(await cropTo(original, sw, sh), sw, sh, tile)
        } catch (e) {
          console.error('OGP画像の変換エラー（小さい作品）:', e)
          return null
        }
      })
    )
    burned.forEach((image, i) => image && placed.push({ image, left: subLeft, top: subTops[i], ...subSize }))
  }
  const worksRight = placed.length > 0 ? Math.max(...placed.map((p) => p.left + p.width)) : PADDING - 36
  const infoLeft = worksRight + 36
  const infoWidth = WIDTH - PADDING - infoLeft

  const [base, avatar] = await Promise.all([
    composeBase(mainRaw, placed, { left: infoLeft, width: infoWidth }),
    avatarRaw ? sharp(avatarRaw).jpeg({ quality: 85 }).toBuffer().then((b) => `data:image/jpeg;base64,${b.toString('base64')}`) : null,
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

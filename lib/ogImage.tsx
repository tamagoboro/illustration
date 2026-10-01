import 'server-only'
import { ImageResponse } from 'next/og'
import sharp from 'sharp'

// シェア用カード画像（OGP）の共通部品。クリエイターのカード（app/api/og/creator）と
// 魂募集のカード（app/api/og/soul）で使う。
//
// ■ 速さについて（Xのクローラーは数秒で諦めるため、生成は数秒以内に収める必要がある）
//   next/og（satori）は、大量の文字・影（ぼかし）・大きな画像の描画がとても遅い。
//   そこで画像まわり（背景・作品・透かし・白枠・角丸・影）はすべて sharp で1枚の画像に合成しておき、
//   satori には「その1枚＋右側の情報カードの文字」だけを描かせる。
// ・イラスト保護 … 作品の上に「© 名前 drawker.com」の透かしを斜めに敷き詰めて焼き込む。
//   作品はカードの表示サイズでしか埋め込まないため、カードから高解像度の原画は取り出せない。
// ・Node.jsランタイム … 作品画像はWebPで保存されているが satori はWebPを読めず、sharpで処理する必要がある。
// ・日本語フォント … next/og の標準フォントには日本語が無いため、Google Fontsから
//   「このカードで使う文字だけ」を含むNoto Sans JPを取得して使う（透かしの文字も同じフォントで描く）。

export const WIDTH = 1200
export const HEIGHT = 630
export const PADDING = 44
export const GAP = 16
export const BORDER = 6
export const MODERATED_PLACEHOLDER_URL = '/moderated-placeholder.svg'

// 作品カードの大きさ（白枠込み）
export const MAIN = { width: 392, height: 542 }
export const SUB = { width: 222, height: 263 }
// 作品が2枚だけのときは、2枚目も縦長にして大きい1枚目と高さをそろえる（空白が出ないように）
export const SUB_TALL = { width: 222, height: 542 }

export type OgFont = { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }
export type Placed = { image: Buffer; left: number; top: number; width: number; height: number }

// 画像を取得する（失敗時はnull）
export async function fetchImage(url: string) {
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
export const cropTo = (input: Buffer, width: number, height: number) =>
  sharp(input).resize(width, height, { fit: 'cover', position: sharp.strategy.attention }).png().toBuffer()

// 画像を取得し、指定サイズに切り抜く（失敗時はnull）
export async function fetchAndResize(url: string, width: number, height: number) {
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
export async function loadJapaneseFont(text: string, weight: 700 | 900) {
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
export const TILE_WIDTH = 380
export const TILE_HEIGHT = 84
export async function renderWatermarkTile(text: string, fonts: OgFont[]) {
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
export async function burnWatermark(image: Buffer, width: number, height: number, tile: Buffer) {
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
export async function framedWork(work: Buffer, width: number, height: number) {
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
export async function composeBase(backgroundRaw: Buffer | null, works: Placed[], infoCard: { left: number; width: number }) {
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

// 小さい作品が3枚のときの大きさ（大1枚＋小3枚＝合計4枚）
export const SUB_THIRD = { width: 222, height: 170 }

export const innerSize = (size: { width: number; height: number }) =>
  [size.width - BORDER * 2, size.height - BORDER * 2] as const

// 作品の配置: 大1枚（左）＋右に小さい作品を縦に並べる。
//   小0枚 → 大1枚だけ / 小1枚 → 縦長1枚 / 小2枚 → 2段 / 小3枚 → 3段
// mainRaw は innerSize(MAIN) に切り抜き済み、subOriginals は元画像のまま渡す（枚数で大きさが決まるため）
export async function placeWorks(mainRaw: Buffer, subOriginals: Buffer[], tile: Buffer): Promise<Placed[]> {
  const [mw, mh] = innerSize(MAIN)
  const placed: Placed[] = [{ image: await burnWatermark(mainRaw, mw, mh, tile), left: PADDING, top: PADDING, ...MAIN }]

  const subs = subOriginals.slice(0, 3)
  if (subs.length === 0) return placed
  const subSize = subs.length === 1 ? SUB_TALL : subs.length === 2 ? SUB : SUB_THIRD
  const [sw, sh] = innerSize(subSize)
  const subLeft = PADDING + MAIN.width + GAP
  const burned = await Promise.all(
    subs.map(async (original) => {
      try {
        return await burnWatermark(await cropTo(original, sw, sh), sw, sh, tile)
      } catch (e) {
        console.error('OGP画像の変換エラー（小さい作品）:', e)
        return null
      }
    })
  )
  const valid = burned.filter(Boolean) as Buffer[]
  // 実際に使えた枚数で、上下に均等に並べる
  const step = valid.length > 1 ? (HEIGHT - PADDING * 2 - subSize.height) / (valid.length - 1) : 0
  valid.forEach((image, i) => placed.push({ image, left: subLeft, top: Math.round(PADDING + step * i), ...subSize }))
  return placed
}

// フォント（太字・極太）をまとめて取得する
export async function loadFonts(text: string): Promise<OgFont[]> {
  const [bold, black] = await Promise.all([loadJapaneseFont(text, 700), loadJapaneseFont(text, 900)])
  return [
    bold && { name: 'NotoSansJP', data: bold, weight: 700 as const, style: 'normal' as const },
    black && { name: 'NotoSansJP', data: black, weight: 900 as const, style: 'normal' as const },
  ].filter(Boolean) as OgFont[]
}

export const toJpegDataUrl = async (image: Buffer) =>
  `data:image/jpeg;base64,${(await sharp(image).jpeg({ quality: 85 }).toBuffer()).toString('base64')}`

// Drawkerのロゴ（雲のマーク）
export function DrawkerLogo({ size = 44 }: { size?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        width: size,
        height: size,
        borderRadius: Math.round(size / 3),
        background: 'linear-gradient(45deg, #38bdf8, #67e8f9)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={Math.round(size * 0.68)} height={Math.round(size * 0.68)} viewBox="0 0 100 100">
        <g fill="#ffffff">
          <circle cx="32" cy="52" r="16" />
          <circle cx="52" cy="39" r="21" />
          <circle cx="71" cy="53" r="15" />
          <rect x="18" y="54" width="64" height="22" rx="11" />
        </g>
      </svg>
    </div>
  )
}

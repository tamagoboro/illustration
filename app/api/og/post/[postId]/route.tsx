import sharp from 'sharp'
import { WIDTH, HEIGHT, fetchImage, cropTo, loadFonts, renderWatermarkTile, burnWatermark } from '@/lib/ogImage'
import { loadPostPageData } from '@/lib/postPageData'

// フィードの投稿をX等でシェアしたときのカード画像（1200×630）。
//   1枚     … 切り抜かずに全体が見える大きさで中央に置き、余白はその画像をぼかしたもので埋める
//   2〜4枚  … カード全体に並べる（2枚＝左右、3枚＝左に大1枚＋右に2枚、4枚＝2×2）
// ほかのカードと同じく「© 名前 drawker.com」の透かしを焼き込む（lib/ogImage.tsx）。
// 文字は透かしだけなので、合成はすべて sharp で行う。
export const runtime = 'nodejs'

const WHITE = '#ffffff'
const GAP = 8
const HALF_WIDTH = (WIDTH - GAP) / 2
const HALF_HEIGHT = (HEIGHT - GAP) / 2

type Cell = { left: number; top: number; width: number; height: number }

// 複数枚のときの並べ方
const layoutFor = (count: number): Cell[] => {
  const right = HALF_WIDTH + GAP
  const bottom = HALF_HEIGHT + GAP
  if (count === 2) {
    return [
      { left: 0, top: 0, width: HALF_WIDTH, height: HEIGHT },
      { left: right, top: 0, width: HALF_WIDTH, height: HEIGHT },
    ]
  }
  if (count === 3) {
    return [
      { left: 0, top: 0, width: HALF_WIDTH, height: HEIGHT },
      { left: right, top: 0, width: HALF_WIDTH, height: HALF_HEIGHT },
      { left: right, top: bottom, width: HALF_WIDTH, height: HALF_HEIGHT },
    ]
  }
  return [
    { left: 0, top: 0, width: HALF_WIDTH, height: HALF_HEIGHT },
    { left: right, top: 0, width: HALF_WIDTH, height: HALF_HEIGHT },
    { left: 0, top: bottom, width: HALF_WIDTH, height: HALF_HEIGHT },
    { left: right, top: bottom, width: HALF_WIDTH, height: HALF_HEIGHT },
  ]
}

// 1枚：全体が見える大きさで中央に置き、余白は同じ画像のぼかしで埋める。透かしは画像の上だけに入れる
async function composeSingle(source: Buffer, tile: Buffer) {
  const [fitted, background] = await Promise.all([
    // 透過画像は白地にのせる（ぼかした背景の上に透けて重なると見づらいため）
    sharp(source)
      .flatten({ background: WHITE })
      .resize(WIDTH, HEIGHT, { fit: 'inside' })
      .png()
      .toBuffer({ resolveWithObject: true }),
    sharp(source)
      .flatten({ background: WHITE })
      .resize(WIDTH, HEIGHT, { fit: 'cover' })
      .blur(30)
      .modulate({ brightness: 0.85 })
      .png()
      .toBuffer(),
  ])
  const { width, height } = fitted.info
  const work = await burnWatermark(fitted.data, width, height, tile)
  return sharp(background).composite([
    { input: work, left: Math.round((WIDTH - width) / 2), top: Math.round((HEIGHT - height) / 2) },
  ])
}

// 複数枚：それぞれを枠の大きさに切り抜いて並べ、カード全体に透かしを入れる
async function composeCollage(sources: Buffer[], tile: Buffer) {
  const cells = layoutFor(sources.length)
  const pieces = await Promise.all(sources.map((source, i) => cropTo(source, cells[i].width, cells[i].height)))
  const canvas = await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: WHITE } })
    .composite(pieces.map((input, i) => ({ input, left: cells[i].left, top: cells[i].top })))
    .png()
    .toBuffer()
  return sharp(await burnWatermark(canvas, WIDTH, HEIGHT, tile))
}

export async function GET(_request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params

  const post = await loadPostPageData(postId)
  // 取得できなかった画像は飛ばし、取れた枚数で並べ方を決める
  const sources = post
    ? ((await Promise.all(post.ogImageSources.map((url) => fetchImage(url)))).filter(Boolean) as Buffer[])
    : []
  if (!post || sources.length === 0) return new Response('Not Found', { status: 404 })

  try {
    const watermark = `© ${post.authorName}  drawker.com`
    const tile = await renderWatermarkTile(watermark, await loadFonts(watermark))

    const composed = sources.length === 1 ? await composeSingle(sources[0], tile) : await composeCollage(sources, tile)
    const card = await composed.jpeg({ quality: 85 }).toBuffer()

    return new Response(new Uint8Array(card), {
      headers: {
        'Content-Type': 'image/jpeg',
        // SNS側のクローラーが何度も叩いても重くならないよう、CDNで1時間キャッシュする
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        // SNSのカード表示には使うが、画像検索には載せない
        'X-Robots-Tag': 'noindex, noimageindex',
      },
    })
  } catch (e) {
    console.error('投稿のOGP画像の生成エラー:', postId, e)
    return new Response('Not Found', { status: 404 })
  }
}

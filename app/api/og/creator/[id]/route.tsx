import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

// クリエイターページをX等でシェアしたときのカード画像（1200×630）。
// 作品（最大3枚）・名前・最安料金・受付状況・タグ・納期をまとめて1枚に載せる。
//
// ・Node.jsランタイム … 作品画像はWebPで保存されているが、next/og（satori）はWebPを読めないため、
//   sharpでJPEGに変換してから埋め込む（Edgeランタイムではsharpが使えない）。
// ・日本語フォント … next/og の標準フォントには日本語が無く□になるため、
//   Google Fontsから「このカードで使う文字だけ」を含むNoto Sans JPを取得して使う。
export const runtime = 'nodejs'

const WIDTH = 1200
const HEIGHT = 630
const MODERATED_PLACEHOLDER_URL = '/moderated-placeholder.svg'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

// 画像を取得し、指定サイズに切り抜いたJPEGのdata URLにする（失敗時はnull）
async function toJpegDataUrl(url: string, width: number, height: number) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const input = Buffer.from(await res.arrayBuffer())
    const output = await sharp(input)
      .resize(width * 2, height * 2, { fit: 'cover', position: sharp.strategy.attention })
      .jpeg({ quality: 80 })
      .toBuffer()
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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: profile }, { data: works }] = await Promise.all([
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
  ])

  const isPublic = !!profile && profile.is_public !== false
  const name = isPublic ? profile.display_name?.trim() || 'クリエイター' : 'Drawker'
  const priceText = isPublic && profile.price_min ? `¥${profile.price_min.toLocaleString()}〜` : '応相談'
  const statusText = profile?.status === 'available' ? '受付中・即対応可' : '相談受付中'
  const tags: string[] = isPublic && Array.isArray(profile.tastes) ? profile.tastes.slice(0, 4) : []
  const leadTimeText = isPublic && profile.lead_time_days ? `納期目安 ${profile.lead_time_days}日` : '納期 要相談'
  const commercialText = isPublic && profile.commercial_use_allowed ? '商用利用OK' : ''

  const workUrls = isPublic
    ? (works || [])
        .map((w) => w.image_url as string)
        .filter((u) => u && u !== MODERATED_PLACEHOLDER_URL)
        .slice(0, 3)
    : []

  // 作品の並べ方: 1枚なら大きく1枚、2枚以上なら大1枚＋小2枚（2枚のときは小を1枚）
  const [mainImage, ...subImages] = await Promise.all([
    workUrls[0] ? toJpegDataUrl(workUrls[0], 400, 550) : Promise.resolve(null),
    ...workUrls.slice(1).map((u) => toJpegDataUrl(u, 220, 267)),
  ])
  const avatar = isPublic && profile.avatar_url ? await toJpegDataUrl(profile.avatar_url, 96, 96) : null
  const validSubImages = subImages.filter(Boolean) as string[]

  const allText = [name, priceText, statusText, leadTimeText, commercialText, '最安目安', 'イラスト依頼・ポートフォリオ比較 ｜ drawker.com', 'Drawker', '#', ...tags.map((t) => `#${t}`)].join('')
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

  const hasWorks = !!mainImage
  const nameFontSize = name.length > 12 ? 40 : name.length > 8 ? 48 : 56

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 55%, #cffafe 100%)',
          fontFamily: 'NotoSansJP',
          padding: 40,
          gap: 40,
        }}
      >
        {/* 作品エリア */}
        {hasWorks && (
          <div style={{ display: 'flex', gap: 16 }}>
            <img
              src={mainImage!}
              width={400}
              height={550}
              style={{ borderRadius: 28, objectFit: 'cover', boxShadow: '0 12px 32px rgba(14,116,144,0.25)' }}
            />
            {validSubImages.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {validSubImages.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    width={220}
                    height={267}
                    style={{ borderRadius: 24, objectFit: 'cover', boxShadow: '0 8px 24px rgba(14,116,144,0.2)' }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 情報エリア */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              {avatar && (
                <img src={avatar} width={96} height={96} style={{ borderRadius: 48, border: '4px solid #ffffff' }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignSelf: 'flex-start',
                    padding: '6px 16px',
                    borderRadius: 999,
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#ffffff',
                    background: profile?.status === 'available' ? '#10b981' : '#f59e0b',
                  }}
                >
                  {statusText}
                </div>
                <div style={{ display: 'flex', fontSize: nameFontSize, fontWeight: 900, color: '#0f172a', lineHeight: 1.15 }}>
                  {name}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: '#0369a1' }}>最安目安</div>
              <div style={{ display: 'flex', fontSize: 76, fontWeight: 900, color: '#0284c7', lineHeight: 1.1 }}>
                {priceText}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, fontSize: 22, fontWeight: 700, color: '#334155' }}>
              <div style={{ display: 'flex', padding: '6px 14px', borderRadius: 12, background: '#ffffff' }}>{leadTimeText}</div>
              {commercialText && (
                <div style={{ display: 'flex', padding: '6px 14px', borderRadius: 12, background: '#ffffff', color: '#0e7490' }}>
                  {commercialText}
                </div>
              )}
            </div>

            {tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {tags.map((t) => (
                  <div
                    key={t}
                    style={{
                      display: 'flex',
                      padding: '6px 14px',
                      borderRadius: 999,
                      fontSize: 20,
                      fontWeight: 700,
                      color: '#0369a1',
                      background: 'rgba(255,255,255,0.7)',
                      border: '2px solid #bae6fd',
                    }}
                  >
                    #{t}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ブランド */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                display: 'flex',
                width: 52,
                height: 52,
                borderRadius: 18,
                background: 'linear-gradient(45deg, #38bdf8, #67e8f9)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="34" height="34" viewBox="0 0 100 100">
                <g fill="#ffffff">
                  <circle cx="32" cy="52" r="16" />
                  <circle cx="52" cy="39" r="21" />
                  <circle cx="71" cy="53" r="15" />
                  <rect x="18" y="54" width="64" height="22" rx="11" />
                </g>
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 28, fontWeight: 900, color: '#0f172a' }}>Drawker</div>
              <div style={{ display: 'flex', fontSize: 16, fontWeight: 400, color: '#64748b' }}>
                イラスト依頼・ポートフォリオ比較 ｜ drawker.com
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
      },
    }
  )
}

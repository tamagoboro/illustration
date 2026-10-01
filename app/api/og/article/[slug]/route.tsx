import { ImageResponse } from 'next/og'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { WIDTH, HEIGHT, fetchImage, loadFonts, toJpegDataUrl, DrawkerLogo } from '@/lib/ogImage'
import { SLUG_PATTERN, categoryInfo } from '@/lib/articles'

// 記事をX等でシェアしたときのカード画像（1200×630）。
// カバー画像があれば全面に敷き、下側にタイトル・カテゴリ・サイト名を重ねる。無ければ空色の背景にタイトルを大きく載せる。
export const runtime = 'nodejs'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { data: article } = SLUG_PATTERN.test(slug)
    ? await supabase.from('articles').select('title, category, cover_image_url').eq('slug', slug).eq('status', 'published').maybeSingle()
    : { data: null }

  const title = article?.title || 'はじめてのイラスト依頼ガイド'
  const category = categoryInfo(article?.category || 'other')
  const label = article ? category.label : '記事'
  const fonts = await loadFonts([title, label, 'Drawker', 'drawker.com', 'はじめてのイラスト依頼ガイド'].join(''))

  let cover: string | null = null
  if (article?.cover_image_url) {
    const raw = await fetchImage(article.cover_image_url)
    if (raw) {
      try {
        cover = await toJpegDataUrl(await sharp(raw).resize(WIDTH, HEIGHT, { fit: 'cover' }).toBuffer())
      } catch (e) {
        console.error('記事カードの画像変換エラー:', e)
      }
    }
  }

  const titleSize = title.length > 40 ? 40 : title.length > 24 ? 48 : 58

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          fontFamily: 'NotoSansJP',
          background: 'linear-gradient(135deg, #0ea5e9 0%, #22d3ee 55%, #a5f3fc 100%)',
        }}
      >
        {cover && <img src={cover} width={WIDTH} height={HEIGHT} style={{ position: 'absolute', top: 0, left: 0 }} />}
        <div
          style={{
            position: 'absolute',
            left: 40,
            right: 40,
            bottom: 40,
            top: cover ? 290 : 40,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '30px 40px',
            borderRadius: 32,
            background: 'rgba(255,255,255,0.95)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                display: 'flex',
                alignSelf: 'flex-start',
                padding: '4px 16px',
                borderRadius: 999,
                fontSize: 20,
                fontWeight: 900,
                color: '#0369a1',
                background: '#e0f2fe',
              }}
            >
              {label}
            </div>
            <div style={{ display: 'flex', fontSize: cover ? Math.min(titleSize, 44) : titleSize, fontWeight: 900, color: '#0f172a', lineHeight: 1.3 }}>
              {title}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <DrawkerLogo size={36} />
            <div style={{ display: 'flex', fontSize: 22, fontWeight: 900, color: '#0f172a' }}>Drawker</div>
            <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: '#64748b' }}>drawker.com</div>
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'X-Robots-Tag': 'noindex, noimageindex',
      },
    }
  )
}

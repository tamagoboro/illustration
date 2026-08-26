import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Edge Runtimeで安全に外部画像をBase64に変換する関数
async function getImageBase64(url: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const arrayBuffer = await res.arrayBuffer()
    
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    
    const base64 = btoa(binary)
    const contentType = res.headers.get('content-type') || 'image/png'
    return `data:${contentType};base64,${base64}`
  } catch (e) {
    console.error('OGP Image Fetch Error:', e)
    return null
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // 1. Supabaseからデータ取得
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('user_id', id)
    .single()

  const { data: works } = await supabase
    .from('portfolio_items')
    .select('image_url')
    .eq('user_id', id)
    .limit(1)

  const name = profile?.display_name || 'クリエイター'

  // 2. 画像を Base64 に変換
  const avatarBase64 = profile?.avatar_url
    ? await getImageBase64(profile.avatar_url)
    : null
  const coverBase64 = works?.[0]?.image_url
    ? await getImageBase64(works[0].image_url)
    : null

  // 3. OGP 画像の生成
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          position: 'relative',
        }}
      >
        {/* 背景画像 */}
        {coverBase64 && (
          <img
            src={coverBase64}
            alt=""
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.3,
            }}
          />
        )}

        {/* メインカード */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 60px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            borderRadius: '24px',
            border: '2px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* アバター画像 */}
          {avatarBase64 && (
            <img
              src={avatarBase64}
              alt=""
              style={{
                width: 110,
                height: 110,
                borderRadius: '50%',
                marginBottom: 20,
                objectFit: 'cover',
              }}
            />
          )}

          <h1
            style={{
              fontSize: 56,
              fontWeight: 'bold',
              margin: 0,
              color: '#ffffff',
            }}
          >
            {name}
          </h1>
          <p
            style={{
              fontSize: 24,
              color: '#94a3b8',
              marginTop: 12,
              margin: 0,
            }}
          >
            クリエイターポートフォリオ | 検索・比較
          </p>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
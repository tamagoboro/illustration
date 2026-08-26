import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // プロフィールと作品（背景用）を取得
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
  const coverImage = works?.[0]?.image_url || ''

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
        {/* 背景に作品画像をうっすら表示 */}
        {coverImage && (
          <img
            src={coverImage}
            alt=""
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.25,
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
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          }}
        >
          {profile?.avatar_url && (
            <img
              src={profile.avatar_url}
              alt=""
              style={{
                width: 100,
                height: 100,
                borderRadius: '50%',
                marginBottom: 20,
                objectFit: 'cover',
              }}
            />
          )}
          <h1 style={{ fontSize: 56, fontWeight: 'bold', marginBottom: 10, margin: 0 }}>
            {name}
          </h1>
          <p style={{ fontSize: 24, color: '#94a3b8', marginTop: 12, margin: 0 }}>
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
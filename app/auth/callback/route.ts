import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabaseServer'
import { fillProfileFromOAuthMetadata } from '@/lib/ensureProfile'

// Google等のOAuthログイン後にSupabaseから戻ってくる先（signInWithOAuthのredirectToに指定）。
// 受け取った認可コードをセッションと交換し、プロフィールが未作成/空欄なら埋めてからリダイレクトする。
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // オープンリダイレクト対策: サイト内の相対パスのみ許可する
  const rawNext = searchParams.get('next') || '/'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'

  if (code) {
    const supabase = await createSupabaseRouteClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      try {
        await fillProfileFromOAuthMetadata(supabase, data.user)
      } catch (e) {
        // プロフィール補完に失敗してもログイン自体は成立させる（ダッシュボードで後から直せる）
        console.error('OAuthプロフィール補完エラー:', e)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`)
}

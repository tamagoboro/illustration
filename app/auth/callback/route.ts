import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabaseServer'
import { fillProfileFromOAuthMetadata } from '@/lib/ensureProfile'

// 「未登録のGoogleアカウントで、ログイン扱いのまま入れてしまう」のを防ぐための判定。
// Supabaseはユーザーの初回サインインかどうかを直接は教えてくれないため、
// created_at（アカウント作成時刻）と last_sign_in_at（今回のサインイン時刻）がほぼ同時なら
// 「たった今この場で作られたアカウント＝初回」とみなす（数秒のズレは許容する）。
function isBrandNewUser(user: { created_at: string; last_sign_in_at: string | null }): boolean {
  if (!user.last_sign_in_at) return true
  const createdAt = new Date(user.created_at).getTime()
  const signedInAt = new Date(user.last_sign_in_at).getTime()
  return Math.abs(signedInAt - createdAt) < 5000
}

// Google等のOAuthログイン後にSupabaseから戻ってくる先（signInWithOAuthのredirectToに指定）。
// 受け取った認可コードをセッションと交換し、プロフィールが未作成/空欄なら埋めてからリダイレクトする。
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const mode = searchParams.get('mode') === 'signup' ? 'signup' : 'login'
  // オープンリダイレクト対策: サイト内の相対パスのみ許可する
  const rawNext = searchParams.get('next') || '/'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'

  if (code) {
    const supabase = await createSupabaseRouteClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // 「ログイン」ボタンから来たのに、このGoogleアカウントでの登録が無い（＝たった今
      // 初めて作られた）場合は、そのまま入れずに一旦サインアウトし、新規登録に案内する。
      // Supabase Auth側にはもうこのアカウントが作られてしまっているが、次に「新規登録」から
      // 同じGoogleアカウントで入り直せば、そのまま既存アカウントとして使える。
      if (mode === 'login' && isBrandNewUser(data.user)) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=not_registered`)
      }

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

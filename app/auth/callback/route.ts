import { NextResponse } from 'next/server'
import { createSupabaseRouteClient } from '@/lib/supabaseServer'

// Google等のOAuthログイン後にSupabaseから戻ってくる先（signInWithOAuthのredirectToに指定）。
// 受け取った認可コードをセッションと交換し、次の画面へリダイレクトする。
//
// 初めてのGoogleアカウントでは、DBのトリガー（handle_new_user）が表示名の空なプロフィールを作るだけで、
// 名前・アイコン・利用方法（依頼者/クリエイター）が決まっていない。
// 以前はこの状態のまま登録が完了してしまうため、Googleでの新規登録そのものを止めていた。
// いまは、表示名がまだ無い人を初期設定の画面（/welcome）へ送り、そこで入力してもらってから先へ進める。
// （/welcome を途中で閉じても、components/SessionGuard.tsx が次に開いたページから /welcome へ戻す）
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (!profile?.display_name?.trim()) {
        return NextResponse.redirect(`${origin}/welcome?next=${encodeURIComponent(next)}`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`)
}

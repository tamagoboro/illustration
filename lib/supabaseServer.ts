import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Route Handler（app/**/route.ts）専用のSupabaseクライアント。
// OAuthログインのコールバック（app/auth/callback/route.ts）で、PKCEのcode verifierや
// セッションをCookie経由でやり取りするために必要（lib/supabase.tsのブラウザ用クライアントとは別物）。
export async function createSupabaseRouteClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}

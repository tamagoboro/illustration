'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { saveReturnPath } from '@/lib/returnPath'

// 初期設定（表示名・利用方法）が済んでいなくても開けるページ
const SETUP_EXEMPT_PREFIXES = ['/welcome', '/login', '/reset-password', '/auth', '/terms', '/privacy', '/about', '/contact']

const profileReadyKey = (userId: string) => `drawker:profileReady:${userId}`

// 全ページ共通で動く見張り役（app/layout.tsx に置く。画面には何も出さない）。
//
// 1. いま見ているページを「ログイン後に戻るページ」として記録する（lib/returnPath.ts）。
// 2. ログイン中なのに表示名が空の人を、初期設定の画面（/welcome）へ送る。
//    Googleで登録した直後は表示名も利用方法（依頼者/クリエイター）も未設定なので、/welcome で入力してもらう。
//    途中で閉じて別のページを開いても、名前のないままサイトを使い続けられないようにするための確認。
//    確認できた人はこのタブでは再確認しない（ページ移動のたびにDBへ問い合わせないため）。
export default function SessionGuard() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!pathname) return
    saveReturnPath(pathname + window.location.search)

    if (SETUP_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return

    let cancelled = false
    const checkProfileSetup = async () => {
      // getSession はブラウザに保存済みのログイン状態を読むだけで、通信は発生しない
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      if (!user) return

      try {
        if (sessionStorage.getItem(profileReadyKey(user.id))) return
      } catch {
        // sessionStorage が使えなくても、下の確認はそのまま行う
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled || error) return

      if (profile?.display_name?.trim()) {
        try {
          sessionStorage.setItem(profileReadyKey(user.id), '1')
        } catch {
          // 記録できなくても動作に支障はない（次のページでもう一度確認するだけ）
        }
        return
      }

      // メールで登録した人は、表示名を登録フォームで入力済み（user_metadata に入っている）。
      // プロフィールへの反映はログイン処理が行うので、ここでは初期設定へ送らない
      const metaName = user.user_metadata?.display_name
      if (typeof metaName === 'string' && metaName.trim()) return

      router.replace('/welcome')
    }
    checkProfileSetup()

    return () => {
      cancelled = true
    }
  }, [pathname, router])

  return null
}

// 初期設定を終えた直後に呼ぶ（次のページで /welcome へ送り返されないようにする）
export function markProfileReady(userId: string) {
  try {
    sessionStorage.setItem(profileReadyKey(userId), '1')
  } catch {
    // 記録できなくても、プロフィールに表示名が入っていれば次の確認で通る
  }
}

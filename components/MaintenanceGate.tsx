'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { maintenanceAreaForPath } from '@/lib/maintenance'

// 開いたままの人にも切り替えが届くように、対象ページでは定期的に確認し直す
const RECHECK_MS = 60 * 1000

// 管理者が /admin/maintenance で「緊急メンテナンス中」にしたページを、メンテナンス画面に差し替える。
// 対象外のページでは何もしない。管理者だけは中身をそのまま見られる（直したあとの確認用）。
export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const target = maintenanceAreaForPath(pathname)
  const area = target?.area || null
  const [enabledAreas, setEnabledAreas] = useState<string[]>([])
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!area) return
    let cancelled = false
    const check = async () => {
      // テーブルがまだ無い・読み込めないときは、メンテナンスなしとして扱う
      const { data, error } = await supabase.from('maintenance_flags').select('area').eq('enabled', true)
      if (cancelled || error) return
      const list = (data || []).map((row) => row.area as string)
      if (list.includes(area)) {
        const { data: auth } = await supabase.auth.getUser()
        const uid = auth.user?.id
        if (uid) {
          const { data: adminRow } = await supabase.from('admins').select('user_id').eq('user_id', uid).maybeSingle()
          if (cancelled) return
          setIsAdmin(!!adminRow)
        }
      }
      if (!cancelled) setEnabledAreas(list)
    }
    check()
    const timer = setInterval(check, RECHECK_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [area])

  if (!target || !enabledAreas.includes(target.area)) return <>{children}</>

  if (isAdmin) {
    return (
      <>
        <div className="sticky top-0 z-50 bg-amber-400 text-amber-950 text-[11px] font-black text-center px-3 py-1.5 print:hidden">
          🚧 「{target.label}」は緊急メンテナンス中です（管理者だけ表示されています）
          <Link href="/admin/maintenance" className="ml-2 underline">
            解除する
          </Link>
        </div>
        {children}
      </>
    )
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 bg-slate-50">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center space-y-3 max-w-sm w-full">
        <p className="text-4xl">🚧</p>
        <h1 className="text-base font-black text-slate-800">ただいま緊急メンテナンス中です</h1>
        <p className="text-xs text-slate-500 leading-relaxed">
          「{target.label}」は現在ご利用いただけません。
          <br />
          ご不便をおかけして申し訳ありません。しばらくしてからもう一度お試しください。
        </p>
        <Link href="/" className="inline-block mt-2 px-5 py-2.5 bg-slate-900 text-white rounded-full text-xs font-bold hover:bg-slate-700 transition-colors">
          ホームへ戻る
        </Link>
      </div>
    </div>
  )
}

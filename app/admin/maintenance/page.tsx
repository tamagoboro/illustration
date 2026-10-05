'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { backgroundImageStyle } from '@/lib/background'
import { MAINTENANCE_AREAS } from '@/lib/maintenance'
import { formatDateTime } from '@/lib/agreements'

type FlagRow = {
  area: string
  enabled: boolean
  updated_at: string
}

// 緊急メンテナンスの切り替え。管理者だけが使える（RLSで制限）。
// ボタンを押すとすぐ、そのページが「緊急メンテナンス中」の画面になる。もう一度押すと解除。
export default function AdminMaintenancePage() {
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [flags, setFlags] = useState<Record<string, FlagRow>>({})
  const [loadError, setLoadError] = useState(false)
  const [busyArea, setBusyArea] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id
      if (uid) {
        setUserId(uid)
        const { data: adminRow } = await supabase.from('admins').select('user_id').eq('user_id', uid).maybeSingle()
        setIsAdmin(!!adminRow)
        if (adminRow) {
          const { data: rows, error } = await supabase.from('maintenance_flags').select('area, enabled, updated_at')
          if (error) {
            console.error('メンテナンス設定の取得エラー:', error)
            setLoadError(true)
          }
          setFlags(Object.fromEntries(((rows || []) as FlagRow[]).map((r) => [r.area, r])))
        }
      }
      setChecking(false)
    }
    init()
  }, [])

  const toggle = async (area: string, label: string, enabled: boolean) => {
    const question = enabled
      ? `「${label}」を緊急メンテナンス中にします。\n管理者以外はこのページを使えなくなります。よろしいですか？`
      : `「${label}」のメンテナンスを解除して、使える状態に戻します。よろしいですか？`
    if (!confirm(question)) return
    setBusyArea(area)
    const { data, error } = await supabase
      .from('maintenance_flags')
      .update({ enabled, updated_at: new Date().toISOString(), updated_by: userId })
      .eq('area', area)
      .select('area, enabled, updated_at')
    setBusyArea(null)
    if (error || !data || data.length === 0) {
      console.error('メンテナンス設定の更新エラー:', error)
      alert('切り替えに失敗しました。supabase/add_maintenance_mode.sql を実行済みか確認してください。')
      return
    }
    setFlags((prev) => ({ ...prev, [area]: data[0] as FlagRow }))
  }

  if (checking) return <div className="p-8 text-center text-xs font-bold text-slate-400">読み込み中...</div>
  if (!isAdmin) return <div className="p-8 text-center text-sm font-bold text-slate-600">このページは管理者だけが使えます</div>

  return (
    <div className="min-h-screen pb-24 bg-cover bg-center" style={backgroundImageStyle}>
      <header className="px-4 sm:px-6 py-3.5 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <Link href="/admin/reports" className="text-xs font-bold text-slate-500 hover:text-slate-800">
            ← 通報管理
          </Link>
          <h1 className="text-sm font-bold text-slate-900">緊急メンテナンス</h1>
          <span className="w-16" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-3">
        {loadError && (
          <p className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-bold">
            読み込めませんでした。supabase/add_maintenance_mode.sql を実行済みか確認してください。
          </p>
        )}
        <p className="bg-white/90 rounded-2xl px-4 py-3 text-[11px] text-slate-600 leading-relaxed">
          ボタンを押すとすぐに切り替わります。メンテナンス中のページは「ただいま緊急メンテナンス中です」の画面になり、管理者だけが中身を見られます。
          すでにページを開いている人には、1分以内に反映されます。
        </p>

        {MAINTENANCE_AREAS.map((item) => {
          const flag = flags[item.area]
          const enabled = !!flag?.enabled
          return (
            <article
              key={item.area}
              className={`rounded-2xl p-4 shadow-2xs border flex items-center gap-3 ${enabled ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-100'}`}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-black text-slate-800">
                    {item.emoji} {item.label}
                  </p>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      enabled ? 'bg-amber-400 border-amber-500 text-amber-950' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}
                  >
                    {enabled ? '🚧 メンテナンス中' : '公開中'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">{item.note}</p>
                {flag && <p className="text-[10px] text-slate-400">最後の切り替え：{formatDateTime(flag.updated_at)}</p>}
              </div>
              <button
                type="button"
                onClick={() => toggle(item.area, item.label, !enabled)}
                disabled={busyArea === item.area || !flag}
                className={`shrink-0 px-4 py-2.5 rounded-full text-xs font-black transition-colors disabled:opacity-50 ${
                  enabled ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-rose-600 text-white hover:bg-rose-500'
                }`}
              >
                {busyArea === item.area ? '切り替え中...' : enabled ? '解除する' : 'メンテナンスにする'}
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}

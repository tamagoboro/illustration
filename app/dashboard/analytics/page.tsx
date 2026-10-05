'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { backgroundImageStyle } from '@/lib/background'
import SimpleHeader from '@/components/SimpleHeader'

// アクセス解析（PV・見積もり問い合わせ・お気に入り）。
// 以前はダッシュボードの中にあったが、1ページの情報量を減らすため別ページにした。
// analytics_logs には、クリエイターページの閲覧（pv）・見積もりの利用（estimate_calc）・お気に入り（favorite）が記録されている。

type Analytics = {
  pvThisWeek: number
  pvPrevWeek: number
  pvDaily: { date: string; count: number }[]
  pvThisMonth: number
  inquiryThisMonth: number
  newFavoritesThisWeek: number
}

const DAY = 24 * 60 * 60 * 1000

export default function DashboardAnalyticsPage() {
  const router = useRouter()
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        router.push('/login')
        return
      }

      const now = Date.now()
      const { data, error } = await supabase
        .from('analytics_logs')
        .select('event_type, created_at')
        .eq('creator_id', auth.user.id)
        .gte('created_at', new Date(now - 30 * DAY).toISOString())

      if (error || !data) {
        console.error('アクセス解析の取得エラー:', error)
        setLoadError(true)
        return
      }

      const dailyPvMap: Record<string, number> = {}
      const result: Analytics = { pvThisWeek: 0, pvPrevWeek: 0, pvDaily: [], pvThisMonth: 0, inquiryThisMonth: 0, newFavoritesThisWeek: 0 }

      data.forEach((row: { event_type: string; created_at: string }) => {
        const daysAgo = (now - new Date(row.created_at).getTime()) / DAY
        if (row.event_type === 'pv') {
          const dateKey = row.created_at.slice(0, 10)
          dailyPvMap[dateKey] = (dailyPvMap[dateKey] || 0) + 1
          result.pvThisMonth++
          if (daysAgo <= 7) result.pvThisWeek++
          else if (daysAgo <= 14) result.pvPrevWeek++
        } else if (row.event_type === 'estimate_calc') {
          result.inquiryThisMonth++
        } else if (row.event_type === 'favorite') {
          if (daysAgo <= 7) result.newFavoritesThisWeek++
        }
      })

      for (let i = 29; i >= 0; i--) {
        const key = new Date(now - i * DAY).toISOString().slice(0, 10)
        result.pvDaily.push({ date: key, count: dailyPvMap[key] || 0 })
      }
      setAnalytics(result)
    }
    load()
  }, [router])

  const maxDaily = analytics ? Math.max(1, ...analytics.pvDaily.map((d) => d.count)) : 1
  const weekChange =
    analytics && analytics.pvPrevWeek > 0
      ? Math.round(((analytics.pvThisWeek - analytics.pvPrevWeek) / analytics.pvPrevWeek) * 100)
      : null

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="アクセス解析" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <Link
          href="/dashboard"
          className="inline-block text-xs font-bold text-slate-600 bg-white/90 border border-slate-200 px-4 py-2 rounded-full hover:bg-white"
        >
          ← マイページのホームへ
        </Link>

        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div>
            <h1 className="text-base font-black text-slate-900">📊 アクセス解析</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">直近30日の、あなたのページの閲覧・見積もり問い合わせ・お気に入りの動きです</p>
          </div>

          {loadError ? (
            <p className="text-xs font-bold text-rose-500">読み込めませんでした。時間をおいて再読み込みしてください。</p>
          ) : !analytics ? (
            <p className="text-xs font-bold text-slate-400">読み込み中...</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: '今週の閲覧数', value: analytics.pvThisWeek.toLocaleString(), sub: weekChange === null ? '' : `${weekChange >= 0 ? '▲' : '▼'}${Math.abs(weekChange)}%（先週比）`, up: (weekChange ?? 0) >= 0 },
                  { label: '30日間の閲覧数', value: analytics.pvThisMonth.toLocaleString(), sub: '' , up: true },
                  { label: '30日間の見積もり問い合わせ', value: analytics.inquiryThisMonth.toLocaleString(), sub: '', up: true },
                  { label: '今週の新規お気に入り', value: `+${analytics.newFavoritesThisWeek}`, sub: '', up: true },
                ].map((card) => (
                  <div key={card.label} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 block">{card.label}</span>
                    <span className="text-2xl font-black text-slate-900 block mt-0.5 tabular-nums">{card.value}</span>
                    {card.sub && <span className={`text-[10px] font-bold ${card.up ? 'text-emerald-600' : 'text-rose-500'}`}>{card.sub}</span>}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">毎日の閲覧数（30日間）</p>
                <div className="flex items-end gap-[3px] h-32 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  {analytics.pvDaily.map((d) => (
                    <div
                      key={d.date}
                      title={`${d.date.slice(5).replace('-', '/')}：${d.count}件`}
                      className="flex-1 bg-indigo-300 hover:bg-indigo-500 rounded-sm transition-colors"
                      style={{ height: `${Math.max(4, (d.count / maxDaily) * 100)}%` }}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 px-1">
                  <span>{analytics.pvDaily[0].date.slice(5).replace('-', '/')}</span>
                  <span>今日</span>
                </div>
              </div>

              <ul className="text-[10px] text-slate-400 leading-relaxed list-disc list-inside space-y-0.5">
                <li>閲覧数は、あなたのクリエイターページが開かれた回数です。</li>
                <li>見積もり問い合わせは、見積もりフォームで金額を確認し、依頼内容をコピーした回数です。</li>
                <li>累計のお気に入り数は、プロフィールカードのハートマークで確認できます。</li>
              </ul>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

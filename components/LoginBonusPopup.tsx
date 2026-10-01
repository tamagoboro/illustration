'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ログインボーナス（supabase/add_login_bonus.sql の claim_daily_login）。
// 全ページ共通で layout に置き、その日はじめて開いたときにポップアップでお知らせする。
//   ・毎日 5pt（日本時間の0時で切り替わる）
//   ・連続7日ごとに +10pt
//   ・その月を皆勤したら、最終日に +100pt
// 付与するかどうかはDB側で判定するので、ここでは「今日はもう確認したか」を覚えて無駄な通信を減らすだけ。

type LoginBonusResult = {
  claimed: boolean
  daily_points: number
  streak_points: number
  monthly_points: number
  balance: number
  streak: number
  month_days: number
  day_of_month: number
  days_in_month: number
}

const STREAK_CYCLE = 7

// 日本時間の今日（YYYY-MM-DD）
function jstToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date())
}

function storageKey(uid: string) {
  return `drawker-login-bonus:${uid}`
}

function readChecked(uid: string) {
  try {
    return localStorage.getItem(storageKey(uid))
  } catch {
    return null
  }
}

function writeChecked(uid: string, date: string) {
  try {
    localStorage.setItem(storageKey(uid), date)
  } catch {
    // 保存できなくても、DB側で二重付与は防いでいるので問題ない
  }
}

export default function LoginBonusPopup() {
  const [result, setResult] = useState<LoginBonusResult | null>(null)
  const checking = useRef(false)

  const check = useCallback(async () => {
    if (checking.current) return
    checking.current = true
    try {
      const { data } = await supabase.auth.getSession()
      const uid = data.session?.user?.id
      if (!uid) return

      const today = jstToday()
      if (readChecked(uid) === today) return

      const { data: res, error } = await supabase.rpc('claim_daily_login')
      if (error) {
        console.error('ログインボーナスの取得エラー:', error)
        return
      }
      writeChecked(uid, today)

      const bonus = res as LoginBonusResult
      if (bonus?.claimed) {
        setResult(bonus)
        // 開いているページ（ポイント画面など）の残高表示を更新してもらう
        window.dispatchEvent(new CustomEvent('drawker:points-updated', { detail: { balance: bonus.balance } }))
      }
    } finally {
      checking.current = false
    }
  }, [])

  useEffect(() => {
    check()

    // ログインした直後と、開きっぱなしのタブで日付が変わったあとに戻ってきたときにも確認する
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') check()
    })
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      sub.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [check])

  useEffect(() => {
    if (!result) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setResult(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [result])

  if (!result) return null
  return <LoginBonusCard result={result} onClose={() => setResult(null)} />
}

function LoginBonusCard({ result, onClose }: { result: LoginBonusResult; onClose: () => void }) {
  const total = result.daily_points + result.streak_points + result.monthly_points
  const shown = useCountUp(total)

  // 連続ログインの7日サイクルのうち、今日が何日目か（7日目のボーナス当日は7）
  const cyclePos = result.streak % STREAK_CYCLE === 0 ? STREAK_CYCLE : result.streak % STREAK_CYCLE
  const daysToStreakBonus = STREAK_CYCLE - cyclePos

  const perfectSoFar = result.month_days >= result.day_of_month
  const daysLeftInMonth = result.days_in_month - result.day_of_month
  const monthPercent = Math.min(100, Math.round((result.month_days / result.days_in_month) * 100))

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="ログインボーナス"
    >
      <div
        className="drawker-pop-in w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 獲得ポイント */}
        <div className="relative bg-gradient-to-br from-sky-500 via-indigo-500 to-violet-500 px-6 pt-6 pb-7 text-center text-white">
          <p className="text-[11px] font-black tracking-[0.3em] opacity-90">LOGIN BONUS</p>
          <p className="text-sm font-black mt-1">ログインポイントを獲得しました！</p>
          <p className="mt-3 text-5xl font-black tabular-nums drop-shadow-sm">
            +{shown}
            <span className="text-2xl ml-1">pt</span>
          </p>
          <ul className="mt-4 space-y-1 text-xs font-bold">
            <li className="flex justify-between rounded-full bg-white/15 px-4 py-1.5">
              <span>🎁 毎日のログイン</span>
              <span>+{result.daily_points}pt</span>
            </li>
            {result.streak_points > 0 && (
              <li className="flex justify-between rounded-full bg-white/25 px-4 py-1.5">
                <span>🔥 連続{result.streak}日ボーナス</span>
                <span>+{result.streak_points}pt</span>
              </li>
            )}
            {result.monthly_points > 0 && (
              <li className="flex justify-between rounded-full bg-amber-300 text-amber-900 px-4 py-1.5">
                <span>🏆 今月の皆勤ボーナス</span>
                <span>+{result.monthly_points}pt</span>
              </li>
            )}
          </ul>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* 連続ログイン（7日ごとのボーナスまでの進み具合） */}
          <section className="space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-black text-slate-800">
                🔥 連続ログイン <span className="text-lg text-orange-500">{result.streak}</span>日
              </p>
              <p className="text-[11px] font-bold text-slate-500">
                {daysToStreakBonus === 0 ? 'ボーナス達成！' : `あと${daysToStreakBonus}日で +10pt`}
              </p>
            </div>
            <ol className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: STREAK_CYCLE }, (_, i) => {
                const day = i + 1
                const done = day <= cyclePos
                const isToday = day === cyclePos
                const isBonus = day === STREAK_CYCLE
                return (
                  <li key={day} className="flex flex-col items-center gap-1">
                    <span
                      className={`w-full aspect-square rounded-full flex items-center justify-center text-sm font-black ${
                        done
                          ? `${isBonus ? 'bg-amber-400' : 'bg-orange-500'} text-white shadow-sm ${isToday ? 'drawker-stamp' : ''}`
                          : isBonus
                            ? 'bg-amber-50 text-amber-500 border-2 border-dashed border-amber-300'
                            : 'bg-slate-100 text-slate-300'
                      }`}
                    >
                      {isBonus ? '🎁' : done ? '✓' : day}
                    </span>
                    <span className={`text-[9px] font-bold ${isToday ? 'text-orange-500' : 'text-slate-400'}`}>
                      {isToday ? '今日' : `${day}日目`}
                    </span>
                  </li>
                )
              })}
            </ol>
          </section>

          {/* 今月の皆勤チャレンジ */}
          <section className="space-y-2 rounded-2xl bg-slate-50 px-4 py-3">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-black text-slate-800">🏆 今月の皆勤チャレンジ</p>
              <p className="text-[11px] font-black text-slate-500 tabular-nums">
                {result.month_days} / {result.days_in_month}日
              </p>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-1000 ${
                  perfectSoFar ? 'bg-gradient-to-r from-amber-300 to-amber-500' : 'bg-slate-400'
                }`}
                style={{ width: `${monthPercent}%` }}
              />
            </div>
            <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
              {result.monthly_points > 0
                ? '🎉 皆勤達成おめでとうございます！来月も一緒にがんばりましょう。'
                : perfectSoFar
                  ? `このまま月末まで毎日ログインすると +100pt！（あと${daysLeftInMonth}日）`
                  : '今月の皆勤はお休み…来月1日からまたチャレンジできます。'}
            </p>
          </section>

          <p className="text-center text-xs font-bold text-slate-500">
            所持ポイント <span className="text-base font-black text-sky-600 tabular-nums">{result.balance.toLocaleString()}</span> pt
          </p>

          <div className="space-y-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full bg-slate-900 py-3 text-sm font-black text-white hover:bg-slate-700 transition-colors"
            >
              受け取る
            </button>
            <Link
              href="/rewards"
              onClick={onClose}
              className="block text-center text-[11px] font-bold text-sky-600 hover:underline"
            >
              ポイントでアイコンリングを手に入れる →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// 0 から目標の数字まで、ぱらぱらと数字が増えていく
function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return value
}

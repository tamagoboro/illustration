'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase, Profile } from '@/lib/supabase'
import ProtectedImage from '@/components/ProtectedImage'
import SimpleHeader from '@/components/SimpleHeader'
import { recordRecentlyViewed } from '@/lib/recentlyViewed'
import { backgroundImageStyle } from '@/lib/background'

type MatchProfile = Profile & { thumbnail_url?: string | null }

type Answers = {
  budget: number | null // null = こだわらない
  tastes: string[]
  urgency: 'asap' | 'normal' | 'flexible' | null
  commercial: boolean | null // null = どちらでも
}

const BUDGET_OPTIONS: { label: string; value: number | null }[] = [
  { label: '〜5,000円', value: 5000 },
  { label: '〜15,000円', value: 15000 },
  { label: '〜30,000円', value: 30000 },
  { label: 'こだわらない', value: null },
]

const URGENCY_OPTIONS: { label: string; value: Answers['urgency']; hint: string }[] = [
  { label: 'お急ぎ（1週間以内）', value: 'asap', hint: '特急対応・短納期を優先' },
  { label: '普通（1ヶ月以内）', value: 'normal', hint: '一般的な納期で探す' },
  { label: 'じっくり相談したい', value: 'flexible', hint: '納期にはこだわらない' },
]

const TOTAL_STEPS = 4

export default function MatchPage() {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<MatchProfile[]>([])
  const [answers, setAnswers] = useState<Answers>({
    budget: null,
    tastes: [],
    urgency: null,
    commercial: null,
  })
  const [budgetChosen, setBudgetChosen] = useState(false)

  useEffect(() => {
    const fetchProfiles = async () => {
      setLoading(true)
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('is_public', true)

        const list = profileData || []
        const userIds = list.map((p) => p.user_id)

        const { data: thumbData } =
          userIds.length > 0
            ? await supabase.from('first_portfolio_thumbnails').select('user_id, image_url').in('user_id', userIds)
            : { data: [] as { user_id: string; image_url: string }[] }

        const thumbMap: Record<string, string> = {}
        ;(thumbData || []).forEach((t: any) => {
          if (t.image_url) thumbMap[t.user_id] = t.image_url
        })

        // 作品未登録のクリエイターは診断結果として提示しても信頼できないため除外する
        setProfiles(list.filter((p) => !!thumbMap[p.user_id]).map((p) => ({ ...p, thumbnail_url: thumbMap[p.user_id] })))
      } catch (e) {
        console.error('診断用データの取得に失敗しました:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchProfiles()
  }, [])

  // 実際に使われているジャンルだけを、多く使われている順に候補として出す
  const genreOptions = useMemo(() => {
    const counts: Record<string, number> = {}
    profiles.forEach((p) => {
      ;(p.tastes || []).forEach((t) => {
        if (!t) return
        counts[t] = (counts[t] || 0) + 1
      })
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([taste]) => taste)
  }, [profiles])

  const toggleGenre = (taste: string) => {
    setAnswers((prev) => ({
      ...prev,
      tastes: prev.tastes.includes(taste) ? prev.tastes.filter((t) => t !== taste) : [...prev.tastes, taste],
    }))
  }

  const results = useMemo(() => {
    if (step < TOTAL_STEPS) return []

    const eligible = profiles.filter((p) => answers.commercial !== true || p.commercial_use_allowed === true)

    const scored = eligible.map((p) => {
      let score = 0
      const reasons: string[] = []

      const matchedTastes = (p.tastes || []).filter((t) => answers.tastes.includes(t))
      if (matchedTastes.length > 0) {
        score += matchedTastes.length * 3
        reasons.push(`${matchedTastes.slice(0, 2).join('・')}が得意`)
      }

      if (answers.budget != null) {
        if (p.price_min != null && p.price_min <= answers.budget) {
          score += 2
          reasons.push('予算内で依頼できそう')
        }
      } else {
        score += 0.5
      }

      if (answers.urgency === 'asap') {
        if (p.lead_time_days <= 7) {
          score += 2
          reasons.push('短納期に対応')
        }
      } else if (answers.urgency === 'normal') {
        if (p.lead_time_days <= 30) score += 1
      }

      if (answers.commercial === true && p.commercial_use_allowed) {
        score += 1
        reasons.push('商用利用OK')
      }

      if (p.status === 'available') score += 1

      return { profile: p, score, reasons }
    })

    return scored.sort((a, b) => b.score - a.score).slice(0, 6)
  }, [step, profiles, answers])

  const restart = () => {
    setAnswers({ budget: null, tastes: [], urgency: null, commercial: null })
    setBudgetChosen(false)
    setStep(0)
  }

  const progressLabel = ['予算', 'ジャンル', '納期', '商用利用']

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="かんたん診断" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {step < TOTAL_STEPS && (
          <div className="text-center space-y-2">
            <span className="inline-block px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-black tracking-wide">
              🔮 クリエイター診断
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 drop-shadow-sm">
              {step + 1}つの質問でぴったりのクリエイターを探す
            </h1>
            <div className="flex items-center justify-center gap-1.5 pt-1">
              {progressLabel.map((label, i) => (
                <span
                  key={label}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-8 bg-sky-500' : i < step ? 'w-4 bg-sky-300' : 'w-4 bg-sky-100'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Step 0: 予算 */}
        {step === 0 && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-sky-100/60 space-y-4">
            <h2 className="text-sm font-black text-slate-700">💰 ご予算の目安は？</h2>
            <div className="grid grid-cols-2 gap-3">
              {BUDGET_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    setAnswers((prev) => ({ ...prev, budget: opt.value }))
                    setBudgetChosen(true)
                    setStep(1)
                  }}
                  className={`py-4 rounded-2xl border-2 font-bold text-sm transition-all cursor-pointer ${
                    budgetChosen && answers.budget === opt.value
                      ? 'border-sky-500 bg-sky-50 text-sky-700'
                      : 'border-slate-100 hover:border-sky-200 text-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: ジャンル */}
        {step === 1 && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-sky-100/60 space-y-4">
            <h2 className="text-sm font-black text-slate-700">🎨 好みのジャンル・絵柄は？（複数選択可・スキップ可）</h2>
            {genreOptions.length === 0 ? (
              <p className="text-xs text-slate-400">ジャンル情報を集計中です。スキップして次へ進んでください。</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {genreOptions.map((taste) => (
                  <button
                    key={taste}
                    onClick={() => toggleGenre(taste)}
                    className={`px-3.5 py-2 rounded-full text-xs font-bold border-2 transition-all cursor-pointer ${
                      answers.tastes.includes(taste)
                        ? 'border-sky-500 bg-sky-50 text-sky-700'
                        : 'border-slate-100 hover:border-sky-200 text-slate-600'
                    }`}
                  >
                    {taste}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(0)} className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer">
                ← 戻る
              </button>
              <button
                onClick={() => setStep(2)}
                className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-black shadow-sm cursor-pointer"
              >
                次へ
              </button>
            </div>
          </div>
        )}

        {/* Step 2: 納期 */}
        {step === 2 && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-sky-100/60 space-y-4">
            <h2 className="text-sm font-black text-slate-700">⏱ 希望の納期感は？</h2>
            <div className="space-y-2.5">
              {URGENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    setAnswers((prev) => ({ ...prev, urgency: opt.value }))
                    setStep(3)
                  }}
                  className={`w-full text-left px-4 py-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                    answers.urgency === opt.value
                      ? 'border-sky-500 bg-sky-50'
                      : 'border-slate-100 hover:border-sky-200'
                  }`}
                >
                  <p className="text-sm font-bold text-slate-700">{opt.label}</p>
                  <p className="text-[11px] text-slate-400">{opt.hint}</p>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(1)} className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer">
              ← 戻る
            </button>
          </div>
        )}

        {/* Step 3: 商用利用 */}
        {step === 3 && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-sky-100/60 space-y-4">
            <h2 className="text-sm font-black text-slate-700">🏢 商用利用の予定はありますか？</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: '商用利用したい', value: true },
                { label: '個人利用のみ', value: false },
                { label: 'どちらでも', value: null },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    setAnswers((prev) => ({ ...prev, commercial: opt.value }))
                    setStep(4)
                  }}
                  className="py-4 rounded-2xl border-2 border-slate-100 hover:border-sky-200 font-bold text-sm text-slate-600 transition-all cursor-pointer"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button onClick={() => setStep(2)} className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer">
              ← 戻る
            </button>
          </div>
        )}

        {/* 結果 */}
        {step >= TOTAL_STEPS && (
          <div className="space-y-5">
            <div className="text-center space-y-2">
              <span className="inline-block px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-black tracking-wide">
                診断結果
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 drop-shadow-sm">あなたにおすすめのクリエイター</h1>
              <p className="text-xs text-slate-500 drop-shadow-sm">
                回答内容をもとにした目安の相性度です。実際の依頼可否は各クリエイターのページでご確認ください。
              </p>
            </div>

            {loading ? (
              <p className="text-center text-sm text-slate-600 font-bold drop-shadow-sm py-12">読み込み中...</p>
            ) : results.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-sky-100/60 space-y-3">
                <p className="text-sm text-slate-500 font-bold">条件に合うクリエイターが見つかりませんでした。</p>
                <button
                  onClick={restart}
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-black cursor-pointer"
                >
                  条件を変えてもう一度診断する
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {results.map(({ profile, reasons }, idx) => (
                  <Link
                    key={profile.user_id}
                    href={`/creator/${profile.user_id}`}
                    onClick={() =>
                      recordRecentlyViewed({
                        userId: profile.user_id,
                        displayName: profile.display_name,
                        avatarUrl: profile.avatar_url || null,
                        thumbnailUrl: profile.thumbnail_url || null,
                      })
                    }
                    className="bg-white rounded-3xl border border-sky-100/60 shadow-xs hover:shadow-md transition-all overflow-hidden group"
                  >
                    <div className="relative w-full aspect-video bg-sky-50/50 overflow-hidden">
                      {idx === 0 && (
                        <span className="absolute top-2.5 left-2.5 z-10 text-[9px] px-2.5 py-1 rounded-full font-black bg-amber-500 text-white shadow-xs">
                          ★ 最もおすすめ
                        </span>
                      )}
                      {profile.thumbnail_url && (
                        <ProtectedImage
                          src={profile.thumbnail_url}
                          alt={profile.display_name}
                          watermarkText={profile.display_name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      )}
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        {profile.avatar_url && (
                          <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                        )}
                        <p className="text-sm font-black text-slate-800 line-clamp-1">{profile.display_name}</p>
                      </div>
                      {reasons.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {reasons.map((r) => (
                            <span key={r} className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 font-bold">
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold pt-1">
                        <span>{profile.price_min != null ? `${profile.price_min.toLocaleString()}円〜` : '価格応相談'}</span>
                        <span>納期目安 {profile.lead_time_days}日〜</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="text-center pt-2">
              <button onClick={restart} className="text-xs font-bold text-slate-600 drop-shadow-sm hover:text-sky-600 cursor-pointer underline">
                条件を変えてもう一度診断する
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

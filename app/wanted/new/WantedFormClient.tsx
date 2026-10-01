'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { backgroundImageStyle } from '@/lib/background'
import SimpleHeader from '@/components/SimpleHeader'
import { PRESET_TASTES } from '@/lib/tastes'
import {
  WANTED_POST_COLUMNS,
  WANTED_TITLE_MAX,
  WANTED_DESCRIPTION_MAX,
  WANTED_TASTES_MAX,
  WANTED_OPEN_LIMIT,
  normalizeWantedPost,
  todayInJapan,
} from '@/lib/wanted'

// 入力欄の値（空欄は ''）を、0以上の整数か null にする
const toAmount = (value: string): number | null => {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = parseInt(trimmed, 10)
  return Number.isNaN(parsed) ? null : Math.max(0, parsed)
}

// 募集の作成・編集フォーム。/wanted/new で新規作成、/wanted/new?id=<募集ID> で自分の募集を編集する。
export default function WantedFormClient() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tastes, setTastes] = useState<string[]>([])
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [desiredDeadline, setDesiredDeadline] = useState('')
  const [applyUntil, setApplyUntil] = useState('')
  const [commercialUse, setCommercialUse] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id || null
      setUserId(uid)

      const id = new URLSearchParams(window.location.search).get('id')
      if (uid && id) {
        // 編集：自分の募集だけ読み込める
        const { data: row } = await supabase
          .from('wanted_posts')
          .select(WANTED_POST_COLUMNS)
          .eq('id', id)
          .eq('user_id', uid)
          .maybeSingle()
        if (!row) {
          setNotFound(true)
        } else {
          const post = normalizeWantedPost(row)
          setEditingId(post.id)
          setTitle(post.title)
          setDescription(post.description)
          setTastes(post.tastes)
          setBudgetMin(post.budget_min !== null ? String(post.budget_min) : '')
          setBudgetMax(post.budget_max !== null ? String(post.budget_max) : '')
          setDesiredDeadline(post.desired_deadline || '')
          setApplyUntil(post.apply_until || '')
          setCommercialUse(post.commercial_use)
        }
      }
      setChecking(false)
    }
    init()
  }, [])

  const toggleTaste = (tag: string) => {
    setTastes((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag)
      if (prev.length >= WANTED_TASTES_MAX) return prev
      return [...prev, tag]
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!userId || saving) return

    const min = toAmount(budgetMin)
    const max = toAmount(budgetMax)
    if (!title.trim()) {
      setErrorMsg('タイトルを入力してください。')
      return
    }
    if (min !== null && max !== null && min > max) {
      setErrorMsg('予算の下限が上限を超えています。')
      return
    }
    if (applyUntil && applyUntil < todayInJapan()) {
      setErrorMsg('募集の締切には、今日以降の日付を指定してください。')
      return
    }

    setSaving(true)
    setErrorMsg('')

    const values = {
      title: title.trim(),
      description: description.trim(),
      tastes,
      budget_min: min,
      budget_max: max,
      desired_deadline: desiredDeadline || null,
      apply_until: applyUntil || null,
      commercial_use: commercialUse,
    }

    const { data, error } = editingId
      ? await supabase.from('wanted_posts').update(values).eq('id', editingId).select('id').maybeSingle()
      : await supabase.from('wanted_posts').insert({ ...values, user_id: userId }).select('id').maybeSingle()

    if (error || !data) {
      console.error('募集の保存エラー:', error)
      // P0001 はDB側のチェック（同時に出せる件数など）が意図的に出したエラーなので、内容をそのまま案内する
      setErrorMsg(
        error?.code === 'P0001' && error.message
          ? error.message
          : '保存に失敗しました。時間をおいて、もう一度お試しください。'
      )
      setSaving(false)
      return
    }

    router.push(`/wanted/${data.id}`)
  }

  const inputClass =
    'w-full px-3 py-2.5 rounded-xl border border-sky-100 bg-white text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400'

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="募集ボード" />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 space-y-5">
        <div className="px-1 space-y-1">
          <Link
            href="/wanted"
            className="inline-flex items-center gap-1.5 text-[11px] font-black text-sky-700 bg-white/90 hover:bg-white border border-white/70 px-4 py-2 rounded-full shadow-2xs transition"
          >
            ← 募集ボードに戻る
          </Link>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight drop-shadow-sm pt-3">
            {editingId ? '募集を編集する' : '募集を出す'}
          </h1>
        </div>

        {checking ? (
          <p className="text-xs text-slate-600 font-bold drop-shadow-sm text-center py-8">読み込み中...</p>
        ) : !userId ? (
          <div className="text-center py-12 px-4 bg-white/85 backdrop-blur-md rounded-3xl border border-white/70 space-y-3">
            <p className="text-sm font-black text-slate-600">募集を出すにはログインが必要です</p>
            <p className="text-[11px] text-slate-400 font-bold">無料で登録できます。登録が終わると、この画面に戻ってきます。</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/login?signup=client"
                className="text-xs font-black text-white bg-sky-500 hover:bg-sky-600 px-5 py-2.5 rounded-full shadow-sm transition"
              >
                無料で登録する
              </Link>
              <Link
                href="/login"
                className="text-xs font-black text-sky-700 bg-white border border-sky-200 hover:bg-sky-50 px-5 py-2.5 rounded-full transition"
              >
                ログイン
              </Link>
            </div>
          </div>
        ) : notFound ? (
          <div className="text-center py-12 px-4 bg-white/85 backdrop-blur-md rounded-3xl border border-white/70">
            <p className="text-sm font-black text-slate-600">編集できる募集が見つかりませんでした</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white/95 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-white/70 shadow-sm space-y-5"
          >
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-bold">{errorMsg}</div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                タイトル <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={WANTED_TITLE_MAX}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: VTuberデビュー用の立ち絵を描いてくれる方を募集"
                className={inputClass}
              />
              <p className="text-[10px] text-slate-400 mt-1 text-right tabular-nums">
                {title.length}/{WANTED_TITLE_MAX}
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">依頼したい内容</label>
              <textarea
                rows={6}
                maxLength={WANTED_DESCRIPTION_MAX}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={'例:\n・用途（配信用の立ち絵、SNSアイコン など）\n・イメージ（キャラクターの雰囲気、参考にしたい絵柄）\n・サイズや差分の数、パーツ分けの要否'}
                className={`${inputClass} resize-y leading-relaxed`}
              />
              <p className="text-[10px] text-slate-400 mt-1 text-right tabular-nums">
                {description.length}/{WANTED_DESCRIPTION_MAX}
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">予算（空欄なら「応相談」と表示されます）</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">¥</span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    placeholder="5000"
                    className={`${inputClass} pl-7`}
                  />
                </div>
                <span className="text-xs font-bold text-slate-400">〜</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">¥</span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    placeholder="20000"
                    className={`${inputClass} pl-7`}
                  />
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">希望納期（任意）</label>
                <input
                  type="date"
                  value={desiredDeadline}
                  onChange={(e) => setDesiredDeadline(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">募集の締切（任意）</label>
                <input
                  type="date"
                  min={todayInJapan()}
                  value={applyUntil}
                  onChange={(e) => setApplyUntil(e.target.value)}
                  className={inputClass}
                />
                <p className="text-[10px] text-slate-400 mt-1">この日を過ぎると、応募を受け付けなくなります。</p>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                ジャンル（{WANTED_TASTES_MAX}個まで。クリエイターが探しやすくなります）
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TASTES.map((tag) => {
                  const selected = tastes.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTaste(tag)}
                      aria-pressed={selected}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition cursor-pointer ${
                        selected ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-sky-50'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={commercialUse}
                onChange={(e) => setCommercialUse(e.target.checked)}
                className="w-4 h-4 accent-sky-500 cursor-pointer"
              />
              商用利用の予定がある（配信での収益化・グッズ販売など）
            </label>

            <ul className="text-[11px] text-slate-500 leading-relaxed list-disc list-inside space-y-0.5 bg-sky-50/60 border border-sky-100 rounded-2xl p-3.5">
              <li>募集の内容は、ログインしていない人も含めて誰でも見られます。本名・住所・連絡先は書かないでください。</li>
              <li>応募の内容（メッセージ・希望金額）は、あなたと応募した本人にしか見えません。</li>
              <li>同時に出せる募集は{WANTED_OPEN_LIMIT}件までです。決まったら「募集を締め切る」を押してください。</li>
              <li>
                依頼の前に、
                <Link href="/client-guidelines" target="_blank" className="text-sky-600 underline font-bold">
                  依頼者向けの注意事項
                </Link>
                もご確認ください。
              </li>
            </ul>

            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="w-full py-3 bg-gradient-to-r from-sky-500 to-cyan-500 hover:brightness-105 text-white font-black rounded-2xl transition text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
            >
              {saving ? '保存中...' : editingId ? '変更を保存する' : 'この内容で募集を出す'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

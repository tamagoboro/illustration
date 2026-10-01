'use client'

import { FlowStep, MAX_FLOW_STEPS } from '@/lib/flowSteps'

// 「流れ」の編集欄（ご依頼の流れ・お迎えまでの流れで共通）。
// steps が空なら標準の流れが表示される。「標準の流れから編集を始める」で標準の流れをコピーして直せる。
export default function FlowStepsEditor({
  steps,
  onChange,
  defaultSteps,
  title,
}: {
  steps: FlowStep[]
  onChange: (steps: FlowStep[]) => void
  defaultSteps: FlowStep[]
  title: string
}) {
  // 幅は入れない（w-full と固定幅を同時に付けると、スマホで固定幅が効かずに横にはみ出すため）
  const baseInput =
    'py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300/50 focus:border-amber-300'
  const inputClass = `w-full px-3.5 ${baseInput}`

  const update = (index: number, patch: Partial<FlowStep>) => onChange(steps.map((x, j) => (j === index ? { ...x, ...patch } : x)))

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= steps.length) return
    const next = [...steps]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-2 p-4 rounded-2xl bg-amber-50/50 border border-amber-100">
      <div>
        <span className="text-xs font-black text-slate-700">{title}</span>
        <p className="text-[10px] text-slate-400">
          {steps.length === 0
            ? `今は標準の流れ（${defaultSteps.map((s) => s.title).join(' → ')}）が表示されます。`
            : 'ページには、ここで作った流れが STEP 1, 2, 3… の順に表示されます。'}
        </p>
      </div>

      {steps.length === 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange(defaultSteps.map((f) => ({ ...f })))}
            className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-amber-500 text-white cursor-pointer"
          >
            標準の流れから編集を始める
          </button>
          <button
            type="button"
            onClick={() => onChange([{ emoji: '', title: '', body: '' }])}
            className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-white border border-amber-200 text-amber-700 cursor-pointer"
          >
            一から作る
          </button>
        </div>
      ) : (
        <>
          {steps.map((step, i) => (
            <div key={i} className="bg-white rounded-xl p-3 border border-amber-100 space-y-1.5">
              {/* 1行目：ステップ番号と並べ替え・削除 */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black text-amber-600">STEP {i + 1}</span>
                <div className="flex gap-1 shrink-0">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-7 h-7 rounded-lg bg-slate-50 text-xs disabled:opacity-30 cursor-pointer" aria-label="上へ">
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === steps.length - 1}
                    className="w-7 h-7 rounded-lg bg-slate-50 text-xs disabled:opacity-30 cursor-pointer"
                    aria-label="下へ"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(steps.filter((_, j) => j !== i))}
                    className="w-7 h-7 rounded-lg bg-slate-50 text-rose-500 text-xs cursor-pointer"
                    aria-label="削除"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {/* 2行目：絵文字と見出し */}
              <div className="flex items-center gap-2">
                <input
                  className={`w-14 shrink-0 text-center px-1 ${baseInput}`}
                  maxLength={4}
                  placeholder="😀"
                  aria-label="絵文字"
                  value={step.emoji}
                  onChange={(e) => update(i, { emoji: e.target.value })}
                />
                <input
                  className={`flex-1 min-w-0 px-3.5 ${baseInput}`}
                  maxLength={30}
                  placeholder="見出し（例：ヒアリング）"
                  value={step.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                />
              </div>
              <textarea
                rows={3}
                className={inputClass}
                maxLength={200}
                placeholder="説明（例：ご希望の雰囲気や用途をお伺いします）"
                value={step.body}
                onChange={(e) => update(i, { body: e.target.value })}
              />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            {steps.length < MAX_FLOW_STEPS && (
              <button
                type="button"
                onClick={() => onChange([...steps, { emoji: '', title: '', body: '' }])}
                className="text-[11px] font-bold text-amber-700 hover:underline cursor-pointer"
              >
                ＋ ステップを追加
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (confirm('編集した流れを消して、標準の流れに戻しますか？')) onChange([])
              }}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              標準の流れに戻す
            </button>
          </div>
        </>
      )}
    </div>
  )
}

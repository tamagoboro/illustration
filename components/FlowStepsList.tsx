import type { FlowStep } from '@/lib/flowSteps'

// 「流れ」の表示（ご依頼の流れ・お迎えまでの流れで共通）。
//   4ステップまで … 横に並べたカード
//   5ステップ以上 … 縦のタイムライン（横に並べると1枚だけ次の段に落ちて不格好になるため）
export default function FlowStepsList({ steps, accentClass = 'text-violet-500' }: { steps: FlowStep[]; accentClass?: string }) {
  if (steps.length > 4) {
    return (
      <ol className="relative space-y-3">
        {steps.map((step, i) => (
          <li key={`${i}-${step.title}`} className="relative flex gap-4">
            {/* 番号と、次のステップへつながる線 */}
            <div className="relative flex flex-col items-center shrink-0">
              <span className="w-10 h-10 rounded-full bg-white ring-2 ring-slate-100 shadow-sm flex items-center justify-center text-lg z-10">
                {step.emoji || i + 1}
              </span>
              {i < steps.length - 1 && <span className="absolute top-10 bottom-[-12px] w-0.5 bg-slate-200" />}
            </div>
            <div className="flex-1 min-w-0 rounded-2xl bg-slate-50 px-4 py-3">
              <p className="flex items-baseline gap-2">
                <span className={`text-[10px] font-black ${accentClass}`}>STEP {i + 1}</span>
                <span className="text-sm font-black text-slate-800">{step.title}</span>
              </p>
              {step.body && <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap mt-0.5">{step.body}</p>}
            </div>
          </li>
        ))}
      </ol>
    )
  }

  const cols = steps.length === 4 ? 'sm:grid-cols-4' : steps.length === 3 ? 'sm:grid-cols-3' : steps.length === 2 ? 'sm:grid-cols-2' : ''
  return (
    <ol className={`grid gap-3 ${cols}`}>
      {steps.map((step, i) => (
        <li key={`${i}-${step.title}`} className="relative rounded-2xl bg-slate-50 p-4 space-y-1.5">
          <span className={`text-[10px] font-black ${accentClass}`}>STEP {i + 1}</span>
          {step.emoji && <p className="text-2xl">{step.emoji}</p>}
          <p className="text-sm font-black text-slate-800">{step.title}</p>
          {step.body && <p className="text-[11px] text-slate-500 leading-relaxed whitespace-pre-wrap">{step.body}</p>}
        </li>
      ))}
    </ol>
  )
}

'use client'

// スマホで画面の下に常に出しておく「依頼する」ボタン。スクロールしても依頼の入口を見失わないようにする（PCでは出さない）
export default function MobileActionBar({
  priceText,
  primaryLabel,
  onPrimary,
  isFavorite,
  onToggleFavorite,
  themeColor,
}: {
  priceText: string | null
  primaryLabel: string
  onPrimary: () => void
  isFavorite: boolean
  onToggleFavorite: () => void
  themeColor: string
}) {
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={isFavorite ? 'お気に入りを解除' : 'お気に入りに追加'}
          className={`shrink-0 w-12 h-12 rounded-2xl border flex items-center justify-center text-lg cursor-pointer ${
            isFavorite ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'
          }`}
        >
          {isFavorite ? '❤️' : '🤍'}
        </button>
        {priceText && (
          <div className="shrink-0 leading-tight">
            <p className="text-[10px] font-bold text-slate-400">最安目安</p>
            <p className="text-base font-black" style={{ color: themeColor }}>
              {priceText}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={onPrimary}
          style={{ backgroundColor: themeColor }}
          className="flex-1 h-12 rounded-2xl text-white text-sm font-black shadow-md active:scale-[0.98] transition-transform cursor-pointer"
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  )
}

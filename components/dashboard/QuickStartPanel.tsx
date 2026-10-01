'use client'

import { ChangeEvent } from 'react'

// ダッシュボードの先頭に出す「かんたん登録」。
// 一覧に載って依頼者に見つけてもらうのに最低限必要な3つ（作品・料金・タグ）だけを1画面で入力できる。
// 入力先はダッシュボードの各タブと同じ状態（state）なので、ここで入れた内容はそのままタブ側にも反映される。
// テーマカラーや制作条件などの細かい設定は、これまでどおり下のタブで行う（項目は減らしていない）。
export default function QuickStartPanel({
  workUrls,
  canAddWork,
  uploadingWork,
  onUploadWork,
  priceMin,
  onPriceMinChange,
  priceMenuImages,
  canUsePriceMenuImage,
  canAddPriceMenuImage,
  uploadingPriceMenu,
  onUploadPriceMenuImage,
  onRemovePriceMenuImage,
  presetTastes,
  tastes,
  onToggleTaste,
  showPublicToggle,
  isPublic,
  onPublicChange,
  saving,
  onSave,
  onDismiss,
}: {
  workUrls: string[]
  canAddWork: boolean
  uploadingWork: boolean
  onUploadWork: (e: ChangeEvent<HTMLInputElement>) => void
  priceMin: string
  onPriceMinChange: (value: string) => void
  priceMenuImages: string[]
  // 文字の料金メニューをすでに入力している人には、ここでは画像の欄を出さない
  // （画像を載せると文字のメニューが置き換わってしまうため。切り替えは「料金・条件」タブで行う）
  canUsePriceMenuImage: boolean
  canAddPriceMenuImage: boolean
  uploadingPriceMenu: boolean
  onUploadPriceMenuImage: (e: ChangeEvent<HTMLInputElement>) => void
  onRemovePriceMenuImage: (index: number) => void
  presetTastes: string[]
  tastes: string[]
  onToggleTaste: (tag: string) => void
  // 開いた時点でページが非公開だった人にだけ、公開するかどうかのチェック欄を出す
  showPublicToggle: boolean
  isPublic: boolean
  onPublicChange: (value: boolean) => void
  saving: boolean
  onSave: () => void
  onDismiss: () => void
}) {
  const hasWork = workUrls.length > 0
  const hasPrice = (priceMin.trim() !== '' && Number(priceMin) > 0) || priceMenuImages.length > 0
  const hasTags = tastes.length > 0
  const doneCount = [hasWork, hasPrice, hasTags].filter(Boolean).length

  const stepBadge = (step: number, done: boolean) => (
    <span
      className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
        done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
      }`}
    >
      {done ? '✓' : step}
    </span>
  )

  const uploadTileClass = (busy: boolean) =>
    `flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-[11px] font-bold transition-colors ${
      busy ? 'opacity-60 cursor-wait' : 'hover:border-sky-300 hover:text-sky-500 cursor-pointer'
    }`

  return (
    <section className="bg-white rounded-3xl border-2 border-sky-200 p-5 sm:p-6 shadow-sm space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black text-sky-600 tracking-[0.2em]">QUICK START</p>
          <h2 className="text-base font-extrabold text-slate-900">かんたん登録（3つだけ）</h2>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
            この3つを入れるだけで、一覧に掲載されて依頼者に見つけてもらえるようになります。
            テーマカラーや制作条件などの細かい設定は、あとから下のタブでいつでも変えられます。
          </p>
        </div>
        <span className="shrink-0 text-[11px] font-black text-sky-700 bg-sky-50 border border-sky-100 px-2.5 py-1 rounded-full tabular-nums">
          {doneCount} / 3
        </span>
      </div>

      {/* 1. 作品 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {stepBadge(1, hasWork)}
          <h3 className="text-xs font-bold text-slate-800">作品を1枚以上アップロードする</h3>
        </div>
        <div className="grid grid-cols-4 gap-2 pl-8">
          {workUrls.map((url) => (
            <div key={url} className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
              <img src={url} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
          {canAddWork && (
            <label className={`aspect-square ${uploadTileClass(uploadingWork)}`}>
              <span className="text-lg">＋</span>
              <span>{uploadingWork ? 'アップロード中...' : '画像を追加'}</span>
              <input type="file" accept="image/*" onChange={onUploadWork} disabled={uploadingWork} className="hidden" />
            </label>
          )}
        </div>
        <p className="text-[10px] text-slate-400 pl-8">
          作品が1枚もないページは一覧に表示されません。タイトルや並び順は「作品ギャラリー」タブで設定できます。
        </p>
      </div>

      {/* 2. 料金 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {stepBadge(2, hasPrice)}
          <h3 className="text-xs font-bold text-slate-800">料金の目安を入れる</h3>
        </div>
        <div className="pl-8 space-y-2.5">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600">参考最低価格（いちばん安い依頼の金額）</label>
            <div className="relative max-w-xs">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">¥</span>
              <input
                type="number"
                min="0"
                step="500"
                placeholder="5000"
                value={priceMin}
                onChange={(e) => onPriceMinChange(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              />
            </div>
          </div>

          {canUsePriceMenuImage && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600">
                料金表（おしながき）の画像があれば、そのまま載せられます（任意）
              </label>
              <div className="grid grid-cols-4 gap-2">
                {priceMenuImages.map((url, idx) => (
                  <div key={url} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img src={url} alt={`料金表 ${idx + 1}枚目`} className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => onRemovePriceMenuImage(idx)}
                      aria-label={`料金表 ${idx + 1}枚目を削除`}
                      className="absolute top-1 right-1 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full w-5 h-5 text-[9px] font-bold flex items-center justify-center transition cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {canAddPriceMenuImage && (
                  <label className={`aspect-[3/4] ${uploadTileClass(uploadingPriceMenu)}`}>
                    <span className="text-lg">＋</span>
                    <span>{uploadingPriceMenu ? 'アップロード中...' : '画像を追加'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onUploadPriceMenuImage}
                      disabled={uploadingPriceMenu}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          )}
          <p className="text-[10px] text-slate-400">
            メニューを1項目ずつ文字で入力したい場合は、「料金・条件」タブで設定できます。
          </p>
        </div>
      </div>

      {/* 3. タグ */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {stepBadge(3, hasTags)}
          <h3 className="text-xs font-bold text-slate-800">得意なジャンルを選ぶ（いくつでも）</h3>
        </div>
        <div className="flex flex-wrap gap-1.5 pl-8">
          {presetTastes.map((tag) => {
            const selected = tastes.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onToggleTaste(tag)}
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
        <p className="text-[10px] text-slate-400 pl-8">
          トップページの「ジャンルから探す」で見つけてもらえるようになります。自由なタグは「タグ・SNS」タブで追加できます。
        </p>
      </div>

      {/* 保存 */}
      <div className="border-t border-slate-100 pt-4 space-y-3">
        {showPublicToggle && (
          <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => onPublicChange(e.target.checked)}
              className="w-4 h-4 accent-sky-500 cursor-pointer"
            />
            保存と同時にページを公開する（チェックを外すと、非公開のまま保存します）
          </label>
        )}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="text-[11px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            あとで設定する（閉じる）
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-7 py-3 rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 hover:brightness-105 text-white font-black text-xs shadow-sm hover:shadow-md disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
          >
            {saving ? '保存中...' : 'この内容で保存する'}
          </button>
        </div>
      </div>
    </section>
  )
}

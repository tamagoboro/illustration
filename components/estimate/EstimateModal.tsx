'use client'

import { useState, useMemo } from 'react'

export type Option = {
  label: string
  price: number
  priceType?: 'fixed' | 'percent'
  calcType?: 'add' | 'percent' // 互換性維持用
}

export type Field = {
  id: string
  title?: string
  label?: string // FormBuilderとの互換性
  type: 'radio' | 'checkbox' | 'text' | 'textarea' | 'note' | 'faq' | 'color'
  required?: boolean
  price?: number
  noteText?: string
  faqAnswer?: string
  options?: Option[]
}

export type FormConfig = {
  title?: string
  description?: string
  themeColor?: string
  fields: Field[]
}

type Props = {
  isOpen: boolean
  onClose: () => void
  creatorName: string
  statusComment?: string | null
  formConfig?: FormConfig | null
  twitterUrl?: string | null
  externalUrl?: string | null
}

const DEFAULT_FORM_CONFIG: FormConfig = {
  title: '概算見積もり・仕様書作成シミュレーター',
  description: 'ご希望の条件を選択すると、リアルタイムで概算金額と依頼仕様書が作成されます。',
  fields: [
    {
      id: 'f1',
      title: '制作種類',
      type: 'radio',
      required: true,
      options: [
        { label: 'SNSアイコン', price: 5000, priceType: 'fixed' },
        { label: '一枚絵・メインビジュアル', price: 15000, priceType: 'fixed' },
        { label: '立ち絵（全身）', price: 20000, priceType: 'fixed' },
      ],
    },
    {
      id: 'f2',
      title: '背景指定',
      type: 'radio',
      options: [
        { label: '単色・透過・おまかせ', price: 0, priceType: 'fixed' },
        { label: '簡易背景（パターン・柄）', price: 2000, priceType: 'fixed' },
        { label: '描き込み背景', price: 8000, priceType: 'fixed' },
      ],
    },
    {
      id: 'f3',
      title: 'オプション',
      type: 'checkbox',
      options: [
        { label: '商用利用（配信・グッズ等）', price: 50, priceType: 'percent' },
        { label: '表情差分 (+2種)', price: 3000, priceType: 'fixed' },
        { label: '実績公開不可', price: 5000, priceType: 'fixed' },
        { label: 'お急ぎ便（優先制作）', price: 30, priceType: 'percent' },
      ],
    },
    {
      id: 'f4',
      title: '詳細なご要望・キャラクター設定など',
      type: 'textarea',
    },
  ],
}

export default function EstimateModal({
  isOpen,
  onClose,
  creatorName,
  statusComment,
  formConfig,
  twitterUrl,
  externalUrl,
}: Props) {
  const [formAnswers, setFormAnswers] = useState<Record<string, any>>({})
  const [clientName, setClientName] = useState('')
  const [generatedSpec, setGeneratedSpec] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)

  const activeConfig = useMemo(() => {
    return formConfig || DEFAULT_FORM_CONFIG
  }, [formConfig])

  const handleInputChange = (fieldId: string, value: any, isCheckbox = false) => {
    setFormAnswers((prev) => {
      if (isCheckbox) {
        const currentList: string[] = prev[fieldId] || []
        const exists = currentList.includes(value)
        const updated = exists
          ? currentList.filter((v) => v !== value)
          : [...currentList, value]
        return { ...prev, [fieldId]: updated }
      }
      return { ...prev, [fieldId]: value }
    })
  }

  // 概算合計金額の計算
  const totalPrice = useMemo(() => {
    let baseSum = 0
    let percentSum = 0

    activeConfig.fields.forEach((field) => {
      // フィールド自体の基本金額加算
      if (field.price && formAnswers[field.id]) {
        baseSum += field.price
      }

      const answer = formAnswers[field.id]
      if (!answer || !field.options) return

      if (field.type === 'radio') {
        const selectedOpt = field.options.find((opt) => opt.label === answer)
        if (selectedOpt) {
          const isPercent = selectedOpt.priceType === 'percent' || selectedOpt.calcType === 'percent'
          if (isPercent) {
            percentSum += selectedOpt.price
          } else {
            baseSum += selectedOpt.price
          }
        }
      } else if (field.type === 'checkbox' && Array.isArray(answer)) {
        answer.forEach((selectedLabel) => {
          const selectedOpt = field.options?.find((opt) => opt.label === selectedLabel)
          if (selectedOpt) {
            const isPercent = selectedOpt.priceType === 'percent' || selectedOpt.calcType === 'percent'
            if (isPercent) {
              percentSum += selectedOpt.price
            } else {
              baseSum += selectedOpt.price
            }
          }
        })
      }
    })

    return baseSum + Math.round((baseSum * percentSum) / 100)
  }, [formAnswers, activeConfig])

  // テキスト仕様書の生成
  const handleGenerateSpec = () => {
    let specLines: string[] = []
    specLines.push(`【ご依頼・見積もり仕様書】`)
    specLines.push(`依頼先: ${creatorName} 様`)
    if (clientName.trim()) specLines.push(`依頼者名: ${clientName}`)
    specLines.push(`-----------------------------------`)

    activeConfig.fields.forEach((field) => {
      if (field.type === 'note' || field.type === 'faq') return

      const answer = formAnswers[field.id]
      if (!answer || (Array.isArray(answer) && answer.length === 0)) return

      const titleName = field.title || field.label || '項目'

      if (field.type === 'text' || field.type === 'textarea') {
        specLines.push(`■ ${titleName}:`)
        specLines.push(`   ${answer}`)
      } else if (Array.isArray(answer)) {
        specLines.push(`■ ${titleName}: ${answer.join(', ')}`)
      } else {
        specLines.push(`■ ${titleName}: ${answer}`)
      }
    })

    specLines.push(`-----------------------------------`)
    specLines.push(`■ 概算見積もり合計: ¥${totalPrice.toLocaleString()} (税込)`)
    specLines.push(`※上記はシミュレーションによる概算です。内容により変動する場合があります。`)

    setGeneratedSpec(specLines.join('\n'))
  }

  // クリップボードコピー
  const handleCopySpec = () => {
    if (!generatedSpec) return
    navigator.clipboard.writeText(generatedSpec)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // PDFダウンロード処理
  const handleDownloadPDF = async () => {
    try {
      setIsDownloadingPdf(true)

      const formattedAnswers: { label: string; value: string }[] = []

      if (clientName.trim()) {
        formattedAnswers.push({ label: '依頼者名', value: clientName })
      }

      activeConfig.fields.forEach((field) => {
        if (field.type === 'note' || field.type === 'faq') return

        const answer = formAnswers[field.id]
        if (!answer || (Array.isArray(answer) && answer.length === 0)) return

        const titleName = field.title || field.label || '項目'

        if (Array.isArray(answer)) {
          formattedAnswers.push({ label: titleName, value: answer.join(', ') })
        } else {
          formattedAnswers.push({ label: titleName, value: String(answer) })
        }
      })

      const response = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorName,
          formTitle: activeConfig.title || '概算見積もり・仕様書',
          answers: formattedAnswers,
          totalPrice,
          thanksMessage: statusComment || 'ご検討ありがとうございます。',
        }),
      })

      if (!response.ok) {
        throw new Error('PDFの生成に失敗しました')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `見積仕様書_${creatorName}_${Date.now()}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error(error)
      alert('PDFの生成中にエラーが発生しました。')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white/95 backdrop-blur-2xl rounded-3xl p-5 sm:p-7 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-white relative">
        {/* ヘッダー */}
        <div className="flex justify-between items-start pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              {activeConfig.title || '見積もり・仕様書作成'}
            </h3>
            <p className="text-xs text-slate-500">
              {activeConfig.description || '項目を選択して簡単見積もりを作成します'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold transition cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* フォーム/結果表示エリア */}
        <div className="overflow-y-auto py-5 space-y-6 flex-1 pr-1">
          {!generatedSpec ? (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  お名前（またはアカウント名）
                </label>
                <input
                  type="text"
                  placeholder="例: 山田太郎"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                />
              </div>

              {activeConfig.fields.map((field) => {
                const titleName = field.title || field.label || '項目'

                {/* 注意事項 (note) */}
                if (field.type === 'note') {
                  return (
                    <div key={field.id} className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-amber-900 text-xs space-y-1">
                      <span className="font-extrabold block">⚠️ {titleName}</span>
                      <p className="whitespace-pre-wrap font-medium opacity-90">{field.noteText}</p>
                    </div>
                  )
                }

                {/* FAQ */}
                if (field.type === 'faq') {
                  return (
                    <div key={field.id} className="p-4 bg-sky-50/80 border border-sky-200 rounded-2xl text-sky-900 text-xs space-y-1">
                      <span className="font-extrabold block">💡 Q. {titleName}</span>
                      <p className="whitespace-pre-wrap font-medium opacity-90">A. {field.faqAnswer}</p>
                    </div>
                  )
                }

                return (
                  <div
                    key={field.id}
                    className="space-y-2 bg-slate-50/70 p-4 rounded-2xl border border-slate-100"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-800">
                        {titleName}
                      </span>
                      {field.required && (
                        <span className="text-[10px] bg-rose-100 text-rose-600 font-extrabold px-1.5 py-0.5 rounded">
                          必須
                        </span>
                      )}
                    </div>

                    {/* Radio 選択肢 */}
                    {field.type === 'radio' && field.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {field.options.map((opt, i) => {
                          const isSelected = formAnswers[field.id] === opt.label
                          const isPercent = opt.priceType === 'percent' || opt.calcType === 'percent'
                          return (
                            <label
                              key={i}
                              onClick={() => handleInputChange(field.id, opt.label)}
                              className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold cursor-pointer transition ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <span>{opt.label}</span>
                              <span
                                className={`text-[11px] ${
                                  isSelected ? 'text-indigo-100' : 'text-slate-400'
                                }`}
                              >
                                {isPercent
                                  ? `+${opt.price}%`
                                  : opt.price > 0
                                  ? `+¥${opt.price.toLocaleString()}`
                                  : '標準'}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    )}

                    {/* Checkbox 選択肢 */}
                    {field.type === 'checkbox' && field.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {field.options.map((opt, i) => {
                          const currentList: string[] = formAnswers[field.id] || []
                          const isSelected = currentList.includes(opt.label)
                          const isPercent = opt.priceType === 'percent' || opt.calcType === 'percent'
                          return (
                            <label
                              key={i}
                              onClick={() =>
                                handleInputChange(field.id, opt.label, true)
                              }
                              className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold cursor-pointer transition ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <span>{opt.label}</span>
                              <span
                                className={`text-[11px] ${
                                  isSelected ? 'text-indigo-100' : 'text-slate-400'
                                }`}
                              >
                                {isPercent
                                  ? `+${opt.price}%`
                                  : `+¥${opt.price.toLocaleString()}`}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    )}

                    {/* 1行テキスト */}
                    {field.type === 'text' && (
                      <input
                        type="text"
                        placeholder="ご記入ください"
                        value={formAnswers[field.id] || ''}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                        className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                      />
                    )}

                    {/* 複数行テキスト */}
                    {field.type === 'textarea' && (
                      <textarea
                        rows={3}
                        placeholder="構図、キャラクターの特徴、納期のご希望などがあればご記入ください"
                        value={formAnswers[field.id] || ''}
                        onChange={(e) =>
                          handleInputChange(field.id, e.target.value)
                        }
                        className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                      />
                    )}

                    {/* カラーピッカー */}
                    {field.type === 'color' && (
                      <div className="flex items-center gap-3 bg-white p-2 border border-slate-200 rounded-xl">
                        <input
                          type="color"
                          value={formAnswers[field.id] || '#000000'}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                          className="h-8 w-12 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white shrink-0"
                        />
                        <span className="text-xs font-mono font-bold text-slate-700">
                          {formAnswers[field.id] || '#000000'}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          ) : (
            /* 生成結果プレビュー */
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl font-mono text-xs leading-relaxed whitespace-pre-wrap select-all border border-slate-800 shadow-inner">
                {generatedSpec}
              </div>

              {/* テキストコピー / PDF保存ボタン */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={handleCopySpec}
                  className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <span>{copied ? '✅' : '📋'}</span>
                  <span>{copied ? 'コピー完了！' : '仕様書テキストをコピー'}</span>
                </button>

                <button
                  onClick={handleDownloadPDF}
                  disabled={isDownloadingPdf}
                  className="py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-extrabold rounded-xl transition text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <span>📄</span>
                  <span>{isDownloadingPdf ? 'PDF生成中...' : 'PDF形式で保存'}</span>
                </button>
              </div>

              {/* 連絡窓口リンク */}
              <div className="pt-2 space-y-2">
                <p className="text-xs font-black text-slate-700">
                  コピーまたはPDFを保存後、以下の窓口へお送りください:
                </p>

                {twitterUrl && (
                  <a
                    href={twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl transition flex items-center justify-between text-xs"
                  >
                    <span>X (Twitter) の DM で送る</span>
                    <span>↗</span>
                  </a>
                )}

                {externalUrl && (
                  <a
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl transition flex items-center justify-between text-xs"
                  >
                    <span>外部フォーム / Webサイトで送る</span>
                    <span>↗</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* フッター（金額表示と決定ボタン） */}
        {!generatedSpec && (
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
            <div className="text-center sm:text-left">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                概算合計金額
              </span>
              <span className="text-xl sm:text-2xl font-black text-indigo-600">
                ¥{totalPrice.toLocaleString()}
                <span className="text-xs text-slate-500 font-normal ml-1">
                  (税込)
                </span>
              </span>
            </div>

            <button
              onClick={handleGenerateSpec}
              className="w-full sm:w-auto py-3 px-6 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold rounded-xl transition text-xs shadow-lg shadow-indigo-200 cursor-pointer"
            >
              この内容で仕様書を作成 ➔
            </button>
          </div>
        )}

        {generatedSpec && (
          <div className="pt-3 border-t border-slate-100 flex justify-start">
            <button
              onClick={() => setGeneratedSpec(null)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 transition flex items-center gap-1 cursor-pointer"
            >
              ← 条件選択に戻る
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
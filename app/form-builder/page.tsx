'use client'

import { useState } from 'react'
import Link from 'next/link'

type Option = {
  label: string
  price: number
  calcType?: 'add' | 'percent'
}

type Field = {
  id: string
  title: string
  type: 'radio' | 'checkbox' | 'text'
  required?: boolean
  options?: Option[]
}

export default function FormBuilderPage() {
  const [formTitle, setFormTitle] = useState('見積もり・仕様書作成フォーム')
  const [formDescription, setFormDescription] = useState('項目を選択して簡単見積もりを作成します')
  const [isSaved, setIsSaved] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const [fields, setFields] = useState<Field[]>([
    {
      id: 'field_1',
      title: '描画範囲',
      type: 'radio',
      required: true,
      options: [
        { label: 'バストアップ', price: 0, calcType: 'add' },
        { label: '太ももまで', price: 3000, calcType: 'add' },
        { label: '全身', price: 6000, calcType: 'add' },
      ],
    },
    {
      id: 'field_2',
      title: '追加オプション',
      type: 'checkbox',
      required: false,
      options: [
        { label: '商用利用（基本料金の50%加算）', price: 50, calcType: 'percent' },
        { label: '著作権譲渡（基本料金の100%加算）', price: 100, calcType: 'percent' },
        { label: '背景描き込み', price: 4000, calcType: 'add' },
      ],
    },
  ])

  // 指定インデックスの位置に新項目を挿入（ブロック直下での割り込み追加）
  const handleAddFieldAtIndex = (index: number) => {
    const newField: Field = {
      id: `field_${Date.now()}`,
      title: '新しい項目',
      type: 'radio',
      required: false,
      options: [
        { label: '選択肢1', price: 0, calcType: 'add' },
        { label: '選択肢2', price: 1000, calcType: 'add' },
      ],
    }

    setFields((prev) => {
      const updated = [...prev]
      updated.splice(index, 0, newField)
      return updated
    })
  }

  // 項目の順序を上下に移動
  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= fields.length) return

    setFields((prev) => {
      const updated = [...prev]
      const [movedItem] = updated.splice(index, 1)
      updated.splice(targetIndex, 0, movedItem)
      return updated
    })
  }

  // 項目削除
  const handleRemoveField = (fieldId: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fieldId))
  }

  // 項目更新
  const handleUpdateField = (fieldId: string, updatedField: Partial<Field>) => {
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, ...updatedField } : f))
    )
  }

  // 選択肢追加
  const handleAddOption = (fieldId: string) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id === fieldId) {
          const options = f.options || []
          return {
            ...f,
            options: [
              ...options,
              { label: `選択肢 ${options.length + 1}`, price: 0, calcType: 'add' },
            ],
          }
        }
        return f
      })
    )
  }

  // 選択肢更新
  const handleUpdateOption = (
    fieldId: string,
    optIndex: number,
    updatedOption: Partial<Option>
  ) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id === fieldId && f.options) {
          const newOptions = [...f.options]
          newOptions[optIndex] = { ...newOptions[optIndex], ...updatedOption }
          return { ...f, options: newOptions }
        }
        return f
      })
    )
  }

  // 選択肢削除
  const handleRemoveOption = (fieldId: string, optIndex: number) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id === fieldId && f.options) {
          return {
            ...f,
            options: f.options.filter((_, idx) => idx !== optIndex),
          }
        }
        return f
      })
    )
  }

  // 保存処理
  const handleSave = () => {
    // API等への保存ロジックをここに記述
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 3000)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 font-sans">
      {/* ヘッダー */}
      <header className="px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs flex justify-between items-center">
        <div className="max-w-4xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-bold text-slate-500 hover:text-slate-800 transition"
            >
              ← 戻る
            </Link>
            <h1 className="text-sm font-black text-slate-800 border-l border-slate-200 pl-3">
              フォームビルダー
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
            >
              {showPreview ? '編集に戻る' : 'プレビュー'}
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-xs"
            >
              {isSaved ? '保存しました！' : '保存する'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {showPreview ? (
          /* プレビュー表示 */
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-xl font-black text-slate-800">{formTitle}</h2>
              <p className="text-xs text-slate-500 mt-1">{formDescription}</p>
            </div>

            <div className="space-y-6">
              {fields.map((f, i) => (
                <div key={f.id} className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 block">
                    {i + 1}. {f.title}{' '}
                    {f.required && <span className="text-rose-500 text-xs">*必須</span>}
                  </label>

                  {f.type === 'text' && (
                    <input
                      type="text"
                      disabled
                      placeholder="自由記述テキスト"
                      className="w-full text-xs p-3 bg-slate-50 rounded-xl border border-slate-200"
                    />
                  )}

                  {(f.type === 'radio' || f.type === 'checkbox') && (
                    <div className="space-y-1.5">
                      {f.options?.map((opt, optIdx) => (
                        <label
                          key={optIdx}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50"
                        >
                          <span className="text-xs font-bold text-slate-700">
                            {opt.label}
                          </span>
                          <span className="text-xs font-bold text-indigo-600">
                            {opt.price > 0 &&
                              (opt.calcType === 'percent'
                                ? `+${opt.price}%`
                                : `+¥${opt.price.toLocaleString()}`)}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* エディタ表示 */
          <>
            {/* 基本設定 */}
            <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                フォーム基本設定
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    フォームタイトル
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    フォーム説明文
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </section>

            {/* 項目リスト */}
            <section className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  設問項目リスト ({fields.length}件)
                </h2>
              </div>

              {fields.length === 0 && (
                <button
                  type="button"
                  onClick={() => handleAddFieldAtIndex(0)}
                  className="w-full py-4 bg-white hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 font-bold text-xs rounded-2xl border border-dashed border-slate-300 transition flex items-center justify-center gap-2"
                >
                  <span>＋ 最初の項目を追加</span>
                </button>
              )}

              {fields.map((field, index) => (
                <div key={field.id} className="space-y-3">
                  {/* 項目カード */}
                  <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4 relative">
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs font-black text-slate-400">
                          #{index + 1}
                        </span>
                        <input
                          type="text"
                          placeholder="設問タイトル"
                          value={field.title}
                          onChange={(e) =>
                            handleUpdateField(field.id, { title: e.target.value })
                          }
                          className="w-full text-sm font-black text-slate-800 p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {/* 上下順序移動 & 削除 */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveField(index, 'up')}
                          className="p-1.5 text-xs text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={index === fields.length - 1}
                          onClick={() => handleMoveField(index, 'down')}
                          className="p-1.5 text-xs text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveField(field.id)}
                          className="text-xs font-bold text-rose-500 hover:text-rose-700 p-1.5 transition ml-2"
                        >
                          削除
                        </button>
                      </div>
                    </div>

                    {/* タイプ & 必須設定 */}
                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">
                          タイプ:
                        </span>
                        <select
                          value={field.type}
                          onChange={(e) =>
                            handleUpdateField(field.id, {
                              type: e.target.value as Field['type'],
                            })
                          }
                          className="text-xs font-bold p-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none"
                        >
                          <option value="radio">単一選択 (ラジオボタン)</option>
                          <option value="checkbox">複数選択 (チェックボックス)</option>
                          <option value="text">自由記述 (テキスト入力)</option>
                        </select>
                      </div>

                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required || false}
                          onChange={(e) =>
                            handleUpdateField(field.id, {
                              required: e.target.checked,
                            })
                          }
                          className="rounded text-indigo-600"
                        />
                        <span>必須項目にする</span>
                      </label>
                    </div>

                    {/* 選択肢編集（radio / checkbox） */}
                    {(field.type === 'radio' || field.type === 'checkbox') && (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <span className="text-xs font-bold text-slate-500 block">
                          選択肢と価格設定:
                        </span>

                        <div className="space-y-2">
                          {field.options?.map((opt, optIndex) => (
                            <div
                              key={optIndex}
                              className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200/60"
                            >
                              <input
                                type="text"
                                placeholder="選択肢名"
                                value={opt.label}
                                onChange={(e) =>
                                  handleUpdateOption(field.id, optIndex, {
                                    label: e.target.value,
                                  })
                                }
                                className="flex-1 text-xs p-2 bg-white rounded-lg border border-slate-200 font-bold"
                              />

                              <select
                                value={opt.calcType || 'add'}
                                onChange={(e) =>
                                  handleUpdateOption(field.id, optIndex, {
                                    calcType: e.target.value as 'add' | 'percent',
                                  })
                                }
                                className="text-xs font-bold p-2 bg-white rounded-lg border border-slate-200"
                              >
                                <option value="add">固定額加算 (¥)</option>
                                <option value="percent">割合加算 (%)</option>
                              </select>

                              <div className="flex items-center gap-1">
                                <span className="text-xs font-bold text-slate-400">
                                  {opt.calcType === 'percent' ? '%' : '¥'}
                                </span>
                                <input
                                  type="number"
                                  value={opt.price}
                                  onChange={(e) =>
                                    handleUpdateOption(field.id, optIndex, {
                                      price: Number(e.target.value),
                                    })
                                  }
                                  className="w-20 text-xs p-2 bg-white rounded-lg border border-slate-200 font-bold"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveOption(field.id, optIndex)}
                                className="text-slate-400 hover:text-rose-500 font-bold text-xs px-2"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddOption(field.id)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 pt-1 block"
                        >
                          ＋ 選択肢を追加
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 各カードのすぐ下に配置した挿入ボタン */}
                  <div className="flex justify-center my-2">
                    <button
                      type="button"
                      onClick={() => handleAddFieldAtIndex(index + 1)}
                      className="py-1.5 px-4 bg-white hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 font-bold text-xs rounded-full border border-dashed border-slate-300 hover:border-indigo-300 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs opacity-70 hover:opacity-100"
                    >
                      <span>＋</span>
                      <span>ここに項目を追加</span>
                    </button>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
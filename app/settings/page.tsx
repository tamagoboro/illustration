'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // プロフィール基本情報
  const [displayName, setDisplayName] = useState('')
  const [statusComment, setStatusComment] = useState('')
  const [twitterUrl, setTwitterUrl] = useState('')
  const [externalUrl, setExternalUrl] = useState('')

  // 見積もりシミュレーター設定 (JSON構造)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [fields, setFields] = useState<any[]>([])

  // 1. 初期データの取得
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          alert('ログインが必要です')
          return
        }

        setUserId(user.id)

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) throw error

        if (data) {
          setDisplayName(data.display_name || '')
          setStatusComment(data.status_comment || '')
          setTwitterUrl(data.twitter_url || '')
          setExternalUrl(data.external_estimation_url || '')

          // form_config の読み込み
          const config = data.form_config || {}
          setFormTitle(config.title || '概算見積もり・仕様書作成シミュレーター')
          setFormDescription(
            config.description ||
              'ご希望の条件を選択すると、リアルタイムで概算金額と依頼仕様書が作成されます。'
          )
          setFields(config.fields || [])
        }
      } catch (err) {
        console.error('データ取得エラー:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [])

  // 2. 設問フィールドの操作
  const addField = () => {
    const newField = {
      id: `f_${Date.now()}`,
      title: '新しい項目名',
      type: 'radio', // radio | checkbox | text
      required: false,
      options: [
        { label: '選択肢 1', price: 0, calcType: 'add' },
      ],
    }
    setFields([...fields, newField])
  }

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index))
  }

  const updateField = (index: number, key: string, value: any) => {
    const updated = [...fields]
    updated[index][key] = value
    setFields(updated)
  }

  // 3. 選択肢（Option）の操作
  const addOption = (fieldIndex: number) => {
    const updated = [...fields]
    if (!updated[fieldIndex].options) updated[fieldIndex].options = []
    updated[fieldIndex].options.push({ label: '新しい選択肢', price: 0, calcType: 'add' })
    setFields(updated)
  }

  const removeOption = (fieldIndex: number, optionIndex: number) => {
    const updated = [...fields]
    updated[fieldIndex].options = updated[fieldIndex].options.filter(
      (_: any, i: number) => i !== optionIndex
    )
    setFields(updated)
  }

  const updateOption = (
    fieldIndex: number,
    optionIndex: number,
    key: string,
    value: any
  ) => {
    const updated = [...fields]
    updated[fieldIndex].options[optionIndex][key] = value
    setFields(updated)
  }

  // 4. 設定の保存
  const handleSave = async () => {
    if (!userId) return
    setSaving(true)

    try {
      const formConfig = {
        title: formTitle,
        description: formDescription,
        fields,
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          status_comment: statusComment,
          twitter_url: twitterUrl,
          external_estimation_url: externalUrl,
          form_config: formConfig,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (error) throw error
      alert('設定を保存しました！')
    } catch (err) {
      console.error('保存エラー:', err)
      alert('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500">読み込み中...</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-8 pb-24">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">プロフィール・見積もり設定</h1>
          <p className="text-xs text-slate-500">
            ポートフォリオに表示される情報や見積もりシミュレーターの項目を編集します。
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-xl text-xs shadow-md transition"
        >
          {saving ? '保存中...' : '変更を保存'}
        </button>
      </div>

      {/* 基本情報設定 */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
        <h2 className="text-sm font-bold text-slate-800">基本プロフィール</h2>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">表示名</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full text-xs p-3 rounded-xl border border-slate-200"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">ステータスメッセージ / 受注状況</label>
          <input
            type="text"
            placeholder="例: 現在9月納品分のご相談を受付中です。"
            value={statusComment}
            onChange={(e) => setStatusComment(e.target.value)}
            className="w-full text-xs p-3 rounded-xl border border-slate-200"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">X (Twitter) URL</label>
            <input
              type="text"
              placeholder="https://x.com/username"
              value={twitterUrl}
              onChange={(e) => setTwitterUrl(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">外部連絡先 / Webサイト URL</label>
            <input
              type="text"
              placeholder="https://example.com/contact"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200"
            />
          </div>
        </div>
      </section>

      {/* 見積もりシミュレーター項目設定 */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6">
        <div>
          <h2 className="text-sm font-bold text-slate-800">見積もりシミュレーター設定</h2>
          <p className="text-xs text-slate-500">モーダル内に表示される選択肢や加算額をカスタムできます。</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">シミュレータータイトル</label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">説明文</label>
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200"
            />
          </div>
        </div>

        {/* 設問一覧 */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-700">設問リスト</h3>
            <button
              onClick={addField}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
            >
              ＋ 設問を追加
            </button>
          </div>

          {fields.map((field, fieldIndex) => (
            <div
              key={field.id || fieldIndex}
              className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 relative"
            >
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={field.title}
                  onChange={(e) => updateField(fieldIndex, 'title', e.target.value)}
                  className="font-bold text-xs p-2 rounded-lg border border-slate-200 bg-white flex-1"
                />
                <select
                  value={field.type}
                  onChange={(e) => updateField(fieldIndex, 'type', e.target.value)}
                  className="text-xs p-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="radio">単一選択 (ラジオ)</option>
                  <option value="checkbox">複数選択 (チェックボックス)</option>
                  <option value="text">自由入力 (テキスト)</option>
                </select>

                <button
                  onClick={() => removeField(fieldIndex)}
                  className="text-xs text-rose-500 font-bold hover:underline px-2"
                >
                  削除
                </button>
              </div>

              {/* 選択肢設定 (radio / checkbox の場合) */}
              {field.type !== 'text' && (
                <div className="pl-2 space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-slate-500">選択肢・金額設定</span>
                    <button
                      onClick={() => addOption(fieldIndex)}
                      className="text-[11px] text-indigo-600 font-bold hover:underline"
                    >
                      ＋ 選択肢を追加
                    </button>
                  </div>

                  {field.options?.map((opt: any, optIndex: number) => (
                    <div key={optIndex} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="選択肢名"
                        value={opt.label}
                        onChange={(e) =>
                          updateOption(fieldIndex, optIndex, 'label', e.target.value)
                        }
                        className="text-xs p-2 rounded-lg border border-slate-200 bg-white flex-1"
                      />

                      <select
                        value={opt.calcType || 'add'}
                        onChange={(e) =>
                          updateOption(fieldIndex, optIndex, 'calcType', e.target.value)
                        }
                        className="text-xs p-2 rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="add">加算 (+円)</option>
                        <option value="percent">割合 (+%)</option>
                      </select>

                      <input
                        type="number"
                        placeholder="金額 / %"
                        value={opt.price}
                        onChange={(e) =>
                          updateOption(
                            fieldIndex,
                            optIndex,
                            'price',
                            Number(e.target.value)
                          )
                        }
                        className="text-xs p-2 rounded-lg border border-slate-200 bg-white w-24"
                      />

                      <button
                        onClick={() => removeOption(fieldIndex, optIndex)}
                        className="text-xs text-slate-400 hover:text-rose-500 font-bold px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
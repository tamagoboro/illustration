'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Option = {
  label: string
  price: number
  priceType?: 'fixed' | 'percent'
}

type Field = {
  id: string
  label: string
  type: 'text' | 'textarea' | 'color' | 'radio' | 'checkbox' | 'note' | 'faq'
  price?: number
  required?: boolean
  noteText?: string
  faqAnswer?: string
  options?: Option[]
}

type FormConfig = {
  title: string
  description: string
  theme_color: string
  is_accepting: boolean
  fields: Field[]
}

// 職種別ワンタップテンプレート
const FORM_TEMPLATES: Record<string, FormConfig> = {
  illustration: {
    title: 'イラストご依頼フォーム',
    description: '※商用利用や著作権譲渡については選択肢をご指定ください。\n※制作実績としてSNS等に公開させていただく場合がございます。',
    theme_color: '#ec4899',
    is_accepting: true,
    fields: [
      { id: 'f_1', label: '注意事項', type: 'note', noteText: '納期は通常2週間〜1ヶ月となります。お急ぎの場合は特急料金がかかります。', price: 0 },
      { id: 'f_2', label: '基本イラスト制作', type: 'text', price: 10000, required: true },
      { id: 'f_3', label: '描画範囲', type: 'radio', price: 0, options: [{ label: 'バストアップ', price: 0, priceType: 'fixed' }, { label: '太ももまで', price: 3000, priceType: 'fixed' }, { label: '全身', price: 6000, priceType: 'fixed' }], required: true },
      { id: 'f_4', label: '用途・追加オプション', type: 'checkbox', price: 0, options: [
        { label: '商用利用（基本料金の50%加算）', price: 50, priceType: 'percent' },
        { label: '著作権譲渡（基本料金の100%加算）', price: 100, priceType: 'percent' },
        { label: '人物追加 (+1人)', price: 6000, priceType: 'fixed' },
        { label: '背景描き込み', price: 4000, priceType: 'fixed' }
      ], required: false }
    ]
  },
  vtuber: {
    title: 'Live2Dモデルパーツ分け・制作依頼',
    description: 'VTuber用キャラデザ・パーツ分けイラストの依頼フォームです。',
    theme_color: '#8b5cf6',
    is_accepting: true,
    fields: [
      { id: 'f_1', label: '基本制作（パーツ分け済み立ち絵）', type: 'text', price: 50000, required: true },
      { id: 'f_2', label: '三面図作成', type: 'radio', price: 0, options: [{ label: '不要', price: 0, priceType: 'fixed' }, { label: '必要', price: 20000, priceType: 'fixed' }], required: true },
      { id: 'f_3', label: 'ライセンス・追加オプション', type: 'checkbox', price: 0, options: [
        { label: '商用利用ライセンス', price: 50, priceType: 'percent' },
        { label: '特殊衣装・小物の追加', price: 10000, priceType: 'fixed' },
        { label: '表情差分 4種', price: 8000, priceType: 'fixed' }
      ], required: false }
    ]
  },
  mix: {
    title: '歌ってみた Mixご依頼フォーム',
    description: 'ボーカルピッチ補正・タイミング補正・マスタリング込みの価格です。',
    theme_color: '#0284c7',
    is_accepting: true,
    fields: [
      { id: 'f_1', label: '基本Mix料金', type: 'radio', price: 0, options: [{ label: 'ワンコーラス', price: 4000, priceType: 'fixed' }, { label: 'フルサイズ', price: 8000, priceType: 'fixed' }], required: true },
      { id: 'f_2', label: 'オプション', type: 'checkbox', price: 0, options: [
        { label: '商用利用（CD販売・サブスク配信等）', price: 50, priceType: 'percent' },
        { label: 'ボーカル1名追加', price: 3000, priceType: 'fixed' },
        { label: '特急納品（3日以内）', price: 5000, priceType: 'fixed' }
      ], required: false }
    ]
  },
  video: {
    title: 'MV・動画編集依頼フォーム',
    description: 'YouTube動画やオリジナル曲MVの編集をお引き受けします。',
    theme_color: '#10b981',
    is_accepting: true,
    fields: [
      { id: 'f_1', label: '動画の長さ（基本制作費）', type: 'radio', price: 0, options: [{ label: '3分以内', price: 10000, priceType: 'fixed' }, { label: '5分以内', price: 15000, priceType: 'fixed' }, { label: '10分以内', price: 25000, priceType: 'fixed' }], required: true },
      { id: 'f_2', label: '権利・追加編集オプション', type: 'checkbox', price: 0, options: [
        { label: '商用利用・二次利用権', price: 30, priceType: 'percent' },
        { label: 'フルテロップ付け', price: 5000, priceType: 'fixed' },
        { label: 'サムネイル作成', price: 3000, priceType: 'fixed' }
      ], required: false }
    ]
  }
}

export default function FormBuilderPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [showTmplModal, setShowTmplModal] = useState(false)

  // フォーム基本設定（テーマカラー・ステータス等）
  const [config, setConfig] = useState<FormConfig>({
    title: 'ご依頼・お仕事申請フォーム',
    description: '注意事項などを入力してください',
    theme_color: '#ec4899',
    is_accepting: true,
    fields: FORM_TEMPLATES.illustration.fields,
  })

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('form_config')
        .eq('user_id', user.id)
        .single()

      if (profile?.form_config) {
        setConfig((prev) => ({ ...prev, ...(profile.form_config as FormConfig) }))
      }
      setLoading(false)
    }

    loadUserData()
  }, [router])

  // アクションハンドラー
  const updateConfig = (key: keyof FormConfig, val: any) => {
    setConfig((prev) => ({ ...prev, [key]: val }))
  }

  const addField = () => {
    const newField: Field = {
      id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      label: '新しい質問',
      type: 'text',
      price: 0,
      required: false,
    }
    setConfig((prev) => ({ ...prev, fields: [...prev.fields, newField] }))
  }

  const removeField = (idx: number) => {
    setConfig((prev) => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== idx),
    }))
  }

  const moveField = (idx: number, direction: 'up' | 'down') => {
    setConfig((prev) => {
      const fields = [...prev.fields]
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1
      if (targetIdx < 0 || targetIdx >= fields.length) return prev
      const [movedItem] = fields.splice(idx, 1)
      fields.splice(targetIdx, 0, movedItem)
      return { ...prev, fields }
    })
  }

  const updateField = (idx: number, key: keyof Field, val: any) => {
    setConfig((prev) => {
      const fields = [...prev.fields]
      fields[idx] = { ...fields[idx], [key]: val }
      if ((val === 'radio' || val === 'checkbox') && !fields[idx].options) {
        fields[idx].options = [{ label: '選択肢 1', price: 0, priceType: 'fixed' }]
      }
      return { ...prev, fields }
    })
  }

  const addOption = (fIdx: number) => {
    setConfig((prev) => {
      const fields = [...prev.fields]
      const opts = fields[fIdx].options || []
      fields[fIdx].options = [...opts, { label: '新しい選択肢', price: 0, priceType: 'fixed' }]
      return { ...prev, fields }
    })
  }

  const removeOption = (fIdx: number, oIdx: number) => {
    setConfig((prev) => {
      const fields = [...prev.fields]
      fields[fIdx].options = fields[fIdx].options?.filter((_, i) => i !== oIdx)
      return { ...prev, fields }
    })
  }

  const updateOption = (fIdx: number, oIdx: number, key: keyof Option, val: any) => {
    setConfig((prev) => {
      const fields = [...prev.fields]
      if (fields[fIdx].options) {
        const opts = [...fields[fIdx].options!]
        opts[oIdx] = { ...opts[oIdx], [key]: val }
        fields[fIdx].options = opts
      }
      return { ...prev, fields }
    })
  }

  const applyTemplate = (type: string) => {
    if (confirm('現在の入力内容がテンプレートで置き換わります。よろしいですか？')) {
      const tmpl = FORM_TEMPLATES[type]
      if (tmpl) {
        setConfig(JSON.parse(JSON.stringify(tmpl)))
        setShowTmplModal(false)
      }
    }
  }

  const handleSave = async () => {
    if (!userId) return
    setSaving(true)

    const { error } = await supabase
      .from('profiles')
      .update({ form_config: config })
      .eq('user_id', userId)

    setSaving(false)
    if (error) {
      alert('保存に失敗しました: ' + error.message)
    } else {
      alert('✨ 見積もりフォームを更新・データベースへ保存しました！')
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-xs font-bold text-slate-400">読み込み中...</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      
      {/* エディタエリア */}
      <div className="space-y-6">
        
        {/* (A) 基本・デザイン設定 */}
        <div className="bg-white rounded-3xl p-6 border-2 border-slate-100 shadow-sm space-y-4">
          <h2 className="font-black text-slate-800 text-sm">✨ 基本・デザイン設定</h2>
          
          <div className="flex items-center gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">メインテーマカラー</label>
              <input
                type="color"
                value={config.theme_color}
                onChange={(e) => updateConfig('theme_color', e.target.value)}
                className="h-10 w-20 rounded-xl border-2 border-slate-200 cursor-pointer"
              />
            </div>
            <div className="text-xs text-slate-400 font-bold">
              ボタンやフォームのアクセントカラーに反映されます
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-black text-slate-700 block">受付ステータス</span>
              <span className="text-[10px] font-bold text-slate-400">「停止」にすると公開フォームで送信不可になります</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.is_accepting}
                onChange={(e) => updateConfig('is_accepting', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
        </div>

        {/* (B) フォーム基本情報 */}
        <div className="bg-white rounded-3xl p-6 border-2 border-slate-100 shadow-sm space-y-3">
          <h2 className="font-black text-slate-800 text-sm">📝 フォーム基本情報</h2>
          <input
            type="text"
            value={config.title}
            onChange={(e) => updateConfig('title', e.target.value)}
            className="w-full px-4 py-3 text-sm font-black bg-slate-50 border-2 border-slate-200 rounded-2xl focus:outline-none"
            placeholder="フォームタイトル"
          />
          <textarea
            value={config.description}
            onChange={(e) => updateConfig('description', e.target.value)}
            rows={2}
            className="w-full px-4 py-2.5 text-xs font-bold bg-slate-50 border-2 border-slate-200 rounded-2xl focus:outline-none"
            placeholder="注意事項などを入力してください"
          />
        </div>

        {/* (C) カスタム設問リスト */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-black text-slate-800 text-sm">🧩 カスタム設問項目</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowTmplModal(true)}
                className="px-3 py-2 bg-amber-400 hover:bg-amber-500 text-slate-800 font-black text-xs rounded-full shadow-xs cursor-pointer"
              >
                ✨ テンプレート
              </button>
              <button
                onClick={addField}
                className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white font-black text-xs rounded-full shadow-xs cursor-pointer"
              >
                + 項目追加
              </button>
            </div>
          </div>

          {config.fields.map((f, idx) => (
            <div key={f.id} className="bg-white rounded-2xl p-5 border-2 border-slate-100 space-y-3 shadow-xs">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-pink-500">項目 #{idx + 1}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => moveField(idx, 'up')}
                    disabled={idx === 0}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 disabled:opacity-30 cursor-pointer"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveField(idx, 'down')}
                    disabled={idx === config.fields.length - 1}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 disabled:opacity-30 cursor-pointer"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => removeField(idx)}
                    className="text-xs font-bold text-red-400 hover:text-red-600 cursor-pointer ml-2"
                  >
                    削除
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={f.label}
                  onChange={(e) => updateField(idx, 'label', e.target.value)}
                  placeholder="タイトル"
                  className="col-span-2 px-3 py-2 text-xs font-bold border-2 border-slate-100 rounded-xl"
                />
                <select
                  value={f.type}
                  onChange={(e) => updateField(idx, 'type', e.target.value as any)}
                  className="px-2 py-2 text-xs font-bold border-2 border-slate-100 rounded-xl bg-slate-50"
                >
                  <option value="text">1行テキスト</option>
                  <option value="textarea">長文テキスト</option>
                  <option value="color">カラー指定</option>
                  <option value="radio">単一選択 (ラジオ)</option>
                  <option value="checkbox">複数選択 (チェック)</option>
                  <option value="note">💡 クリエイター説明文</option>
                  <option value="faq">❓ FAQ（よくある質問）</option>
                </select>
              </div>

              {f.type === 'note' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 block">表示する説明文テキスト</label>
                  <textarea
                    value={f.noteText || ''}
                    onChange={(e) => updateField(idx, 'noteText', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 text-xs font-bold bg-amber-50/50 border rounded-xl"
                    placeholder="注意事項や案内文を入力"
                  />
                </div>
              )}

              {f.type === 'faq' && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block">質問（Q）</label>
                    <input
                      type="text"
                      value={f.label}
                      onChange={(e) => updateField(idx, 'label', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-bold border rounded-xl"
                      placeholder="例: 商用利用の範囲は？"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block">回答（A）</label>
                    <textarea
                      value={f.faqAnswer || ''}
                      onChange={(e) => updateField(idx, 'faqAnswer', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 text-xs font-bold bg-amber-50/50 border rounded-xl"
                      placeholder="例: グッズ販売や動画収益化でご使用いただけます。"
                    />
                  </div>
                </div>
              )}

              {f.type !== 'note' && f.type !== 'faq' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-500 whitespace-nowrap">基本金額:</label>
                  <input
                    type="number"
                    value={f.price || 0}
                    onChange={(e) => updateField(idx, 'price', Number(e.target.value))}
                    className="w-32 px-3 py-1.5 text-xs font-bold border rounded-xl"
                  />
                  <span className="text-xs font-bold text-slate-400">円</span>
                </div>
              )}

              {(f.type === 'radio' || f.type === 'checkbox') && (
                <div className="pl-2 space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-[10px] font-bold text-slate-400 block">選択肢と追加金額 (固定額 または %指定)</label>
                  {f.options?.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={opt.label}
                        onChange={(e) => updateOption(idx, oIdx, 'label', e.target.value)}
                        className="w-full px-3 py-1 text-xs border rounded-lg"
                        placeholder="選択肢名"
                      />
                      <div className="flex bg-slate-100 p-0.5 rounded-lg border">
                        <button
                          type="button"
                          onClick={() => updateOption(idx, oIdx, 'priceType', 'fixed')}
                          className={`px-1.5 py-0.5 text-[10px] font-black rounded ${opt.priceType !== 'percent' ? 'bg-pink-500 text-white' : 'text-slate-500'}`}
                        >
                          円
                        </button>
                        <button
                          type="button"
                          onClick={() => updateOption(idx, oIdx, 'priceType', 'percent')}
                          className={`px-1.5 py-0.5 text-[10px] font-black rounded ${opt.priceType === 'percent' ? 'bg-pink-500 text-white' : 'text-slate-500'}`}
                        >
                          %
                        </button>
                      </div>
                      <input
                        type="number"
                        value={opt.price}
                        onChange={(e) => updateOption(idx, oIdx, 'price', Number(e.target.value))}
                        className="w-20 px-2 py-1 text-xs border rounded-lg"
                      />
                      <span className="text-xs font-bold text-slate-400 w-4">{opt.priceType === 'percent' ? '%' : '円'}</span>
                      <button onClick={() => removeOption(idx, oIdx)} className="text-xs text-red-400 px-1 cursor-pointer">✕</button>
                    </div>
                  ))}
                  <button
                    onClick={() => addOption(idx)}
                    className="text-[11px] font-black text-pink-500 border border-pink-200 bg-pink-50 px-2 py-1 rounded-lg cursor-pointer"
                  >
                    + 選択肢を追加
                  </button>
                </div>
              )}

              {f.type !== 'note' && f.type !== 'faq' && (
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id={`req_${idx}`}
                    checked={f.required || false}
                    onChange={(e) => updateField(idx, 'required', e.target.checked)}
                  />
                  <label htmlFor={`req_${idx}`} className="text-xs font-bold text-slate-500 cursor-pointer">
                    必須項目にする
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-base rounded-2xl shadow-lg transition cursor-pointer disabled:opacity-50"
        >
          {saving ? '保存中...' : '🚀 フォームを保存・更新'}
        </button>
      </div>

      {/* テンプレートモーダル */}
      {showTmplModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4 max-w-lg w-full border-4 border-amber-100">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-800">🎯 テンプレートを選択</h3>
              <button onClick={() => setShowTmplModal(false)} className="text-slate-400 font-bold hover:text-slate-600">✕</button>
            </div>
            <p className="text-xs font-bold text-slate-400">現在の入力内容は上書きされます。適用したい職種を選んでください。</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button onClick={() => applyTemplate('illustration')} className="p-4 bg-pink-50/60 hover:bg-pink-100 border-2 border-pink-200 rounded-2xl text-left transition space-y-1 cursor-pointer">
                <div className="text-2xl">🎨</div>
                <div className="font-black text-slate-800 text-xs">イラスト・立ち絵依頼</div>
              </button>
              <button onClick={() => applyTemplate('vtuber')} className="p-4 bg-purple-50/60 hover:bg-purple-100 border-2 border-purple-200 rounded-2xl text-left transition space-y-1 cursor-pointer">
                <div className="text-2xl">👾</div>
                <div className="font-black text-slate-800 text-xs">Live2D / VTuberモデル</div>
              </button>
              <button onClick={() => applyTemplate('mix')} className="p-4 bg-sky-50/60 hover:bg-sky-100 border-2 border-sky-200 rounded-2xl text-left transition space-y-1 cursor-pointer">
                <div className="text-2xl">🎤</div>
                <div className="font-black text-slate-800 text-xs">歌ってみた Mix / 音楽</div>
              </button>
              <button onClick={() => applyTemplate('video')} className="p-4 bg-emerald-50/60 hover:bg-emerald-100 border-2 border-emerald-200 rounded-2xl text-left transition space-y-1 cursor-pointer">
                <div className="text-2xl">🎬</div>
                <div className="font-black text-slate-800 text-xs">動画編集 / MV制作</div>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
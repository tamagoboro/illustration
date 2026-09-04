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
  thanks_message: string
  theme_color: string
  is_accepting: boolean
  fields: Field[]
}

// 職種別ワンタップテンプレート
const FORM_TEMPLATES: Record<string, FormConfig> = {
  illustration: {
    title: 'イラストご依頼フォーム',
    description: '※商用利用や著作権譲渡については選択肢をご指定ください。\n※制作実績としてSNS等に公開させていただく場合がございます。',
    thanks_message: 'ご依頼メッセージの送信が完了いたしました！\n確認後、通常2日以内にご連絡させていただきます。今しばらくお待ちくださいませ。',
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
    thanks_message: '送信ありがとうございました！内容を確認のうえ、折り返しご連絡いたします。',
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
    thanks_message: 'ご依頼ありがとうございます！音源データ等の不備がないか確認次第ご連絡差し上げます。',
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
    thanks_message: '送信完了いたしました。構成案や素材を確認した上で回答を送信いたします。',
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
  
  // プレビュータブ & モーダル状態
  const [previewTab, setPreviewTab] = useState<'input' | 'thanks'>('input')
  const [showTmplModal, setShowTmplModal] = useState(false)

  // フォーム基本設定（テーマカラー・ステータス等）
  const [config, setConfig] = useState<FormConfig>({
    title: 'ご依頼・お仕事申請フォーム',
    description: '注意事項などを入力してください',
    thanks_message: 'ご依頼ありがとうございます！2日以内にX(旧Twitter)のDMまたはメールにてご連絡いたします。',
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

  // プレビュー用の概算見積計算（ラジオは最初の項目、チェックボックスは非パーセントの項目を基準計算）
  const calculateTotal = () => {
    let basePriceTotal = 0
    let extraFixedPrice = 0
    let percentAdditions = 0

    config.fields.forEach((f) => {
      if (f.price && f.type !== 'note' && f.type !== 'faq') {
        basePriceTotal += f.price
      }
      if (f.options && f.options.length > 0) {
        if (f.type === 'radio') {
          const firstOpt = f.options[0]
          if (firstOpt.priceType === 'percent') {
            percentAdditions += firstOpt.price
          } else {
            extraFixedPrice += firstOpt.price
          }
        }
      }
    })

    const subtotal = basePriceTotal + extraFixedPrice
    return subtotal + Math.round(subtotal * (percentAdditions / 100))
  }

  if (loading) {
    return <div className="p-8 text-center text-xs font-bold text-slate-400">読み込み中...</div>
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-6">
      
      {/* エディタエリア */}
      <div className="w-full lg:w-7/12 space-y-6">
        
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
              ボタンやプレビューのアクセントカラーに即時反映されます
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

        {/* (C) サンクスページ設定 */}
        <div className="bg-white rounded-3xl p-6 border-2 border-slate-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-slate-800 text-sm">🎉 送信完了画面（サンクスページ）</h2>
            <span className="text-[10px] font-bold text-pink-500 bg-pink-50 px-2 py-0.5 rounded-full">お礼メッセージ</span>
          </div>
          <p className="text-xs font-bold text-slate-400">フォーム送信後に表示されるお礼や連絡の目安を設定できます。</p>
          <textarea
            value={config.thanks_message}
            onChange={(e) => updateConfig('thanks_message', e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 text-xs font-bold bg-amber-50/40 border-2 border-amber-100 rounded-2xl focus:outline-none"
            placeholder="ご依頼ありがとうございます！"
          />
        </div>

        {/* (D) カスタム設問リスト */}
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

      {/* リアルタイムスマホ風プレビュー */}
      <div className="w-full lg:w-5/12 sticky top-20 h-[calc(100vh-100px)] flex flex-col space-y-2">
        <div className="flex bg-slate-200/80 p-1 rounded-2xl font-black text-xs">
          <button
            onClick={() => setPreviewTab('input')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer ${previewTab === 'input' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'}`}
          >
            📄 フォーム入力画面
          </button>
          <button
            onClick={() => setPreviewTab('thanks')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer ${previewTab === 'thanks' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'}`}
          >
            🎉 送信完了画面
          </button>
        </div>

        <div className="bg-white rounded-[40px] shadow-2xl border-8 border-slate-800 p-6 overflow-y-auto flex flex-col justify-between flex-1">
          {previewTab === 'input' ? (
            <div className="flex flex-col justify-between h-full space-y-6">
              <div className="space-y-5">
                <div>
                  <span
                    className={`text-[10px] font-black px-3 py-1 rounded-full text-white ${config.is_accepting ? '' : 'bg-slate-400'}`}
                    style={{ backgroundColor: config.is_accepting ? config.theme_color : undefined }}
                  >
                    {config.is_accepting ? '受付中' : '受付停止中'}
                  </span>
                  <h1 className="text-xl font-black text-slate-800 mt-2">{config.title}</h1>
                  <p className="text-xs font-bold text-slate-400 mt-1 whitespace-pre-wrap">{config.description}</p>
                </div>

                <div className="space-y-4">
                  {config.fields.map((f) => {
                    if (f.type === 'note') {
                      return (
                        <div key={f.id} className="bg-amber-50/60 border-2 border-amber-200/60 p-4 rounded-2xl text-xs text-amber-900 font-bold whitespace-pre-wrap">
                          <div className="font-black mb-1 text-amber-800">📌 {f.label}</div>
                          {f.noteText}
                        </div>
                      )
                    }

                    if (f.type === 'faq') {
                      return (
                        <div key={f.id} className="bg-sky-50/60 border-2 border-sky-100 p-4 rounded-2xl space-y-1">
                          <div className="text-xs font-black text-sky-900">❓ {f.label || '質問'}</div>
                          <div className="text-xs font-bold text-slate-600 pl-3 border-l-2 border-sky-300 whitespace-pre-wrap">{f.faqAnswer}</div>
                        </div>
                      )
                    }

                    return (
                      <div key={f.id} className="space-y-1">
                        <label className="text-xs font-black text-slate-700 flex items-center gap-1">
                          {f.label} {f.required && <span className="text-red-500">*</span>}
                          {f.price! > 0 && (
                            <span
                              className="text-[10px] font-black px-2 py-0.5 rounded-full"
                              style={{ color: config.theme_color, backgroundColor: `${config.theme_color}15` }}
                            >
                              +¥{f.price?.toLocaleString()}
                            </span>
                          )}
                        </label>

                        {f.type === 'text' && <input disabled placeholder="入力欄" className="w-full px-3 py-2 bg-slate-50 border-2 rounded-xl text-xs" />}
                        {f.type === 'textarea' && <textarea disabled rows={2} placeholder="入力欄" className="w-full px-3 py-2 bg-slate-50 border-2 rounded-xl text-xs" />}
                        {f.type === 'color' && <input type="color" disabled className="h-8 w-12 rounded border" />}
                        {(f.type === 'radio' || f.type === 'checkbox') && (
                          <div className="space-y-1">
                            {f.options?.map((opt, oIdx) => (
                              <label key={oIdx} className="flex items-center justify-between text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl">
                                <span className="flex items-center space-x-2">
                                  <input type={f.type} disabled defaultChecked={oIdx === 0} style={{ accentColor: config.theme_color }} />
                                  <span>{opt.label}</span>
                                </span>
                                {opt.price > 0 && (
                                  <span className="text-[10px] font-black" style={{ color: config.theme_color }}>
                                    +{opt.priceType === 'percent' ? `${opt.price}%` : `¥${opt.price.toLocaleString()}`}
                                  </span>
                                )}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div
                className="mt-6 pt-4 border-t-2 border-slate-100 flex justify-between items-center p-4 rounded-2xl"
                style={{ backgroundColor: `${config.theme_color}10`, borderColor: `${config.theme_color}25` }}
              >
                <span className="text-xs font-black text-slate-600">概算見積金額</span>
                <span className="text-xl font-black" style={{ color: config.theme_color }}>
                  ¥{calculateTotal().toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-4 my-auto">
              <div className="w-16 h-16 bg-pink-100 text-pink-500 rounded-full flex items-center justify-center text-3xl shadow-inner animate-bounce">
                💌
              </div>
              <h3 className="text-lg font-black text-slate-800">送信が完了しました！</h3>
              <div className="text-xs font-bold text-slate-600 bg-amber-50/60 border-2 border-amber-200/60 p-4 rounded-2xl whitespace-pre-wrap w-full text-left leading-relaxed">
                {config.thanks_message}
              </div>
            </div>
          )}
        </div>
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
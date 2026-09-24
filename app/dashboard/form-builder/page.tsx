'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ItemDiscountConfig, Campaign, resolveDiscount, applyDiscount, formatSavingsBadge } from '@/lib/discount'
import { backgroundImageStyle } from '@/lib/background'

type Option = {
  label: string
  price: number
  priceType?: 'fixed' | 'percent'
  discount?: ItemDiscountConfig
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
  discount?: ItemDiscountConfig
}

type FormConfig = {
  title: string
  description: string
  theme_color: string
  is_accepting: boolean
  fields: Field[]
}

type EstimateFormRow = FormConfig & {
  id: string
  sort_order: number
}

const EMPTY_CONFIG: FormConfig = {
  title: 'ご依頼・お仕事申請フォーム',
  description: '注意事項などを入力してください',
  theme_color: '#ec4899',
  is_accepting: true,
  fields: [],
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

// フィールド・選択肢ごとの割引の個別指定コンポーネント（キャンペーンの一律割引を上書き）
// 普段は「自動（キャンペーンに従う）」のままで済むことがほとんどなので、
// 個別指定されていない限りリンククリックで展開するまで畳んでおく
function DiscountConfigEditor({
  discount,
  onChange,
}: {
  discount: ItemDiscountConfig
  onChange: (discount: ItemDiscountConfig) => void
}) {
  const [expanded, setExpanded] = useState(false)

  if (discount.mode === 'inherit' && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-600 cursor-pointer"
      >
        この項目だけ割引を変える
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] font-bold text-slate-400 shrink-0">割引:</span>
      <select
        value={discount.mode}
        onChange={(e) => onChange({ ...discount, mode: e.target.value as ItemDiscountConfig['mode'] })}
        className="px-1.5 py-1 rounded-lg border border-slate-200 text-[10px] bg-white"
      >
        <option value="inherit">自動（キャンペーンに従う）</option>
        <option value="custom">個別に指定</option>
        <option value="exempt">対象外にする</option>
      </select>
      {discount.mode === 'custom' && (
        <>
          <select
            value={discount.type || 'percent'}
            onChange={(e) => onChange({ ...discount, type: e.target.value as 'percent' | 'fixed' })}
            className="px-1.5 py-1 rounded-lg border border-slate-200 text-[10px] bg-white"
          >
            <option value="percent">％OFF</option>
            <option value="fixed">円引き</option>
          </select>
          <input
            type="number"
            min={0}
            value={discount.value ?? ''}
            onChange={(e) => onChange({ ...discount, value: Number(e.target.value) || 0 })}
            className="w-16 px-1.5 py-1 rounded-lg border border-slate-200 text-[10px] font-bold"
          />
        </>
      )}
      {discount.mode === 'inherit' && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-[10px] font-bold text-slate-300 hover:text-slate-500 cursor-pointer"
        >
          閉じる
        </button>
      )}
    </div>
  )
}

export default function FormBuilderPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [showTmplModal, setShowTmplModal] = useState(false)

  const [forms, setForms] = useState<EstimateFormRow[]>([])
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  // 編集中フォームの内容
  const [config, setConfig] = useState<FormConfig>(EMPTY_CONFIG)

  // プレビュー用の仮回答（保存はされない、見た目確認だけの状態）
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({})

  // キャンペーン割引（ダッシュボードの「料金・受託条件」タブで設定したもの）をプレビューに反映
  const [campaign, setCampaign] = useState<Campaign>({ enabled: false })

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)

      const { data: campaignProfile } = await supabase
        .from('profiles')
        .select('campaign_enabled, campaign_discount_type, campaign_discount_value, campaign_start_at, campaign_end_at')
        .eq('user_id', user.id)
        .maybeSingle()
      if (campaignProfile) {
        setCampaign({
          enabled: campaignProfile.campaign_enabled,
          discountType: campaignProfile.campaign_discount_type,
          discountValue: campaignProfile.campaign_discount_value,
          startAt: campaignProfile.campaign_start_at,
          endAt: campaignProfile.campaign_end_at,
        })
      }

      await refreshForms(user.id)
      setLoading(false)
    }

    loadUserData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // フォーム一覧の取得。1件も無く、旧フォーム(profiles.form_config)が残っている場合は
  // 最初の1件として自動的に引き継ぐ（既存クリエイターのフォームを消さないため）
  const refreshForms = async (uid: string) => {
    const { data, error } = await supabase
      .from('estimate_forms')
      .select('*')
      .eq('user_id', uid)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('見積もりフォーム一覧の取得エラー:', error)
      setForms([])
      return
    }

    if (data && data.length > 0) {
      setForms(data as EstimateFormRow[])
      return
    }

    // estimate_forms が空の場合、旧形式のフォームがあれば1件だけ引き継ぐ
    const { data: profile } = await supabase
      .from('profiles')
      .select('form_config')
      .eq('user_id', uid)
      .maybeSingle()

    const legacyConfig = profile?.form_config as FormConfig | null | undefined
    if (legacyConfig && Array.isArray(legacyConfig.fields) && legacyConfig.fields.length > 0) {
      const { data: migrated, error: insertError } = await supabase
        .from('estimate_forms')
        .insert({
          user_id: uid,
          title: legacyConfig.title || EMPTY_CONFIG.title,
          description: legacyConfig.description || '',
          theme_color: legacyConfig.theme_color || EMPTY_CONFIG.theme_color,
          is_accepting: legacyConfig.is_accepting ?? true,
          fields: legacyConfig.fields,
          sort_order: 0,
        })
        .select()
        .single()

      if (!insertError && migrated) {
        setForms([migrated as EstimateFormRow])
        return
      }
    }

    setForms([])
  }

  // 離脱防止アラート（編集画面でのみ有効）
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && editingId) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty, editingId])

  const confirmDiscardIfDirty = () => {
    if (!isDirty) return true
    return window.confirm(
      'まだ保存されていない変更があります。保存せずに移動すると変更内容は失われます。よろしいですか？'
    )
  }

  const openNewForm = () => {
    setConfig({ ...EMPTY_CONFIG, fields: [] })
    setPreviewAnswers({})
    setEditingId('new')
    setIsDirty(false)
  }

  const openEditForm = (form: EstimateFormRow) => {
    const { id, sort_order, ...rest } = form
    setConfig(JSON.parse(JSON.stringify(rest)))
    setPreviewAnswers({})
    setEditingId(id)
    setIsDirty(false)
  }

  const backToList = () => {
    if (!confirmDiscardIfDirty()) return
    setEditingId(null)
    setIsDirty(false)
  }

  const handleDuplicate = async (form: EstimateFormRow) => {
    if (!userId) return
    const { id, sort_order, ...rest } = form
    const { data, error } = await supabase
      .from('estimate_forms')
      .insert({
        ...rest,
        title: `${rest.title}（コピー）`,
        user_id: userId,
        sort_order: forms.length,
      })
      .select()
      .single()

    if (error) {
      console.error('フォーム複製エラー:', error)
      alert('フォームの複製に失敗しました。通信環境をご確認のうえ、もう一度お試しください。')
      return
    }
    if (data) {
      setForms((prev) => [...prev, data as EstimateFormRow])
    }
  }

  const handleDelete = async (form: EstimateFormRow) => {
    if (!confirm(`「${form.title}」を削除します。この操作は取り消せません。よろしいですか？`)) return
    setDeletingId(form.id)
    const { error } = await supabase.from('estimate_forms').delete().eq('id', form.id)
    setDeletingId(null)

    if (error) {
      console.error('フォーム削除エラー:', error)
      alert('削除に失敗しました。通信環境をご確認のうえ、もう一度お試しください。')
      return
    }
    setForms((prev) => prev.filter((f) => f.id !== form.id))
  }

  // アクションハンドラー（編集中フォームの内容操作）
  const updateConfig = (key: keyof FormConfig, val: any) => {
    setConfig((prev) => ({ ...prev, [key]: val }))
    setIsDirty(true)
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
    setIsDirty(true)
  }

  const removeField = (idx: number) => {
    setConfig((prev) => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== idx),
    }))
    setIsDirty(true)
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
    setIsDirty(true)
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
    setIsDirty(true)
  }

  const addOption = (fIdx: number) => {
    setConfig((prev) => {
      const fields = [...prev.fields]
      const opts = fields[fIdx].options || []
      fields[fIdx].options = [...opts, { label: '新しい選択肢', price: 0, priceType: 'fixed' }]
      return { ...prev, fields }
    })
    setIsDirty(true)
  }

  const removeOption = (fIdx: number, oIdx: number) => {
    setConfig((prev) => {
      const fields = [...prev.fields]
      fields[fIdx].options = fields[fIdx].options?.filter((_, i) => i !== oIdx)
      return { ...prev, fields }
    })
    setIsDirty(true)
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
    setIsDirty(true)
  }

  const applyTemplate = (type: string) => {
    if (confirm('現在の入力内容がテンプレートで置き換わります。よろしいですか？')) {
      const tmpl = FORM_TEMPLATES[type]
      if (tmpl) {
        setConfig(JSON.parse(JSON.stringify(tmpl)))
        setPreviewAnswers({})
        setIsDirty(true)
        setShowTmplModal(false)
      }
    }
  }

  const handleSave = async () => {
    if (!userId || !editingId) return
    setSaving(true)

    if (editingId === 'new') {
      const { data, error } = await supabase
        .from('estimate_forms')
        .insert({ ...config, user_id: userId, sort_order: forms.length })
        .select()
        .single()

      setSaving(false)
      if (error) {
        console.error('見積もりフォーム作成エラー:', error)
        alert('保存に失敗しました。通信環境をご確認のうえ、もう一度お試しください。入力した内容はこの画面には残っていますので、もう一度保存ボタンを押してみてください。')
        return
      }
      if (data) {
        const row = data as EstimateFormRow
        setForms((prev) => [...prev, row])
        setEditingId(row.id)
        setIsDirty(false)
        alert('✨ 見積もりフォームを作成しました！')
      }
      return
    }

    const { error } = await supabase
      .from('estimate_forms')
      .update({ ...config, updated_at: new Date().toISOString() })
      .eq('id', editingId)

    setSaving(false)
    if (error) {
      console.error('見積もりフォーム更新エラー:', error)
      alert('保存に失敗しました。通信環境をご確認のうえ、もう一度お試しください。入力した内容はこの画面には残っていますので、もう一度保存ボタンを押してみてください。')
    } else {
      setForms((prev) => prev.map((f) => (f.id === editingId ? { ...f, ...config } : f)))
      setIsDirty(false)
      alert('✨ 見積もりフォームを更新・データベースへ保存しました！')
    }
  }

  // プレビューの概算合計金額（保存中の内容をその場で試算するだけで、実データには影響しない）
  const { previewTotal, previewOriginalTotal } = useMemo(() => {
    let baseSum = 0
    let baseSumOriginal = 0
    config.fields.forEach((field) => {
      if (field.price && field.type !== 'note' && field.type !== 'faq') {
        const discount = resolveDiscount(campaign, field.discount)
        baseSum += applyDiscount(field.price, discount)
        baseSumOriginal += field.price
      }
    })

    let fixedAdditions = 0
    let fixedAdditionsOriginal = 0
    let percentAdditions = 0
    let percentAdditionsOriginal = 0
    config.fields.forEach((field) => {
      const answer = previewAnswers[field.id]
      if (!answer || !field.options) return
      const addOption = (opt: Option) => {
        const discount = resolveDiscount(campaign, opt.discount)
        const effectivePrice = applyDiscount(opt.price, discount)
        if (opt.priceType === 'percent') {
          percentAdditions += effectivePrice
          percentAdditionsOriginal += opt.price
        } else {
          fixedAdditions += effectivePrice
          fixedAdditionsOriginal += opt.price
        }
      }
      if (field.type === 'radio') {
        const opt = field.options.find((o) => o.label === answer)
        if (opt) addOption(opt)
      } else if (field.type === 'checkbox' && Array.isArray(answer)) {
        answer.forEach((label: string) => {
          const opt = field.options?.find((o) => o.label === label)
          if (opt) addOption(opt)
        })
      }
    })

    return {
      previewTotal: baseSum + fixedAdditions + Math.round(baseSum * (percentAdditions / 100)),
      previewOriginalTotal:
        baseSumOriginal + fixedAdditionsOriginal + Math.round(baseSumOriginal * (percentAdditionsOriginal / 100)),
    }
  }, [config, previewAnswers, campaign])

  const handlePreviewSelect = (fieldId: string, value: any, isCheckbox = false) => {
    setPreviewAnswers((prev) => {
      if (isCheckbox) {
        const current: string[] = prev[fieldId] || []
        const next = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value]
        return { ...prev, [fieldId]: next }
      }
      return { ...prev, [fieldId]: value }
    })
  }

  if (loading) {
    return <div className="p-8 text-center text-xs font-bold text-slate-400">読み込み中...</div>
  }

  return (
    <div className="min-h-screen relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      {/* ヘッダー */}
      <header className="px-4 sm:px-6 py-3.5 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {editingId ? (
              <button
                type="button"
                onClick={backToList}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <span>←</span> フォーム一覧に戻る
              </button>
            ) : (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors shrink-0"
              >
                <span>←</span> ダッシュボードに戻る
              </Link>
            )}
            {editingId && isDirty && (
              <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-md text-[10px] font-extrabold animate-pulse shrink-0">
                ⚠️ 未保存の変更あり
              </span>
            )}
          </div>

          {editingId && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 shrink-0"
            >
              {saving ? '保存中...' : '🚀 保存する'}
            </button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {!editingId ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="font-black text-slate-800 text-lg drop-shadow-sm">見積もりフォーム一覧</h1>
                <p className="text-xs text-slate-600 font-medium drop-shadow-sm mt-1">
                  用途ごとに複数の見積もりフォームを作成できます（例: アイコン用・立ち絵用など）。依頼者はプロフィールページからフォームを選んで見積もりを作成します。
                </p>
              </div>
              <button
                onClick={openNewForm}
                className="px-4 py-2.5 bg-pink-500 hover:bg-pink-600 text-white font-black text-xs rounded-full shadow-xs cursor-pointer shrink-0"
              >
                + 新しいフォームを作成
              </button>
            </div>

            {forms.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 border-2 border-dashed border-slate-200 text-center space-y-3">
                <p className="text-sm font-bold text-slate-500">まだ見積もりフォームがありません</p>
                <p className="text-xs text-slate-400">「+ 新しいフォームを作成」から、依頼者向けの見積もりシミュレーターを作ってみましょう</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {forms.map((form) => (
                  <div key={form.id} className="bg-white rounded-3xl p-5 border-2 border-slate-100 shadow-xs space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="font-black text-slate-800 text-sm truncate">{form.title}</h2>
                        <p className="text-[11px] text-slate-400 mt-0.5">{form.fields.length}個の設問</p>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-extrabold px-2 py-1 rounded-lg ${
                          form.is_accepting ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {form.is_accepting ? '受付中' : '停止中'}
                      </span>
                    </div>

                    {form.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 whitespace-pre-wrap">{form.description}</p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => openEditForm(form)}
                        className="flex-1 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                      >
                        編集する
                      </button>
                      <button
                        onClick={() => handleDuplicate(form)}
                        title="複製する"
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition cursor-pointer"
                      >
                        複製
                      </button>
                      <button
                        onClick={() => handleDelete(form)}
                        disabled={deletingId === form.id}
                        title="削除する"
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-500 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
                      >
                        {deletingId === form.id ? '削除中...' : '削除'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
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
                    このフォームのボタンやアクセントカラーに反映されます
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-slate-700 block">受付ステータス</span>
                    <span className="text-[10px] font-bold text-slate-400">「停止」にすると公開ページでこのフォームを選べなくなります</span>
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
                  placeholder="フォームタイトル（例: アイコン制作依頼フォーム）"
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

                {config.fields.length === 0 && (
                  <div className="bg-white rounded-2xl p-6 border-2 border-dashed border-slate-200 text-center text-xs font-bold text-slate-400">
                    まだ設問がありません。「+ 項目追加」またはテンプレートから始めましょう
                  </div>
                )}

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
                      <div className="space-y-1.5">
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
                        <DiscountConfigEditor
                          discount={f.discount || { mode: 'inherit' }}
                          onChange={(discount) => updateField(idx, 'discount', discount)}
                        />
                      </div>
                    )}

                    {(f.type === 'radio' || f.type === 'checkbox') && (
                      <div className="pl-2 space-y-2 pt-2 border-t border-slate-100">
                        <label className="text-[10px] font-bold text-slate-400 block">選択肢と追加金額 (固定額 または %指定)</label>
                        {f.options?.map((opt, oIdx) => (
                          <div key={oIdx} className="space-y-1 p-1.5 rounded-lg bg-slate-50/60">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={opt.label}
                                onChange={(e) => updateOption(idx, oIdx, 'label', e.target.value)}
                                className="w-full px-3 py-1 text-xs border rounded-lg bg-white"
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
                                className="w-20 px-2 py-1 text-xs border rounded-lg bg-white"
                              />
                              <span className="text-xs font-bold text-slate-400 w-4">{opt.priceType === 'percent' ? '%' : '円'}</span>
                              <button onClick={() => removeOption(idx, oIdx)} className="text-xs text-red-400 px-1 cursor-pointer">✕</button>
                            </div>
                            <DiscountConfigEditor
                              discount={opt.discount || { mode: 'inherit' }}
                              onChange={(discount) => updateOption(idx, oIdx, 'discount', discount)}
                            />
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

            {/* プレビューエリア（依頼者からどう見えるかをその場で確認できる） */}
            <div className="lg:sticky lg:top-20 space-y-3">
              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-xs font-black uppercase tracking-wider">依頼者からの見え方プレビュー</span>
              </div>
              <div className="bg-slate-100 rounded-3xl p-4 sm:p-5">
                <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
                  <div
                    className="p-5 border-b border-slate-100"
                    style={{ background: `linear-gradient(135deg, ${config.theme_color}1f 0%, #ffffff00 100%)` }}
                  >
                    <h3 className="text-base font-black text-slate-900">{config.title || 'フォームタイトル未設定'}</h3>
                    {config.description && (
                      <p className="text-xs font-medium text-slate-500 whitespace-pre-wrap mt-1">{config.description}</p>
                    )}
                  </div>

                  <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
                    {config.fields.length === 0 ? (
                      <p className="text-xs font-bold text-slate-300 text-center py-8">設問を追加するとここにプレビューが表示されます</p>
                    ) : (
                      config.fields.map((field) => {
                        if (field.type === 'note') {
                          return (
                            <div key={field.id} className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1">
                              <span className="font-extrabold block">⚠️ {field.label}</span>
                              <p className="whitespace-pre-wrap font-medium opacity-90">{field.noteText}</p>
                            </div>
                          )
                        }
                        if (field.type === 'faq') {
                          return (
                            <div key={field.id} className="bg-sky-50/80 border border-sky-200 rounded-2xl p-4 text-xs text-sky-900 space-y-1">
                              <span className="font-extrabold block">💡 Q. {field.label}</span>
                              <p className="whitespace-pre-wrap font-medium opacity-90">A. {field.faqAnswer}</p>
                            </div>
                          )
                        }

                        return (
                          <div key={field.id} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-800">{field.label}</span>
                              {field.required && (
                                <span className="text-[10px] bg-rose-100 text-rose-600 font-extrabold px-1.5 py-0.5 rounded">必須</span>
                              )}
                              {!!field.price && (
                                <span className="text-[10px] font-black" style={{ color: config.theme_color }}>
                                  +¥{field.price.toLocaleString()}
                                </span>
                              )}
                            </div>

                            {field.type === 'radio' && field.options && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {field.options.map((opt, i) => {
                                  const isSelected = previewAnswers[field.id] === opt.label
                                  return (
                                    <label
                                      key={i}
                                      onClick={() => handlePreviewSelect(field.id, opt.label)}
                                      className="flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition"
                                      style={
                                        isSelected
                                          ? { backgroundColor: config.theme_color, borderColor: config.theme_color, color: '#fff' }
                                          : { borderColor: '#e2e8f0', color: '#334155' }
                                      }
                                    >
                                      <span>{opt.label}</span>
                                      <span className="text-[11px] opacity-80">
                                        {opt.priceType === 'percent' ? `+${opt.price}%` : opt.price > 0 ? `+¥${opt.price.toLocaleString()}` : '標準'}
                                      </span>
                                    </label>
                                  )
                                })}
                              </div>
                            )}

                            {field.type === 'checkbox' && field.options && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {field.options.map((opt, i) => {
                                  const current: string[] = previewAnswers[field.id] || []
                                  const isSelected = current.includes(opt.label)
                                  return (
                                    <label
                                      key={i}
                                      onClick={() => handlePreviewSelect(field.id, opt.label, true)}
                                      className="flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition"
                                      style={
                                        isSelected
                                          ? { backgroundColor: config.theme_color, borderColor: config.theme_color, color: '#fff' }
                                          : { borderColor: '#e2e8f0', color: '#334155' }
                                      }
                                    >
                                      <span>{opt.label}</span>
                                      <span className="text-[11px] opacity-80">
                                        {opt.priceType === 'percent' ? `+${opt.price}%` : `+¥${opt.price.toLocaleString()}`}
                                      </span>
                                    </label>
                                  )
                                })}
                              </div>
                            )}

                            {field.type === 'text' && (
                              <input
                                type="text"
                                disabled
                                placeholder="依頼者が自由入力します"
                                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-400"
                              />
                            )}

                            {field.type === 'textarea' && (
                              <textarea
                                disabled
                                rows={2}
                                placeholder="依頼者が自由入力します"
                                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-400"
                              />
                            )}

                            {field.type === 'color' && (
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-100" />
                                <span className="text-[11px] text-slate-400 font-bold">依頼者がカラーピッカーで指定します</span>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>

                  {config.fields.length > 0 && (
                    <div className="p-5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">概算合計金額（試算）</span>
                      {previewOriginalTotal > previewTotal ? (
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          <span className="text-xs text-slate-300 line-through decoration-rose-400">
                            ¥{previewOriginalTotal.toLocaleString()}
                          </span>
                          <span className="text-lg font-black" style={{ color: config.theme_color }}>
                            ¥{previewTotal.toLocaleString()}
                          </span>
                          <span className="text-[9px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded">
                            {formatSavingsBadge(previewOriginalTotal, previewTotal)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-lg font-black" style={{ color: config.theme_color }}>
                          ¥{previewTotal.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-bold text-center pt-3">
                  ↑ 選択肢をクリックすると、実際の見積もり画面と同じように金額が変わる様子を確認できます（保存はされません）
                </p>
              </div>
            </div>
          </div>
        )}
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

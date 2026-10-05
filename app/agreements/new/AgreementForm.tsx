'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ContactInput from '@/components/ContactInput'
import AgreementDocument from '@/components/AgreementDocument'
import { supabase } from '@/lib/supabase'
import {
  AGREEMENT_PRESETS,
  Agreement,
  AgreementDraft,
  AgreementTerms,
  EMPTY_AGREEMENT,
  PAYMENT_PLANS,
  PRICE_ITEM_PRESETS,
  TAX_LABELS,
  TERM_PRESETS,
  TaxMode,
  agreementTotal,
  applyTemplate,
  contactFromSnsLinks,
  pickTemplate,
  priceSubtotal,
  toDraft,
  yen,
} from '@/lib/agreements'

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400'
const smallInput =
  'px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400'

type Mode = { kind: 'new'; requestId: string | null } | { kind: 'revision'; parentId: string } | { kind: 'edit'; id: string }

// 控えを作る・直す画面（クリエイター用）
//   /agreements/new                … 新しく作る
//   /agreements/new?request=<id>   … 直接リクエストの内容を引き継いで作る（依頼者に通知が届く）
//   /agreements/new?from=<id>      … 同意済みの控えの変更版を作る
//   /agreements/new?edit=<id>      … 同意待ちの控えを直す
//   /agreements/new?copy=<id>      … 見直しを頼まれた控えの内容をもとに作り直す
// 入力した内容は、下の「できあがる合意書」で条文の形になる（components/AgreementDocument.tsx）。
export default function AgreementForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode | null>(null)
  const [draft, setDraft] = useState<AgreementDraft>(EMPTY_AGREEMENT)
  const [userId, setUserId] = useState<string | null>(null)
  const [creatorName, setCreatorName] = useState('クリエイター')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [fixedClientName, setFixedClientName] = useState<string | null>(null)
  // クリエイターの連絡先（必須。控えに固定される）
  const [contact, setContact] = useState('')
  // いつもの内容（テンプレート）
  const [hasTemplate, setHasTemplate] = useState(false)
  const [templateMessage, setTemplateMessage] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id
      if (!uid) {
        router.replace('/login')
        return
      }
      setUserId(uid)
      const params = new URLSearchParams(window.location.search)
      const requestId = params.get('request')
      const fromId = params.get('from')
      const editId = params.get('edit')
      const copyId = params.get('copy')

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, free_revision_count, commercial_use_allowed, sns_links')
        .eq('user_id', uid)
        .maybeSingle()
      setContact(contactFromSnsLinks(profile?.sns_links))
      setCreatorName(profile?.display_name || 'クリエイター')

      // いつもの内容が保存されていれば、それを最初から入れる（無ければプロフィールの修正回数）
      const { data: templateRow } = await supabase.from('agreement_templates').select('template').eq('user_id', uid).maybeSingle()
      setHasTemplate(!!templateRow)
      const base: AgreementDraft = applyTemplate(
        {
          ...EMPTY_AGREEMENT,
          revisions: profile?.free_revision_count != null ? `${profile.free_revision_count}回まで無料で修正` : '',
        },
        templateRow?.template
      )

      const loadClientName = async (clientId: string | null) => {
        if (!clientId) return
        const { data: p } = await supabase.from('profiles').select('display_name').eq('user_id', clientId).maybeSingle()
        setFixedClientName(p?.display_name || '依頼者')
      }

      if (editId || fromId || copyId) {
        const id = (editId || fromId || copyId)!
        const { data: rows } = await supabase.rpc('get_agreement', { p_id: id })
        const row = (rows as Agreement[] | null)?.[0]
        if (!row || row.creator_id !== uid) {
          setErrorMsg('控えが見つかりませんでした')
          setLoading(false)
          return
        }
        if (editId && row.status !== 'pending') {
          setErrorMsg('同意済み・終了した控えは直せません。変更版を作ってください。')
          setLoading(false)
          return
        }
        setDraft(toDraft(row))
        if (row.creator_contact) setContact(row.creator_contact)
        // copy … 見直しを頼まれた・取り下げた控えの内容をもとに、新しく作り直す（同じリクエストの依頼者あて）
        setMode(editId ? { kind: 'edit', id } : copyId ? { kind: 'new', requestId: row.request_id } : { kind: 'revision', parentId: id })
        await loadClientName(row.client_id)
      } else if (requestId) {
        const { data: req } = await supabase
          .from('requests')
          .select('id, client_id, creator_id, content, budget, desired_deadline, usage_type, size_spec')
          .eq('id', requestId)
          .maybeSingle()
        if (!req || req.creator_id !== uid) {
          setErrorMsg('リクエストが見つかりませんでした')
          setLoading(false)
          return
        }
        const firstLine = (req.content || '').split('\n')[0].trim()
        setDraft({
          ...base,
          title: firstLine.length > 30 ? `${firstLine.slice(0, 30)}…` : firstLine || 'イラスト制作のご依頼',
          description: req.content || '',
          price_items: req.budget != null ? [{ label: '基本料金', amount: Math.round(Number(req.budget)), quantity: 1 }] : [],
          deadline: req.desired_deadline,
          commercial_use: /商用/.test(req.usage_type || ''),
          usage_scope: req.usage_type || '',
          terms: { ...base.terms, size_spec: req.size_spec || base.terms.size_spec },
        })
        setMode({ kind: 'new', requestId })
        await loadClientName(req.client_id)
      } else {
        setDraft({ ...base, price_items: [{ label: '基本料金', amount: 0, quantity: 1 }] })
        setMode({ kind: 'new', requestId: null })
      }
      setLoading(false)
    }
    init()
  }, [router])

  const update = <K extends keyof AgreementDraft>(key: K, value: AgreementDraft[K]) => setDraft((prev) => ({ ...prev, [key]: value }))
  const updateTerm = <K extends keyof AgreementTerms>(key: K, value: AgreementTerms[K]) =>
    setDraft((prev) => ({ ...prev, terms: { ...prev.terms, [key]: value } }))

  // 「よくある書き方」を押したら、入力欄の最後に1行足す
  const appendLine = (current: string, text: string) => (current.includes(text) ? current : current.trim() ? `${current.trim()}\n${text}` : text)

  // ---- 料金の内訳 ----
  const total = agreementTotal(draft)
  const setItem = (index: number, patch: Partial<AgreementDraft['price_items'][number]>) =>
    update(
      'price_items',
      draft.price_items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    )
  const addItem = (label = '') => update('price_items', [...draft.price_items, { label, amount: 0, quantity: 1 }])
  const removeItem = (index: number) => update('price_items', draft.price_items.filter((_, i) => i !== index))

  // ---- 支払いの予定 ----
  const scheduleSum = draft.payment_schedule.reduce((sum, p) => sum + (p.amount || 0), 0)
  const applyPlan = (planIndex: number) => {
    const plan = PAYMENT_PLANS[planIndex]
    let remaining = total ?? 0
    const steps = plan.steps.map((step, i) => {
      const amount = total === null ? null : i === plan.steps.length - 1 ? remaining : Math.floor(total * step.ratio)
      if (amount !== null) remaining -= amount
      return { label: step.label, amount, timing: step.timing }
    })
    update('payment_schedule', steps)
  }
  const setStep = (index: number, patch: Partial<AgreementDraft['payment_schedule'][number]>) =>
    update(
      'payment_schedule',
      draft.payment_schedule.map((p, i) => (i === index ? { ...p, ...patch } : p))
    )

  // ---- いつもの内容 ----
  const saveTemplate = async () => {
    if (!userId) return
    const { error } = await supabase
      .from('agreement_templates')
      .upsert({ user_id: userId, template: pickTemplate(draft), updated_at: new Date().toISOString() })
    if (error) {
      console.error('いつもの内容の保存エラー:', error)
      setTemplateMessage('保存できませんでした。supabase/add_agreement_extras.sql を実行済みか確認してください。')
      return
    }
    setHasTemplate(true)
    setTemplateMessage('✓ いつもの内容として保存しました。次からは最初から入った状態で作れます。')
  }

  const loadTemplate = async () => {
    if (!userId) return
    const { data } = await supabase.from('agreement_templates').select('template').eq('user_id', userId).maybeSingle()
    if (!data) return
    setDraft((prev) => applyTemplate(prev, data.template))
    setTemplateMessage('✓ いつもの内容を入れました')
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !mode) return
    if (!draft.title.trim()) return setErrorMsg('タイトルを入力してください')
    if (contact.trim().replace(/^[^:]+:\s*/, '').length < 2) return setErrorMsg('あなたの連絡先（X・Bluesky・DiscordなどのID）を入力してください')
    const items = draft.price_items
      .map((item) => ({ label: item.label.trim() || '料金', amount: Math.max(0, Math.round(Number(item.amount) || 0)), quantity: Math.max(1, Math.round(Number(item.quantity) || 1)) }))
      .filter((item) => item.amount > 0)
    setSaving(true)
    setErrorMsg('')
    const payload = {
      ...draft,
      title: draft.title.trim(),
      creator_contact: contact.trim(),
      price_items: items,
      discount: Math.max(0, Math.round(draft.discount || 0)),
      price: items.length > 0 ? Math.max(0, priceSubtotal(items) - (draft.discount || 0)) : draft.price,
      payment_schedule: draft.payment_schedule.filter((p) => p.label.trim()),
    }
    const result =
      mode.kind === 'edit'
        ? await supabase.from('agreements').update(payload).eq('id', mode.id).select('id').single()
        : await supabase
            .from('agreements')
            .insert({
              ...payload,
              creator_id: userId,
              request_id: mode.kind === 'new' ? mode.requestId : null,
              parent_id: mode.kind === 'revision' ? mode.parentId : null,
            })
            .select('id')
            .single()
    setSaving(false)
    if (result.error || !result.data) {
      console.error('控えの保存エラー:', result.error)
      setErrorMsg(
        result.error?.code === 'P0001' && result.error.message
          ? result.error.message
          : `保存できませんでした（${result.error?.message || '通信エラー'}）。supabase/add_agreement_details.sql までのSQLを実行済みか確認してください。`
      )
      return
    }
    router.push(`/agreements/${result.data.id}?created=1`)
  }

  // ---- 部品 ----
  const chips = (presets: readonly string[], onPick: (text: string) => void) => (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {presets.map((text) => (
        <button
          key={text}
          type="button"
          onClick={() => onPick(text)}
          className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100 cursor-pointer"
        >
          ＋ {text}
        </button>
      ))}
    </div>
  )

  const draftText = (key: keyof typeof AGREEMENT_PRESETS, rows = 2, max = 1000, placeholder = '') => (
    <>
      <textarea rows={rows} maxLength={max} value={String(draft[key] || '')} onChange={(e) => update(key, e.target.value)} placeholder={placeholder} className={`${inputClass} resize-y`} />
      {chips(AGREEMENT_PRESETS[key], (text) => update(key, appendLine(String(draft[key] || ''), text)))}
    </>
  )

  const termText = (key: keyof typeof TERM_PRESETS, rows = 2, placeholder = '') => (
    <>
      <textarea
        rows={rows}
        maxLength={1000}
        value={draft.terms[key]}
        onChange={(e) => updateTerm(key, e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} resize-y`}
      />
      {chips(TERM_PRESETS[key], (text) => updateTerm(key, appendLine(draft.terms[key], text)))}
    </>
  )

  const field = (label: string, hint: string, children: React.ReactNode) => (
    <div>
      <label className="block text-xs font-black text-slate-700">{label}</label>
      {hint && <p className="text-[11px] text-slate-400 mb-1.5">{hint}</p>}
      {!hint && <div className="h-1.5" />}
      {children}
    </div>
  )

  const section = (no: number, title: string, children: React.ReactNode) => (
    <section className="rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
      <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-sky-500 text-white text-[11px] flex items-center justify-center">{no}</span>
        {title}
      </h2>
      {children}
    </section>
  )

  const radios = <T extends string>(value: T, options: { value: T; label: string }[], onChange: (v: T) => void) => (
    <div className="grid gap-1.5">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`flex items-start gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
            value === opt.value ? 'border-sky-400 bg-sky-50 text-sky-900' : 'border-slate-200 text-slate-600'
          }`}
        >
          <input type="radio" checked={value === opt.value} onChange={() => onChange(opt.value)} className="mt-0.5 accent-sky-500" />
          {opt.label}
        </label>
      ))}
    </div>
  )

  const check = (checked: boolean, label: string, onChange: (v: boolean) => void) => (
    <label className="flex items-start gap-2 text-xs font-bold text-slate-700 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 mt-0.5 accent-sky-500" />
      {label}
    </label>
  )

  if (loading) return <p className="text-center text-xs font-bold text-slate-500 py-10">読み込み中...</p>

  if (!mode) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center space-y-3">
        <p className="text-sm font-bold text-slate-700">{errorMsg}</p>
        <Link href="/agreements" className="text-xs font-bold text-sky-600 underline">
          控えの一覧へ
        </Link>
      </div>
    )
  }

  const heading = mode.kind === 'edit' ? '控えを直す' : mode.kind === 'revision' ? '変更版を作る' : '合意内容の控えを作る'

  return (
    <form onSubmit={save} className="bg-white rounded-3xl p-4 sm:p-7 shadow-sm border border-sky-100/60 space-y-5">
      <div>
        <h1 className="text-lg font-black text-slate-900">{heading}</h1>
        <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
          依頼者と相談して決まった内容を書きます。入力した内容は、最後に「合意書」の文章にまとまります。保存すると専用のリンクが発行されるので、依頼者に送って「同意する」を押してもらいましょう。
          {mode.kind === 'revision' && ' 変更版に同意してもらうと、前の控えは「古い版」として残ります。'}
          <Link href="/guide/agreements" target="_blank" className="ml-1 font-bold text-sky-600 underline">
            使い方
          </Link>
        </p>
        {fixedClientName && (
          <p className="mt-2 text-[11px] font-bold text-sky-700 bg-sky-50 rounded-xl px-3 py-2">依頼者：{fixedClientName} さん（保存すると通知が届きます）</p>
        )}
      </div>

      {errorMsg && <p className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-bold">{errorMsg}</p>}

      {section(
        1,
        '制作の内容',
        <>
          {field(
            'あなたの連絡先（必須）',
            'X・Bluesky・Discordなど、依頼者と連絡を取っているアカウント。控えに記録され、同意後は変えられません',
            <ContactInput value={contact} onChange={setContact} required />
          )}
          {field(
            'タイトル（必須）',
            '',
            <input value={draft.title} maxLength={100} onChange={(e) => update('title', e.target.value)} placeholder="例：VTuber立ち絵（全身・表情差分3つ）" className={inputClass} />
          )}
          {field(
            '依頼内容',
            '描くもの・キャラクター・ポーズ・雰囲気など',
            <textarea rows={4} maxLength={3000} value={draft.description} onChange={(e) => update('description', e.target.value)} className={`${inputClass} resize-y`} />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {field(
              '枚数・内容',
              '',
              <input
                value={draft.terms.quantity_spec}
                maxLength={300}
                onChange={(e) => updateTerm('quantity_spec', e.target.value)}
                placeholder="例：全身1枚・表情差分3つ"
                className={inputClass}
              />
            )}
            {field(
              'サイズ・仕様',
              '',
              <>
                <input value={draft.terms.size_spec} maxLength={300} onChange={(e) => updateTerm('size_spec', e.target.value)} placeholder="例：長辺3000px・350dpi" className={inputClass} />
                {chips(TERM_PRESETS.size_spec, (text) => updateTerm('size_spec', text))}
              </>
            )}
          </div>
        </>
      )}

      {section(
        2,
        '料金',
        <>
          <div className="space-y-2">
            <p className="text-xs font-black text-slate-700">料金の内訳</p>
            {draft.price_items.map((item, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-50 p-2">
                <input value={item.label} maxLength={60} onChange={(e) => setItem(i, { label: e.target.value })} placeholder="項目（例：基本料金）" className={`${smallInput} w-full sm:w-auto sm:flex-1`} />
                <div className="flex items-center gap-1 flex-1 sm:flex-none">
                  <span className="text-xs text-slate-400">¥</span>
                  <input
                    type="number"
                    min={0}
                    value={item.amount || ''}
                    onChange={(e) => setItem(i, { amount: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                    placeholder="0"
                    className={`${smallInput} w-24`}
                  />
                  <span className="text-xs text-slate-400">×</span>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => setItem(i, { quantity: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                    className={`${smallInput} w-14`}
                    aria-label="数量"
                  />
                  <span className="ml-auto text-xs font-black text-slate-700 tabular-nums w-20 text-right">{yen(item.amount * item.quantity)}</span>
                  <button type="button" onClick={() => removeItem(i)} className="text-xs font-bold text-rose-400 hover:text-rose-600 px-1 cursor-pointer" aria-label="この行を消す">
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => addItem()} className="text-[11px] font-black px-3 py-1 rounded-full bg-slate-900 text-white cursor-pointer">
                ＋ 行を追加
              </button>
              {PRICE_ITEM_PRESETS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => addItem(label)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100 cursor-pointer"
                >
                  ＋ {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {field(
              '値引き（円）',
              '',
              <input
                type="number"
                min={0}
                value={draft.discount || ''}
                onChange={(e) => update('discount', Math.max(0, Math.round(Number(e.target.value) || 0)))}
                placeholder="0"
                className={inputClass}
              />
            )}
            {field(
              '消費税',
              '',
              <select value={draft.tax_mode} onChange={(e) => update('tax_mode', e.target.value as TaxMode)} className={inputClass}>
                {(Object.keys(TAX_LABELS) as TaxMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {TAX_LABELS[mode]}
                  </option>
                ))}
              </select>
            )}
          </div>

          {draft.price_items.length === 0 &&
            field(
              '料金の合計（内訳を使わない場合）',
              '',
              <input
                type="number"
                min={0}
                value={draft.price ?? ''}
                onChange={(e) => update('price', e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))))}
                placeholder="15000"
                className={inputClass}
              />
            )}

          <div className="flex items-center justify-between rounded-xl bg-sky-50 px-4 py-3">
            <span className="text-xs font-black text-sky-800">合計（{TAX_LABELS[draft.tax_mode]}）</span>
            <span className="text-xl font-black text-sky-900 tabular-nums">{total === null ? '未定' : yen(total)}</span>
          </div>
        </>
      )}

      {section(
        3,
        '支払い',
        <>
          <div>
            <p className="text-xs font-black text-slate-700">支払いの予定</p>
            <p className="text-[11px] text-slate-400 mb-1.5">いつ・いくら払うか。下のボタンで、合計金額から自動で分けられます</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PAYMENT_PLANS.map((plan, i) => (
                <button
                  key={plan.label}
                  type="button"
                  onClick={() => applyPlan(i)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100 cursor-pointer"
                >
                  {plan.label}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              {draft.payment_schedule.map((step, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-50 p-2">
                  <input value={step.label} maxLength={40} onChange={(e) => setStep(i, { label: e.target.value })} placeholder="例：着手金" className={`${smallInput} w-28`} />
                  <span className="text-xs text-slate-400">¥</span>
                  <input
                    type="number"
                    min={0}
                    value={step.amount ?? ''}
                    onChange={(e) => setStep(i, { amount: e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))) })}
                    className={`${smallInput} w-24`}
                  />
                  <input value={step.timing} maxLength={60} onChange={(e) => setStep(i, { timing: e.target.value })} placeholder="時期（例：ラフ提出前）" className={`${smallInput} flex-1 min-w-[8rem]`} />
                  <button
                    type="button"
                    onClick={() => update('payment_schedule', draft.payment_schedule.filter((_, j) => j !== i))}
                    className="text-xs font-bold text-rose-400 hover:text-rose-600 px-1 cursor-pointer"
                    aria-label="この行を消す"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => update('payment_schedule', [...draft.payment_schedule, { label: '', amount: null, timing: '' }])}
                className="text-[11px] font-black px-3 py-1 rounded-full bg-slate-900 text-white cursor-pointer"
              >
                ＋ 支払いを追加
              </button>
              {draft.payment_schedule.length > 0 && total !== null && scheduleSum !== total && (
                <p className="text-[11px] font-bold text-amber-600">
                  ⚠ 支払いの予定の合計（{yen(scheduleSum)}）が、料金の合計（{yen(total)}）と合っていません
                </p>
              )}
            </div>
          </div>
          {field('支払いの方法', '振込先の種類やサービス名など（口座番号などはここに書かず、DMで伝えましょう）', draftText('payment', 2, 500))}
        </>
      )}

      {section(
        4,
        '日程と進め方',
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {field('着手予定日', '', <input type="date" value={draft.terms.start_date ?? ''} onChange={(e) => updateTerm('start_date', e.target.value || null)} className={inputClass} />)}
            {field('ラフの提出予定日', '', <input type="date" value={draft.terms.draft_due ?? ''} onChange={(e) => updateTerm('draft_due', e.target.value || null)} className={inputClass} />)}
            {field('納期', '', <input type="date" value={draft.deadline ?? ''} onChange={(e) => update('deadline', e.target.value || null)} className={inputClass} />)}
          </div>
          {field('確認の流れ', 'どの段階で依頼者に見てもらうか', draftText('process', 2, 500))}
          {field('連絡の取り方', '連絡に使うサービス・返信の目安など', termText('contact_rule'))}
        </>
      )}

      {section(
        5,
        '修正と納品',
        <>
          {field('修正回数・範囲', '', draftText('revisions', 2, 500))}
          {field('納品形式', 'ファイル形式・解像度など', draftText('delivery_format', 2, 500))}
          {field(
            '納品の方法',
            '',
            <>
              <input value={draft.terms.delivery_method} maxLength={200} onChange={(e) => updateTerm('delivery_method', e.target.value)} className={inputClass} />
              {chips(TERM_PRESETS.delivery_method, (text) => updateTerm('delivery_method', text))}
            </>
          )}
          {field('データの保管・再送', '', termText('data_retention'))}
        </>
      )}

      {section(
        6,
        '著作権と使ってよい範囲',
        <>
          {field(
            '著作権',
            '',
            <>
              {radios(
                draft.terms.copyright,
                [
                  { value: 'license', label: 'クリエイターに残し、依頼者は決めた範囲で使える（一般的）' },
                  { value: 'transfer', label: '支払いが終わったら依頼者に譲渡する（著作権譲渡）' },
                  { value: 'other', label: 'そのほか（自由に書く）' },
                ],
                (v) => updateTerm('copyright', v)
              )}
              {draft.terms.copyright === 'other' && (
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={draft.terms.copyright_note}
                  onChange={(e) => updateTerm('copyright_note', e.target.value)}
                  placeholder="著作権の扱いを書いてください"
                  className={`${inputClass} resize-y mt-2`}
                />
              )}
              {draft.terms.copyright === 'transfer' && (
                <div className="mt-2">
                  {check(draft.terms.moral_rights_waiver, '著作者人格権を行使しない（依頼者が自由に改変・公開できるようにする）', (v) => updateTerm('moral_rights_waiver', v))}
                </div>
              )}
            </>
          )}
          <div className="space-y-2">
            {check(draft.commercial_use, '商用利用してよい', (v) => update('commercial_use', v))}
            {check(draft.terms.ai_training_prohibited, '生成AIの学習・追加学習（LoRAなど）への利用を禁止する', (v) => updateTerm('ai_training_prohibited', v))}
          </div>
          {field(
            '使ってよい場所・方法',
            '',
            draftText('usage_scope', 2, 1000, '例：YouTube配信の立ち絵として使用。グッズ化は別途相談')
          )}
          {field(
            '依頼者による改変',
            '',
            radios(
              draft.terms.modification,
              [
                { value: 'minor', label: 'トリミング・サイズ変更など軽い加工だけ（それ以外は相談）' },
                { value: 'allowed', label: '加工・色の調整など、自由に改変してよい' },
                { value: 'not_allowed', label: '改変しない（加工するときは必ず相談）' },
              ],
              (v) => updateTerm('modification', v)
            )
          )}
          {field(
            'クリエイター名の表記（クレジット）',
            '',
            radios(
              draft.terms.credit,
              [
                { value: 'optional', label: '任意（書いても書かなくてもよい）' },
                { value: 'required', label: '公開するときは必ず書く' },
                { value: 'none', label: '書かなくてよい' },
              ],
              (v) => updateTerm('credit', v)
            )
          )}
        </>
      )}

      {section(
        7,
        '実績としての公開と秘密の保持',
        <>
          {check(draft.portfolio_ok, 'クリエイターが実績として公開してよい（SNS・ポートフォリオ）', (v) => update('portfolio_ok', v))}
          {draft.portfolio_ok &&
            field(
              '公開してよい時期',
              '',
              <>
                <input value={draft.terms.portfolio_timing} maxLength={200} onChange={(e) => updateTerm('portfolio_timing', e.target.value)} className={inputClass} />
                {chips(TERM_PRESETS.portfolio_timing, (text) => updateTerm('portfolio_timing', text))}
              </>
            )}
          {field('秘密にしておくこと', '', termText('confidentiality'))}
        </>
      )}

      {section(
        8,
        'キャンセル・遅れ・そのほか',
        <>
          {field('キャンセルの扱い', '', draftText('cancel_policy', 3, 1000))}
          {field('納期に遅れるとき', '', termText('delay_policy'))}
          {field(
            '特記事項',
            'そのほか、決めておきたいこと（任意）',
            <textarea rows={3} maxLength={2000} value={draft.notes} onChange={(e) => update('notes', e.target.value)} className={`${inputClass} resize-y`} />
          )}
        </>
      )}

      {/* できあがる合意書 */}
      <div className="rounded-2xl border-2 border-sky-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setPreviewOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-sky-50 text-sm font-black text-sky-900 cursor-pointer"
        >
          <span>📄 できあがる合意書を見る</span>
          <span>{previewOpen ? '▲' : '▼'}</span>
        </button>
        {previewOpen && (
          <div className="p-4 sm:p-6 bg-white">
            <AgreementDocument source={draft} names={{ creator: creatorName, client: fixedClientName || '（同意した依頼者）' }} />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 p-3.5 space-y-2">
        <p className="text-xs font-black text-slate-700">💾 いつもの内容</p>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          支払い方法・修正・納品・著作権・公開・キャンセルなど、毎回同じになりやすい内容を保存しておくと、次から最初から入った状態で作れます（タイトル・依頼内容・料金・日付は保存しません）。
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={saveTemplate} className="px-3.5 py-1.5 rounded-full bg-slate-900 text-white text-[11px] font-black hover:bg-slate-700 cursor-pointer">
            今の内容を「いつもの内容」にする
          </button>
          {hasTemplate && (
            <button
              type="button"
              onClick={loadTemplate}
              className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-[11px] font-black hover:bg-slate-50 cursor-pointer"
            >
              いつもの内容を入れ直す
            </button>
          )}
        </div>
        {templateMessage && <p className="text-[11px] font-bold text-emerald-600">{templateMessage}</p>}
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        <Link href="/agreements" className="text-xs font-bold text-slate-500 hover:underline">
          やめる
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-sm font-black shadow-sm hover:brightness-105 disabled:opacity-50 cursor-pointer"
        >
          {saving ? '保存中...' : mode.kind === 'edit' ? '保存する' : '控えを作ってリンクを発行'}
        </button>
      </div>
    </form>
  )
}

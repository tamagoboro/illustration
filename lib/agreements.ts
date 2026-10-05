// 合意内容の控え（supabase/add_agreements.sql）
import { AgreementTerms, PaymentStep, PriceItem, TaxMode, normalizeTerms } from './agreementDocument'
export * from './agreementDocument'

export type AgreementStatus = 'pending' | 'agreed' | 'declined' | 'cancelled' | 'superseded' | 'terminated'

export type Agreement = {
  id: string
  creator_id: string
  client_id: string | null
  request_id: string | null
  parent_id: string | null
  version: number
  status: AgreementStatus
  title: string
  description: string
  price: number | null
  deadline: string | null
  payment: string
  process: string
  revisions: string
  usage_scope: string
  commercial_use: boolean
  portfolio_ok: boolean
  delivery_format: string
  cancel_policy: string
  notes: string
  price_items: PriceItem[]
  discount: number
  tax_mode: TaxMode
  payment_schedule: PaymentStep[]
  terms: AgreementTerms
  client_comment: string | null
  // 作成・同意した時点の名前と連絡先（あとから変わらない。退会しても残る）
  creator_name: string | null
  creator_contact: string | null
  client_name: string | null
  client_contact: string | null
  agreed_at: string | null
  created_at: string
  updated_at: string
}

// 入力欄（クリエイターが書く部分）
export type AgreementDraft = Pick<
  Agreement,
  | 'title'
  | 'description'
  | 'price'
  | 'deadline'
  | 'payment'
  | 'process'
  | 'revisions'
  | 'usage_scope'
  | 'commercial_use'
  | 'portfolio_ok'
  | 'delivery_format'
  | 'cancel_policy'
  | 'notes'
  | 'price_items'
  | 'discount'
  | 'tax_mode'
  | 'payment_schedule'
  | 'terms'
>

export const EMPTY_AGREEMENT: AgreementDraft = {
  title: '',
  description: '',
  price: null,
  deadline: null,
  payment: '',
  process: '',
  revisions: '',
  usage_scope: '',
  commercial_use: false,
  portfolio_ok: true,
  delivery_format: '',
  cancel_policy: '',
  notes: '',
  price_items: [],
  discount: 0,
  tax_mode: 'included',
  payment_schedule: [],
  terms: normalizeTerms({}),
}

export const AGREEMENT_STATUS: Record<AgreementStatus, { label: string; className: string }> = {
  pending: { label: '同意待ち', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  agreed: { label: '同意済み', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  declined: { label: '見直し依頼あり', className: 'bg-rose-50 text-rose-600 border-rose-200' },
  cancelled: { label: '取り下げ', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  superseded: { label: '古い版（変更版あり）', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  terminated: { label: '双方の合意で解約', className: 'bg-slate-100 text-slate-600 border-slate-300' },
}

// 入力を助ける「よくある書き方」。押すと入力欄に入る
export const AGREEMENT_PRESETS = {
  payment: ['着手前に全額', 'ラフ確認後に全額', '着手金50%・納品前に残り50%', '納品後に全額', '銀行振込', 'PayPal', 'Skeb等の外部サービス経由'],
  process: ['ラフ → 線画 → 着彩 → 完成', 'ラフ → 完成', '構図案を3つ提出 → 1つ選んで制作'],
  revisions: ['ラフ段階は2回まで無料', '線画以降の大きな修正は有料（要相談）', '色味の微調整は完成後も対応'],
  usage_scope: ['SNSのアイコン・ヘッダー', '配信・動画での使用', 'グッズ化・販売', '同人誌・頒布物', 'ゲーム・アプリ内での使用'],
  delivery_format: ['PNG（長辺3000px）', 'JPG', 'PSD（レイヤー付き）', '透過PNG', 'SNS用の縮小版つき'],
  cancel_policy: [
    '着手前のキャンセルは全額返金',
    'ラフ提出後のキャンセルは料金の50%をいただきます',
    '線画以降のキャンセルは返金なし',
    'クリエイター都合で納品できない場合は全額返金',
  ],
} as const

export const formatYen = (price: number | null) => (price === null ? '未定' : `¥${price.toLocaleString()}（税込）`)

export const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric' }) : '未定'

export const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

// 控えの各項目の見出し（表示・印刷・テキストコピーで共通の並び）
export function agreementRows(a: AgreementDraft): { label: string; value: string }[] {
  return [
    { label: '依頼内容', value: a.description },
    { label: '料金', value: formatYen(a.price) },
    { label: '納期', value: a.deadline ? formatDate(a.deadline) : '未定' },
    { label: '支払い方法・時期', value: a.payment },
    { label: '確認の流れ', value: a.process },
    { label: '修正回数・範囲', value: a.revisions },
    { label: '商用利用', value: a.commercial_use ? '可' : '不可（個人利用の範囲）' },
    { label: '使ってよい範囲', value: a.usage_scope },
    { label: '実績としての公開', value: a.portfolio_ok ? 'クリエイターが実績として公開してよい' : '公開しない' },
    { label: '納品形式', value: a.delivery_format },
    { label: 'キャンセルの扱い', value: a.cancel_policy },
    { label: '特記事項', value: a.notes },
  ]
}

export const toDraft = (a: Agreement): AgreementDraft => ({
  title: a.title,
  description: a.description,
  price: a.price,
  deadline: a.deadline,
  payment: a.payment,
  process: a.process,
  revisions: a.revisions,
  usage_scope: a.usage_scope,
  commercial_use: a.commercial_use,
  portfolio_ok: a.portfolio_ok,
  delivery_format: a.delivery_format,
  cancel_policy: a.cancel_policy,
  notes: a.notes,
  price_items: Array.isArray(a.price_items) ? a.price_items : [],
  discount: a.discount || 0,
  tax_mode: a.tax_mode || 'included',
  payment_schedule: Array.isArray(a.payment_schedule) ? a.payment_schedule : [],
  terms: normalizeTerms(a.terms),
})

// ---- いつもの内容（テンプレート） ----
// 依頼ごとに変わる「タイトル・依頼内容・料金・納期」以外を保存する
export const TEMPLATE_KEYS = [
  'payment',
  'process',
  'revisions',
  'usage_scope',
  'commercial_use',
  'portfolio_ok',
  'delivery_format',
  'cancel_policy',
  'notes',
  'tax_mode',
  'terms',
] as const satisfies readonly (keyof AgreementDraft)[]

export type AgreementTemplate = Partial<Pick<AgreementDraft, (typeof TEMPLATE_KEYS)[number]>>

export function pickTemplate(draft: AgreementDraft): AgreementTemplate {
  const picked = Object.fromEntries(TEMPLATE_KEYS.map((key) => [key, draft[key]])) as AgreementTemplate
  // 日付は依頼ごとに変わるので保存しない
  if (picked.terms) picked.terms = { ...picked.terms, start_date: null, draft_due: null }
  return picked
}

// 保存されている値のうち、型が合うものだけを使う
export function applyTemplate(draft: AgreementDraft, template: unknown): AgreementDraft {
  if (!template || typeof template !== 'object') return draft
  const t = template as Record<string, unknown>
  const next = { ...draft }
  for (const key of TEMPLATE_KEYS) {
    const value = t[key]
    if (typeof value === typeof EMPTY_AGREEMENT[key]) (next as Record<string, unknown>)[key] = value
  }
  // 細かい取り決めは足りない項目を補い、日付（依頼ごとに変わる）は今の入力を残す
  next.terms = { ...normalizeTerms(next.terms), start_date: draft.terms.start_date, draft_due: draft.terms.draft_due }
  return next
}

// ---- 見積もり仕様書の取り込み ----
// クリエイターページの見積もりフォームで依頼者が作る「【ご依頼・見積もり仕様書】」（app/creator/[id]/CreatorClient.tsx）を読み取る
export function parseEstimateSpec(text: string): { description: string; price: number | null; clientName: string | null } | null {
  if (!text.includes('■')) return null
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const clientName = lines.find((l) => l.startsWith('依頼者名:'))?.replace('依頼者名:', '').trim() || null

  // 金額：割引後の合計があればそれ、なければ概算の合計
  const priceLine = lines.find((l) => /■\s*割引後合計/.test(l)) || lines.find((l) => /■\s*(概算見積もり)?合計/.test(l))
  const priceMatch = priceLine?.match(/¥\s*([\d,]+)/)
  const price = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null

  // 依頼内容：区切り線の間にある「■ 項目: 回答」
  const sep = lines.map((l, i) => (/^-{5,}/.test(l.trim()) ? i : -1)).filter((i) => i >= 0)
  const body = sep.length >= 2 ? lines.slice(sep[0] + 1, sep[1]) : lines.filter((l) => !/合計|通常価格|仕様書|依頼先|※/.test(l))
  const description = body
    .map((l) => l.replace(/^■\s*/, '・').replace(/^\s{2,}/, '　'))
    .join('\n')
    .trim()

  if (!description && price === null) return null
  return { description, price, clientName }
}

// ---- 同意後の進み具合 ----
export type AgreementEventKind =
  | 'paid'
  | 'payment_confirmed'
  | 'started'
  | 'draft'
  | 'delivered'
  | 'received'
  | 'note'
  | 'termination_requested'
  | 'termination_accepted'
  | 'termination_rejected'
  | 'trouble_reported'

export type AgreementEvent = {
  id: string
  agreement_id: string
  actor_id: string | null
  kind: AgreementEventKind
  note: string | null
  created_at: string
}

export const EVENT_INFO: Record<AgreementEventKind, { label: string; emoji: string; by: 'creator' | 'client' | 'both' }> = {
  paid: { label: '支払いました', emoji: '💴', by: 'client' },
  payment_confirmed: { label: '入金を確認しました', emoji: '✅', by: 'creator' },
  started: { label: '制作を始めました', emoji: '🎨', by: 'creator' },
  draft: { label: 'ラフ・途中経過を提出しました', emoji: '✏️', by: 'creator' },
  delivered: { label: '納品しました', emoji: '📦', by: 'creator' },
  received: { label: '受け取りました（取引完了）', emoji: '🎉', by: 'client' },
  note: { label: 'メモ', emoji: '📝', by: 'both' },
  termination_requested: { label: '解約を申し出ました', emoji: '⚠️', by: 'both' },
  termination_accepted: { label: '解約を承諾しました（解約）', emoji: '🤝', by: 'both' },
  termination_rejected: { label: '解約を承諾しませんでした', emoji: '↩', by: 'both' },
  trouble_reported: { label: '運営にトラブルを報告しました', emoji: '🚨', by: 'both' },
}

// 進み具合の段階（記録された内容から決める）
export const PROGRESS_STEPS = [
  { key: 'agreed', label: '合意' },
  { key: 'payment', label: '支払い' },
  { key: 'making', label: '制作' },
  { key: 'delivered', label: '納品' },
  { key: 'done', label: '完了' },
] as const

export function progressIndex(events: AgreementEvent[]) {
  const has = (k: AgreementEventKind) => events.some((e) => e.kind === k)
  if (has('received')) return 4
  if (has('delivered')) return 3
  if (has('started') || has('draft')) return 2
  if (has('paid') || has('payment_confirmed')) return 1
  return 0
}

// ---- 連絡先（X・Bluesky・Discord など） ----
// 控えには「サービス名: ID」の1つの文字列で保存する（例：X: @drawker）
export const CONTACT_SERVICES = ['X', 'Bluesky', 'Discord', 'Instagram', 'pixiv', 'メール', 'その他'] as const

export function splitContact(value: string | null | undefined): { service: string; id: string } {
  const text = (value || '').trim()
  const match = text.match(/^([^:：]+)[:：]\s*(.*)$/)
  if (match && (CONTACT_SERVICES as readonly string[]).includes(match[1].trim())) return { service: match[1].trim(), id: match[2] }
  return { service: 'X', id: text }
}

export const joinContact = (service: string, id: string) => (id.trim() ? `${service}: ${id.trim()}` : '')

// プロフィールのSNSリンク（sns_links）から、最初に見つかった連絡先を「サービス名: ID」にする
export function contactFromSnsLinks(links: unknown): string {
  if (!Array.isArray(links)) return ''
  for (const link of links as { platform?: string; url?: string }[]) {
    const url = (link?.url || '').trim()
    if (!url) continue
    const handle = url.match(/(?:x|twitter)\.com\/@?([A-Za-z0-9_]{1,15})/i)
    if (handle) return `X: @${handle[1]}`
    const bsky = url.match(/bsky\.app\/profile\/([^/?#]+)/i)
    if (bsky) return `Bluesky: @${bsky[1]}`
    if (link.platform === 'email' || /^[^@\s]+@[^@\s]+$/.test(url)) return `メール: ${url.replace(/^mailto:/, '')}`
  }
  return ''
}

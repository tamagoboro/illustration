// 合意内容の控え：料金の内訳・支払いの予定・細かい取り決め・できあがる合意書の文章
// （supabase/add_agreement_details.sql の price_items / discount / tax_mode / payment_schedule / terms）

// ---- 料金の内訳・支払いの予定 ----
export type TaxMode = 'included' | 'excluded' | 'none'
export type PriceItem = { label: string; amount: number; quantity: number }
export type PaymentStep = { label: string; amount: number | null; timing: string }

export const TAX_LABELS: Record<TaxMode, string> = {
  included: '税込',
  excluded: '税別（消費税は別途）',
  none: '消費税なし',
}

export const priceSubtotal = (items: PriceItem[]) =>
  items.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0) * Math.max(0, Number(item.quantity) || 0), 0)

// 内訳があれば内訳から、なければ入力された料金をそのまま使う
export const agreementTotal = (a: { price_items: PriceItem[]; discount: number; price: number | null }) =>
  a.price_items.length > 0 ? Math.max(0, priceSubtotal(a.price_items) - (a.discount || 0)) : a.price

export const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`

export const PRICE_ITEM_PRESETS = ['基本料金', '表情差分', 'パーツ分け', '背景', 'キャラクター追加', '商用利用', '特急料金', '著作権譲渡']

export const PAYMENT_PLANS: { label: string; steps: { label: string; ratio: number; timing: string }[] }[] = [
  { label: '着手前に全額', steps: [{ label: '全額', ratio: 1, timing: '着手前' }] },
  {
    label: '着手金50%・残り50%',
    steps: [
      { label: '着手金（50%）', ratio: 0.5, timing: 'ラフ提出前' },
      { label: '残金（50%）', ratio: 0.5, timing: '納品前' },
    ],
  },
  { label: '納品後に全額', steps: [{ label: '全額', ratio: 1, timing: '納品後7日以内' }] },
]

// ---- 細かい取り決め ----
export type AgreementTerms = {
  quantity_spec: string // 枚数・人数・差分の数など
  size_spec: string // サイズ・解像度
  delivery_method: string // 納品の方法
  start_date: string | null // 着手予定日
  draft_due: string | null // ラフ提出予定日
  contact_rule: string // 連絡の取り方・返信の目安
  copyright: 'license' | 'transfer' | 'other' // 著作権
  copyright_note: string
  moral_rights_waiver: boolean // 著作者人格権を行使しない
  modification: 'allowed' | 'minor' | 'not_allowed' // 依頼者による改変
  credit: 'required' | 'optional' | 'none' // クレジット表記
  ai_training_prohibited: boolean // 生成AIの学習への利用を禁止
  portfolio_timing: string // 実績として公開できる時期
  confidentiality: string // 秘密にしておくこと
  delay_policy: string // 納期に遅れるときの扱い
  data_retention: string // データの保管・再送
}

export const DEFAULT_TERMS: AgreementTerms = {
  quantity_spec: '',
  size_spec: '',
  delivery_method: '',
  start_date: null,
  draft_due: null,
  contact_rule: '',
  copyright: 'license',
  copyright_note: '',
  moral_rights_waiver: false,
  modification: 'minor',
  credit: 'optional',
  ai_training_prohibited: true,
  portfolio_timing: '',
  confidentiality: '',
  delay_policy: '',
  data_retention: '',
}

export function normalizeTerms(raw: unknown): AgreementTerms {
  const t = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out: AgreementTerms = { ...DEFAULT_TERMS }
  for (const key of Object.keys(DEFAULT_TERMS) as (keyof AgreementTerms)[]) {
    const value = t[key]
    const def = DEFAULT_TERMS[key]
    const ok = def === null ? value === null || typeof value === 'string' : typeof value === typeof def
    if (ok) (out as Record<string, unknown>)[key] = value
  }
  return out
}

export const TERM_PRESETS = {
  size_spec: ['長辺3000px以上・350dpi', '1920×1080px（16:9）', '正方形 1000×1000px'],
  delivery_method: ['Googleドライブで共有', 'ギガファイル便', 'Discordで送付', 'メールに添付'],
  contact_rule: ['連絡はXのDMで行う', '返信は原則48時間以内', '進み具合は週1回以上報告する'],
  portfolio_timing: ['納品後すぐ公開してよい', '依頼者が公開したあとなら公開してよい', '◯月◯日以降に公開してよい'],
  confidentiality: ['依頼者が公開するまで、作品をSNS等に載せない', 'やり取りの内容を第三者に話さない'],
  delay_policy: ['遅れそうなときは分かった時点ですぐに連絡し、新しい納期を相談する', '14日以上遅れる場合、依頼者は解約を申し出られ、受け取った料金は全額返金する'],
  data_retention: ['納品データは納品後3か月保管し、その間の再送は無料', '元データ（PSD）は依頼者の求めがあれば有料で提供'],
} as const

// ---- 合意書（できあがる文章） ----
export type DocumentSource = {
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
}

export type DocumentArticle = { title: string; items: { text: string; lines?: string[] }[] }

const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T00:00:00+09:00`).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric' })
    : ''

const splitLines = (text: string) =>
  (text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

type Item = { text: string; lines?: string[] }

export function buildAgreementDocument(a: DocumentSource, names: { creator: string; client: string }) {
  const t = normalizeTerms(a.terms)
  const total = agreementTotal(a)
  const tax = TAX_LABELS[a.tax_mode || 'included']
  const articles: DocumentArticle[] = []
  const add = (title: string, items: (Item | null | false | '' | undefined)[]) => {
    const kept = items.filter(Boolean) as Item[]
    if (kept.length) articles.push({ title, items: kept })
  }

  add('制作の内容', [
    {
      text: 'クリエイターは、依頼者の依頼にもとづき、次の作品（以下「本作品」）を制作する。',
      lines: splitLines(a.description).length ? splitLines(a.description) : [a.title],
    },
    t.quantity_spec.trim() && { text: `枚数・内容：${t.quantity_spec.trim()}` },
    t.size_spec.trim() && { text: `サイズ・仕様：${t.size_spec.trim()}` },
  ])

  add('料金', [
    { text: total === null ? '本作品の料金は、別途協議して定める。' : `本作品の料金は、合計 ${yen(total)}（${tax}）とする。` },
    a.price_items.length > 0 && {
      text: '料金の内訳は、次のとおりとする。',
      lines: [
        ...a.price_items.map((item) =>
          item.quantity > 1
            ? `${item.label}　${yen(item.amount)} × ${item.quantity} ＝ ${yen(item.amount * item.quantity)}`
            : `${item.label}　${yen(item.amount)}`
        ),
        ...(a.discount > 0 ? [`値引き　−${yen(a.discount)}`] : []),
      ],
    },
  ])

  const schedule = a.payment_schedule.filter((p) => p.label.trim())
  add('支払い', [
    schedule.length > 0 && {
      text: '依頼者は、次のとおり料金をクリエイターに支払う。',
      lines: schedule.map(
        (p) => `${p.label}${p.amount !== null && p.amount !== undefined ? `　${yen(p.amount)}` : ''}${p.timing.trim() ? `（${p.timing.trim()}）` : ''}`
      ),
    },
    splitLines(a.payment).length > 0 && {
      text: schedule.length ? '支払いの方法は、次のとおりとする。' : '料金の支払いは、次のとおりとする。',
      lines: splitLines(a.payment),
    },
    { text: '支払いと入金の確認は、Drawkerの控えに記録する。' },
  ])

  add('日程と進め方', [
    t.start_date && { text: `着手予定日：${fmtDate(t.start_date)}` },
    t.draft_due && { text: `ラフの提出予定日：${fmtDate(t.draft_due)}` },
    { text: a.deadline ? `納期：${fmtDate(a.deadline)}` : '納期は、別途協議して定める。' },
    splitLines(a.process).length > 0 && { text: '制作は、次の流れで進め、各段階で依頼者の確認を受ける。', lines: splitLines(a.process) },
    splitLines(t.contact_rule).length > 0 && { text: '連絡の取り方は、次のとおりとする。', lines: splitLines(t.contact_rule) },
  ])

  add('確認と修正', [
    splitLines(a.revisions).length > 0
      ? { text: '修正の対応は、次のとおりとする。', lines: splitLines(a.revisions) }
      : { text: '修正の回数・範囲は、別途協議して定める。' },
    { text: '上記の範囲を超える修正、または合意した内容からの大きな変更は、別途料金と納期を協議する。' },
  ])

  add('納品', [
    splitLines(a.delivery_format).length > 0 && { text: '納品する形式は、次のとおりとする。', lines: splitLines(a.delivery_format) },
    t.delivery_method.trim() && { text: `納品の方法：${t.delivery_method.trim()}` },
    { text: '依頼者は、納品物を受け取ったら速やかに内容を確認し、Drawkerの控えに受け取りを記録する。' },
    splitLines(t.data_retention).length > 0 && { text: 'データの保管・再送は、次のとおりとする。', lines: splitLines(t.data_retention) },
  ])

  const copyright =
    t.copyright === 'transfer'
      ? '本作品の著作権（著作権法第27条および第28条に定める権利を含む）は、料金の支払いが完了した時点で、クリエイターから依頼者に譲渡される。'
      : t.copyright === 'other' && t.copyright_note.trim()
        ? t.copyright_note.trim()
        : '本作品の著作権はクリエイターに帰属し、依頼者は次に定める範囲で本作品を利用できる。'
  add('著作権と利用範囲', [
    { text: copyright },
    {
      text: a.commercial_use
        ? '依頼者は、本作品を商用目的で利用できる。'
        : '依頼者による本作品の利用は、個人的な利用の範囲に限る（商用利用はできない）。',
    },
    splitLines(a.usage_scope).length > 0 && { text: '利用できる場所・方法は、次のとおりとする。', lines: splitLines(a.usage_scope) },
    {
      text:
        t.modification === 'allowed'
          ? '依頼者は、本作品のトリミング・色調の補正・加工などの改変を行うことができる。'
          : t.modification === 'minor'
            ? '依頼者は、トリミング・サイズの変更など軽微な加工に限り、本作品を改変できる。それ以外の改変は、クリエイターの承諾を得て行う。'
            : '依頼者は、クリエイターの承諾を得ずに本作品を改変しない。',
    },
    t.moral_rights_waiver && { text: 'クリエイターは、依頼者および依頼者が指定する者に対し、本作品について著作者人格権を行使しない。' },
    t.ai_training_prohibited && { text: '依頼者は、本作品を生成AIの学習・追加学習（LoRA等を含む）に利用せず、第三者にも利用させない。' },
    {
      text:
        t.credit === 'required'
          ? '依頼者は、本作品を公開する際、クリエイターの名前をクレジットとして表記する。'
          : t.credit === 'optional'
            ? '本作品を公開する際のクリエイター名の表記は、任意とする。'
            : '本作品を公開する際、クリエイター名の表記は不要とする。',
    },
  ])

  add('実績としての公開と秘密の保持', [
    {
      text: a.portfolio_ok
        ? `クリエイターは、本作品を自身の実績として、SNS・ポートフォリオ等で公開できる。${
            t.portfolio_timing.trim() ? `公開できる時期は「${t.portfolio_timing.trim()}」とする。` : ''
          }`
        : 'クリエイターは、本作品を自身の実績として公開しない。',
    },
    splitLines(t.confidentiality).length > 0 && { text: '当事者は、次の事項を守る。', lines: splitLines(t.confidentiality) },
  ])

  add('キャンセルと解約', [
    splitLines(a.cancel_policy).length > 0 && { text: 'キャンセルの取り扱いは、次のとおりとする。', lines: splitLines(a.cancel_policy) },
    { text: '本合意の成立後の解約は、当事者の一方の申し出に対し、もう一方が承諾した場合に限り成立する。手続きはDrawkerの控えで行う。' },
  ])

  add('納期の遅れ', [
    splitLines(t.delay_policy).length > 0
      ? { text: '納期に遅れる場合の取り扱いは、次のとおりとする。', lines: splitLines(t.delay_policy) }
      : { text: 'やむを得ない事情で納期に間に合わないおそれがあるときは、クリエイターは速やかに依頼者へ連絡し、新しい納期を協議する。' },
  ])

  add('特記事項', [splitLines(a.notes).length > 0 && { text: '当事者は、次の事項について合意する。', lines: splitLines(a.notes) }])

  add('合意内容の変更と記録', [
    { text: '本合意の内容を変更するときは、Drawkerの控えで変更版を作成し、双方が同意したものを最新の合意とする。' },
    { text: '本合意の成立と取引の経過は、Drawkerの控えに記録され、当事者はいつでも確認できる。' },
  ])

  return {
    heading: 'イラスト制作に関する合意書',
    preamble: `依頼者 ${names.client}（以下「依頼者」）とクリエイター ${names.creator}（以下「クリエイター」）は、「${a.title}」の制作について、次のとおり合意する。`,
    articles,
  }
}

// 合意書を文字にする（コピー用）
export function agreementDocumentText(a: DocumentSource, names: { creator: string; client: string }, footer: string[]) {
  const doc = buildAgreementDocument(a, names)
  const out: string[] = [doc.heading, `「${a.title}」`, '', doc.preamble, '']
  doc.articles.forEach((article, i) => {
    out.push(`第${i + 1}条（${article.title}）`)
    article.items.forEach((item, j) => {
      out.push(`${article.items.length > 1 ? `${j + 1}. ` : ''}${item.text}`)
      item.lines?.forEach((l) => out.push(`　・${l}`))
    })
    out.push('')
  })
  return [...out, ...footer].join('\n')
}

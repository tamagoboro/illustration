// 「流れ」（ご依頼の流れ・お迎えまでの流れ）の共通部分。
// クリエイターが編集していないときは、それぞれの標準の流れを表示する。
export type FlowStep = { emoji: string; title: string; body: string }

export const MAX_FLOW_STEPS = 8

// 通常のご依頼の流れ（Drawkerは決済を仲介しないので、支払いは当事者同士で決める前提の文面）
export const DEFAULT_COMMISSION_FLOW: FlowStep[] = [
  { emoji: '📩', title: '見積もり・相談', body: '見積もりフォームやお問い合わせから、ご希望の内容をお送りください。' },
  { emoji: '💬', title: '内容の確認', body: '用途・サイズ・納期・料金をすり合わせて、条件を確定します。' },
  { emoji: '💴', title: 'お支払い', body: '決めた方法でお支払いをお願いします。タイミングはクリエイターの案内に従ってください。' },
  { emoji: '✏️', title: '制作・確認', body: 'ラフ → 線画 → 完成の順に、途中経過を確認していただきます。' },
  { emoji: '🎁', title: '納品', body: '完成データをお渡しして完了です。' },
]

export const normalizeFlowSteps = (raw: unknown): FlowStep[] =>
  Array.isArray(raw)
    ? raw
        .filter((f) => f && typeof f.title === 'string' && f.title.trim())
        .slice(0, MAX_FLOW_STEPS)
        .map((f) => ({ emoji: typeof f.emoji === 'string' ? f.emoji : '', title: f.title, body: typeof f.body === 'string' ? f.body : '' }))
    : []

// 保存用：前後の空白を取り、見出しの無いステップは捨てる
export const cleanFlowSteps = (steps: FlowStep[]): FlowStep[] =>
  steps
    .map((f) => ({ emoji: f.emoji.trim(), title: f.title.trim(), body: f.body.trim() }))
    .filter((f) => f.title)

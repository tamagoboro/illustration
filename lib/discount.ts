// キャンペーン割引（期間限定の一律割引）と、メニュー項目・見積もり項目ごとの
// 個別割引指定を統一的に扱うためのユーティリティ。
//
// 優先順位: 個別指定(custom) > 対象外指定(exempt) > キャンペーンの一律割引(campaign) > 割引なし
// - mode: 'inherit' … 個別指定なし。有効なキャンペーンがあればそれに従う
// - mode: 'custom'  … このアイテムだけ独自の割引を設定
// - mode: 'exempt'  … キャンペーンが有効でもこのアイテムは割引対象外にする

export type DiscountType = 'percent' | 'fixed'

export type Campaign = {
  enabled?: boolean | null
  label?: string | null
  discountType?: DiscountType | null
  discountValue?: number | null
  startAt?: string | null
  endAt?: string | null
}

export type ItemDiscountConfig = {
  mode: 'inherit' | 'custom' | 'exempt'
  type?: DiscountType
  value?: number
}

export type ResolvedDiscount = { type: DiscountType; value: number }

export const DEFAULT_ITEM_DISCOUNT: ItemDiscountConfig = { mode: 'inherit' }

export function isCampaignActive(campaign: Campaign | null | undefined): boolean {
  if (!campaign || !campaign.enabled) return false
  if (!campaign.discountType || !campaign.discountValue || campaign.discountValue <= 0) return false
  const now = Date.now()
  if (campaign.startAt && now < new Date(campaign.startAt).getTime()) return false
  if (campaign.endAt && now > new Date(campaign.endAt).getTime()) return false
  return true
}

export function resolveDiscount(
  campaign: Campaign | null | undefined,
  config?: ItemDiscountConfig | null
): ResolvedDiscount | null {
  if (config?.mode === 'exempt') return null

  if (config?.mode === 'custom' && config.type && typeof config.value === 'number' && config.value > 0) {
    return { type: config.type, value: config.value }
  }

  if (isCampaignActive(campaign)) {
    return { type: campaign!.discountType as DiscountType, value: campaign!.discountValue as number }
  }

  return null
}

export function applyDiscount(price: number, discount: ResolvedDiscount | null | undefined): number {
  if (!discount || !Number.isFinite(price) || price <= 0) return price
  if (discount.type === 'percent') {
    return Math.max(0, Math.round(price * (1 - discount.value / 100)))
  }
  return Math.max(0, Math.round(price - discount.value))
}

export function formatDiscountBadge(discount: ResolvedDiscount | null | undefined): string | null {
  if (!discount) return null
  return discount.type === 'percent' ? `${discount.value}%OFF` : `${discount.value.toLocaleString()}円OFF`
}

// 立ち絵は固定額引き・ヘッダーは％引きのように項目ごとに割引の種類が異なる場合、
// 合計金額に対して単一の「◯%OFF」「◯円OFF」バッジを付けると実態と合わなくなる。
// そのため合計金額のバッジは常に「実際に引かれた金額」を表示する（種類が混在していても必ず正しい）。
export function formatSavingsBadge(originalTotal: number, discountedTotal: number): string | null {
  const diff = Math.round(originalTotal - discountedTotal)
  if (diff <= 0) return null
  return `¥${diff.toLocaleString()}OFF`
}

// 日付(YYYY-MM-DD)入力用フォーマット変換
export const toDateInputValue = (iso: string | null | undefined): string => {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export const fromDateInputValue = (value: string, endOfDay = false): string | null => {
  if (!value) return null
  return endOfDay ? `${value}T23:59:59` : `${value}T00:00:00`
}

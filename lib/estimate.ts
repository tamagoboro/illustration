import { Campaign, ItemDiscountConfig, applyDiscount, resolveDiscount } from './discount'

// 見積もりフォームの合計金額の計算。クリエイターページ（実際の見積もり）とフォーム作成画面のプレビューで同じ式を使う。
//
// 選択肢の料金の種類（priceType）
//   fixed        … 円
//   percent_base … 基本%。基本料金（オプションを含まない料金）に対する割増
//   percent      … 総額%。オプション込みの合計（基本料金＋オプション）に対する割増。
//                  2種類に分ける前に保存された「%」はこの値なので、これまでどおりの計算になる
//
// 基本料金 … 項目自体の料金 ＋ 「1つだけ選ぶ」項目（radio）で選んだ円の合計
// オプション … 「複数選べる」項目（checkbox）で選んだ円の合計
// 合計 ＝ 基本料金 ＋ オプション ＋ 基本料金 × 基本% ＋ （基本料金＋オプション）× 総額%
export type PriceType = 'fixed' | 'percent' | 'percent_base'

type EstimateOption = { label: string; price: number; priceType?: PriceType; discount?: ItemDiscountConfig }
type EstimateField = {
  id: string
  type: string
  price?: number
  discount?: ItemDiscountConfig
  options?: EstimateOption[]
}

export const isPercentType = (priceType?: PriceType) => priceType === 'percent' || priceType === 'percent_base'

// 選択肢の横に出す料金の表示（例: +¥3,000 / +基本料金の50% / +総額の20%）
export function formatOptionPrice(opt: { price: number; priceType?: PriceType }) {
  const sign = opt.price > 0 ? '+' : ''
  if (opt.priceType === 'percent_base') return `${sign}基本料金の${opt.price}%`
  if (opt.priceType === 'percent') return `${sign}総額の${opt.price}%`
  return `${sign}¥${opt.price.toLocaleString()}`
}

export function computeEstimateTotals(
  fields: EstimateField[],
  answers: Record<string, unknown>,
  campaign: Campaign | null | undefined
) {
  // [割引後, 割引前]
  const base = [0, 0]
  const options = [0, 0]
  const basePercent = [0, 0]
  const totalPercent = [0, 0]
  const add = (bucket: number[], price: number, discount?: ItemDiscountConfig) => {
    bucket[0] += applyDiscount(price, resolveDiscount(campaign, discount))
    bucket[1] += price
  }

  fields.forEach((field) => {
    if (field.type === 'note' || field.type === 'faq') return
    if (field.price) add(base, field.price, field.discount)

    const answer = answers[field.id]
    if (!answer || !field.options) return
    const selected =
      field.type === 'radio'
        ? field.options.filter((opt) => opt.label === answer).slice(0, 1)
        : field.type === 'checkbox' && Array.isArray(answer)
          ? (answer.map((label) => field.options!.find((opt) => opt.label === label)).filter(Boolean) as EstimateOption[])
          : []

    selected.forEach((opt) => {
      if (opt.priceType === 'percent_base') add(basePercent, opt.price, opt.discount)
      else if (opt.priceType === 'percent') add(totalPercent, opt.price, opt.discount)
      else add(field.type === 'radio' ? base : options, opt.price, opt.discount)
    })
  })

  const totalOf = (i: number) => {
    const subtotal = base[i] + options[i]
    return subtotal + Math.round(base[i] * (basePercent[i] / 100)) + Math.round(subtotal * (totalPercent[i] / 100))
  }

  return { baseTotal: base[0], total: totalOf(0), originalTotal: totalOf(1) }
}

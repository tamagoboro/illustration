// アイコンリングのカタログ（CSSのグラデーションだけで表現するため画像素材は不要）。
// 価格を変える場合は supabase/add_points_and_rings.sql の purchase_ring 関数内の
// 金額も必ず同じ値に揃えること（購入時の金額はDB側の値が優先されるため、
// ここだけ変えても実際の消費ポイントは変わらない）。
export type IconRing = {
  id: string
  name: string
  cost: number
  background: string
}

export const ICON_RINGS: IconRing[] = [
  { id: 'sky', name: 'スカイブルー', cost: 50, background: 'linear-gradient(135deg, #38bdf8, #67e8f9)' },
  { id: 'forest', name: 'フォレスト', cost: 80, background: 'linear-gradient(135deg, #22c55e, #0ea5e9)' },
  { id: 'sunset', name: 'サンセット', cost: 80, background: 'linear-gradient(135deg, #f97316, #ec4899)' },
  { id: 'gold', name: 'ゴールド', cost: 200, background: 'linear-gradient(135deg, #fde68a, #f59e0b, #fde68a)' },
  { id: 'rainbow', name: 'レインボー', cost: 300, background: 'conic-gradient(from 0deg, #f43f5e, #f59e0b, #22c55e, #38bdf8, #8b5cf6, #f43f5e)' },
]

export function getIconRing(ringId: string | null | undefined): IconRing | null {
  if (!ringId) return null
  return ICON_RINGS.find((r) => r.id === ringId) || null
}

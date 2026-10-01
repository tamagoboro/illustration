// 魂募集イラスト（soul_listings）の型と表示用の共通処理
export type SoulPrice = { label: string; price: number | null }

export type SoulListing = {
  id: string
  user_id: string
  title: string
  image_url: string
  description: string
  target_audience: string
  prices: SoulPrice[]
  commercial_use: 'allowed' | 'not_allowed' | 'negotiable'
  starts_at: string | null
  ends_at: string | null
  is_closed: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export const COMMERCIAL_USE_LABELS: Record<SoulListing['commercial_use'], string> = {
  allowed: '商用利用OK',
  not_allowed: '商用利用不可',
  negotiable: '商用利用は要相談',
}

// 日本時間の今日（YYYY-MM-DD）。掲載期間は日付単位で判定する
export const todayInJapan = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date())

export type SoulStatus = 'open' | 'upcoming' | 'ended' | 'closed'

export function getSoulStatus(listing: Pick<SoulListing, 'starts_at' | 'ends_at' | 'is_closed'>, today = todayInJapan()): SoulStatus {
  if (listing.is_closed) return 'closed'
  if (listing.starts_at && listing.starts_at > today) return 'upcoming'
  if (listing.ends_at && listing.ends_at < today) return 'ended'
  return 'open'
}

export const SOUL_STATUS_LABELS: Record<SoulStatus, string> = {
  open: '募集中',
  upcoming: '掲載前',
  ended: '掲載終了',
  closed: '募集終了',
}

const formatDate = (d: string) => d.replace(/-/g, '/')

export function formatSoulPeriod(listing: Pick<SoulListing, 'starts_at' | 'ends_at'>) {
  if (!listing.starts_at && !listing.ends_at) return '期限なし'
  if (!listing.ends_at) return `${formatDate(listing.starts_at!)} 〜`
  return `${listing.starts_at ? formatDate(listing.starts_at) : ''} 〜 ${formatDate(listing.ends_at)}`
}

export const normalizePrices = (raw: unknown): SoulPrice[] =>
  Array.isArray(raw)
    ? raw
        .filter((p) => p && typeof p.label === 'string')
        .map((p) => ({ label: String(p.label), price: typeof p.price === 'number' ? p.price : null }))
    : []

export const formatPrice = (price: number | null) => (price === null ? '応相談' : `¥${price.toLocaleString()}`)

export const minSoulPrice = (prices: SoulPrice[]) => {
  const values = prices.map((p) => p.price).filter((p): p is number => typeof p === 'number')
  return values.length ? Math.min(...values) : null
}

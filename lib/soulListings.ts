// 魂募集イラスト（soul_listings）の型と表示用の共通処理
export type SoulPrice = { label: string; price: number | null }

export type SoulListing = {
  id: string
  user_id: string
  title: string
  image_url: string // 表紙（image_urls の1枚目と同じ）
  image_urls: string[] // 最大4枚。1枚目が表紙
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

export const MAX_SOUL_IMAGES = 4

// DBの行を画面用に整える（画像を4枚まで追加する前の行は image_url だけなので、それを1枚目として扱う）
export const normalizeSoulListing = (row: any): SoulListing => {
  const images: string[] = Array.isArray(row.image_urls) && row.image_urls.length ? row.image_urls : row.image_url ? [row.image_url] : []
  return { ...row, image_urls: images.slice(0, MAX_SOUL_IMAGES), image_url: images[0] || row.image_url, prices: normalizePrices(row.prices) }
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

// 魂募集のシェア用カード画像と、シェアするときのURL。updated_at とデザインのバージョンが変わると
// URLも変わり、Xに古いカードが残らない（lib/ogCard.ts と同じ考え方）
export const SOUL_OG_DESIGN_VERSION = 1

export const getSoulCardVersion = (updatedAt?: string | null) =>
  `${updatedAt ? new Date(updatedAt).getTime() : 0}-${SOUL_OG_DESIGN_VERSION}`

export const getSoulShareUrl = (origin: string, creatorId: string, soulId: string, updatedAt?: string | null) =>
  `${origin}/creator/${creatorId}/souls/${soulId}?s=${getSoulCardVersion(updatedAt)}`

// Xで宣伝するときの文面
export function buildSoulShareText(listing: Pick<SoulListing, 'title' | 'prices' | 'ends_at'>, creatorName: string) {
  const min = minSoulPrice(listing.prices)
  const lines = [
    `🎭 魂募集中！「${listing.title}」`,
    listing.prices.length ? `💰 ${min === null ? '金額は応相談' : `${formatPrice(min)}〜`}` : '',
    listing.ends_at ? `📅 ${listing.ends_at.replace(/-/g, '/')}まで募集` : '',
    `🎨 ${creatorName}`,
    '',
    '#魂募集 #VTuber #Drawker',
  ]
  return lines.filter((l, i) => l !== '' || i === 4).join('\n')
}

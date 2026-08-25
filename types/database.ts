export type Profile = {
  user_id: string
  display_name: string
  avatar_url: string | null
  status: 'available' | 'busy' | 'unavailable'
  status_comment: string | null
  lead_time_days: number
  tastes: string[]
  commercial_use_allowed: boolean
  portfolio_publish_required: boolean
  external_estimation_url: string | null
  portfolio_items?: PortfolioItem[]
}

export type PortfolioItem = {
  id: string
  user_id: string
  title: string | null
  image_url: string
  before_image_url: string | null
  is_pinned: boolean
  sort_order: number
}
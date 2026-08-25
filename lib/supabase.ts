import { createClient } from '@supabase/supabase-js'

export type Profile = {
  user_id: string
  display_name: string
  avatar_url: string | null
  status: string
  status_comment: string | null
  lead_time_days: number
  tastes: string[]
  commercial_use_allowed: boolean
  portfolio_publish_required: boolean
  external_estimation_url: string | null
  price_min?: number | null // 👈 追加
  updated_at: string
}

export type CustomPageSetting = {
  user_id: string
  theme_color: string
  font_family: string
  background_type: string
  background_url: string | null
  custom_cursor_url: string | null
  custom_css: string | null
}

export type PageBlock = {
  id: string
  user_id: string
  block_type: string
  sort_order: number
  content_data: Record<string, unknown>
  style_data: Record<string, unknown>
}

export type PortfolioItem = {
  id: string
  user_id: string
  title: string | null
  image_url: string
  before_image_url: string | null
  is_pinned: boolean
  sort_order: number
  created_at: string
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
import { createBrowserClient } from '@supabase/ssr'

export type Profile = {
  id?: string
  user_id: string
  display_name: string
  avatar_url?: string | null
  status: 'available' | 'busy' | string
  status_comment?: string | null
  tastes?: string[]
  lead_time_days: number
  commercial_use_allowed: boolean
  portfolio_publish_required?: boolean
  price_min?: number | null
  external_estimation_url?: string | null
  twitter_url?: string | null
  instagram_url?: string | null
  pixiv_url?: string | null
  website_url?: string | null
  created_at?: string
  updated_at?: string
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
  title?: string | null
  image_url: string
  description?: string | null // ← ここを追加！
  before_image_url?: string | null
  is_pinned?: boolean
  sort_order: number
  created_at?: string
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// utils/supabase/client.ts と同じ createBrowserClient (@supabase/ssr) を使用。
// 以前は @supabase/supabase-js の createClient を直接使っていたため、
// このファイル経由のクライアントと utils/supabase/client.ts 経由のクライアントとで
// 認証セッションのCookie同期のされ方が異なり、ページによってログイン状態の
// 見え方が食い違うことがあった。ここを揃えることでその不整合を解消する。
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
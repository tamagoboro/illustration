import { supabase } from '@/lib/supabase'

// 募集ボード（supabase/add_wanted_board.sql）。
// 依頼者が「こういうクリエイターを募集しています」と出し、クリエイターが応募する。
// 応募の内容は、応募した本人と募集を出した人にしか見えない。

export type WantedPost = {
  id: string
  user_id: string
  title: string
  description: string
  tastes: string[]
  budget_min: number | null
  budget_max: number | null
  desired_deadline: string | null
  apply_until: string | null
  commercial_use: boolean
  status: 'open' | 'closed'
  created_at: string
  updated_at: string
}

export type WantedApplication = {
  id: string
  post_id: string
  creator_id: string
  message: string
  proposed_price: number | null
  created_at: string
}

export type PosterProfile = { display_name: string | null; avatar_url: string | null }

// DBの制約（add_wanted_board.sql）と合わせる
export const WANTED_TITLE_MAX = 60
export const WANTED_DESCRIPTION_MAX = 1000
export const WANTED_TASTES_MAX = 8
export const WANTED_MESSAGE_MAX = 1000
export const WANTED_OPEN_LIMIT = 3

export const WANTED_POST_COLUMNS =
  'id, user_id, title, description, tastes, budget_min, budget_max, desired_deadline, apply_until, commercial_use, status, created_at, updated_at'

export const normalizeWantedPost = (row: any): WantedPost => ({
  id: row.id,
  user_id: row.user_id,
  title: row.title || '',
  description: row.description || '',
  tastes: Array.isArray(row.tastes) ? row.tastes : [],
  budget_min: typeof row.budget_min === 'number' ? row.budget_min : null,
  budget_max: typeof row.budget_max === 'number' ? row.budget_max : null,
  desired_deadline: row.desired_deadline || null,
  apply_until: row.apply_until || null,
  commercial_use: !!row.commercial_use,
  status: row.status === 'closed' ? 'closed' : 'open',
  created_at: row.created_at,
  updated_at: row.updated_at,
})

// 今日の日付（日本時間・YYYY-MM-DD）。募集の締切日と文字列のまま比べられる
export const todayInJapan = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date())

// いま応募を受け付けているか（締め切っておらず、締切日も過ぎていない）
export const isWantedOpen = (post: Pick<WantedPost, 'status' | 'apply_until'>, today = todayInJapan()) =>
  post.status === 'open' && (!post.apply_until || post.apply_until >= today)

export const formatYen = (value: number) => `¥${value.toLocaleString()}`

export function formatBudget(post: Pick<WantedPost, 'budget_min' | 'budget_max'>) {
  const { budget_min: min, budget_max: max } = post
  if (min !== null && max !== null) return min === max ? formatYen(min) : `${formatYen(min)}〜${formatYen(max)}`
  if (min !== null) return `${formatYen(min)}〜`
  if (max !== null) return `〜${formatYen(max)}`
  return '応相談'
}

// 「2026-10-20」→「2026/10/20」
export const formatDate = (date: string | null) => (date ? date.slice(0, 10).replace(/-/g, '/') : '')

// 募集を出した人・応募した人の表示名とアイコンをまとめて取得する（ユーザーID → プロフィール）
export async function loadProfilesByIds(userIds: string[]): Promise<Record<string, PosterProfile>> {
  const ids = Array.from(new Set(userIds))
  if (ids.length === 0) return {}
  const { data, error } = await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', ids)
  if (error) {
    console.error('プロフィールの取得エラー:', error)
    return {}
  }
  const map: Record<string, PosterProfile> = {}
  ;(data || []).forEach((p: any) => {
    map[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url }
  })
  return map
}

// 応募の件数（募集ID → 件数）。件数だけで、誰が応募したかは分からない
export async function loadApplicationCounts(postIds: string[]): Promise<Record<string, number>> {
  if (postIds.length === 0) return {}
  const { data, error } = await supabase.rpc('wanted_application_counts', { p_post_ids: postIds })
  if (error) {
    console.error('応募件数の取得エラー:', error)
    return {}
  }
  const map: Record<string, number> = {}
  ;((data || []) as any[]).forEach((row) => {
    map[row.post_id] = row.application_count
  })
  return map
}

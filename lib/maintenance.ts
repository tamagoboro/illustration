// 緊急メンテナンスに切り替えられるページ。area は maintenance_flags テーブル（supabase/add_maintenance_mode.sql）と同じ名前。
// paths に書いたURLと、その下のページ（/feed/xxx など）がまとめて対象になる。
export type MaintenanceArea = {
  area: string
  emoji: string
  label: string
  note: string
  paths: string[]
}

export const MAINTENANCE_AREAS: MaintenanceArea[] = [
  {
    area: 'estimate',
    emoji: '🧮',
    label: '見積もりフォーム作成',
    note: 'ダッシュボードの見積もりフォーム作成ページ',
    paths: ['/dashboard/form-builder'],
  },
  {
    area: 'wanted',
    emoji: '📣',
    label: '募集ボード',
    note: '一覧・募集の詳細・募集を出すページ',
    paths: ['/wanted'],
  },
  {
    area: 'feed',
    emoji: '💬',
    label: 'フィード',
    note: 'フィードと、投稿ごとのページ',
    paths: ['/feed'],
  },
  {
    area: 'agreement_new',
    emoji: '📝',
    label: '控えの作成',
    note: '合意内容の控えを新しく作るページ（作成済みの控えはそのまま見られます）',
    paths: ['/agreements/new'],
  },
]

// 今のURLがどの対象に当たるか（当たらなければ null）
export function maintenanceAreaForPath(pathname: string | null): MaintenanceArea | null {
  if (!pathname) return null
  return MAINTENANCE_AREAS.find((a) => a.paths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) || null
}

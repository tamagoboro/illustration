// 管理者が作品を「非表示」にしたときに差し替える代替画像。admin_replace_portfolio_image
// （supabase/add_admin_image_moderation.sql）が差し替え先として許可しているURLと一致させること。
export const MODERATED_PLACEHOLDER_URL = '/moderated-placeholder.svg'

// 公開URLから「portfolios」バケット内のパスだけを取り出す（storage.remove()に渡すため）。
// 自サイトのストレージ以外のURL（同梱のプレースホルダー画像など）は null を返す。
export function extractStoragePath(url: string | null | undefined): string | null {
  if (!url) return null
  const marker = '/storage/v1/object/public/portfolios/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  const path = url.slice(idx + marker.length).split('?')[0]
  return path || null
}

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

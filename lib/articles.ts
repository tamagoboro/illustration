// 記事（/articles）の共通部品。テーブルは supabase/add_articles.sql。

// カテゴリ。増やす・名前を変えるときはここを書き換える（DBには value が保存される）
export const ARTICLE_CATEGORIES = [
  { value: 'basics', label: 'イラストの基礎知識', emoji: '🎨' },
  { value: 'commission', label: '依頼の受け方・準備', emoji: '📝' },
  { value: 'platforms', label: 'プラットフォーム紹介', emoji: '🌐' },
  { value: 'glossary', label: '用語集', emoji: '📖' },
  { value: 'other', label: 'その他', emoji: '💡' },
] as const

export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number]['value']

export const categoryInfo = (value: string) =>
  ARTICLE_CATEGORIES.find((c) => c.value === value) ?? ARTICLE_CATEGORIES[ARTICLE_CATEGORIES.length - 1]

export type Article = {
  id: string
  slug: string
  title: string
  description: string
  category: string
  cover_image_url: string | null
  body: string
  status: 'draft' | 'published'
  published_at: string | null
  created_at: string
  updated_at: string
}

// 一覧で使う列（本文は重いので取らない）
export const ARTICLE_LIST_COLUMNS = 'id, slug, title, description, category, cover_image_url, status, published_at, created_at, updated_at'

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const randomSlug = () => `article-${Math.random().toString(36).slice(2, 8)}`

export const formatArticleDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric' }) : ''

// 本文を読み終えるまでの目安（日本語はおよそ1分500文字）
export const readingMinutes = (body: string) => Math.max(1, Math.round(body.replace(/\s+/g, '').length / 500))

// シェア用カード画像のURLに付ける版。記事を更新するとURLが変わり、Xに古いカードが残らない
export const articleCardVersion = (updatedAt: string) => new Date(updatedAt).getTime().toString(36)

// ---- 目次 ----
// 目次のリンク先（見出しのid）は、本文の描画（components/articles/ArticleBody.tsx）と同じ作り方にする

// Markdown の飾り（**太字**・`コード`・[リンク](URL)）を外して、見出しの文字だけにする
export function plainHeadingText(text: string) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .trim()
}

export function headingId(text: string) {
  return `h-${text.trim().replace(/\s+/g, '-').replace(/[#?&/\\%"'<>]/g, '').slice(0, 60)}`
}

export type TocItem = { id: string; text: string; level: 2 | 3 }

export function extractToc(body: string): TocItem[] {
  const items: TocItem[] = []
  let inCode = false
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) inCode = !inCode
    if (inCode) continue
    const match = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/)
    if (!match) continue
    const text = plainHeadingText(match[2])
    if (text) items.push({ id: headingId(text), text, level: match[1].length as 2 | 3 })
  }
  return items
}

// ---- 埋め込み ----
// 本文で、1行にURLだけを書くと埋め込みになる（YouTube・ニコニコ・Vimeo・動画ファイルは動画、それ以外はリンクカード）

export type Embed =
  | { kind: 'iframe'; src: string; title: string; vertical?: boolean }
  | { kind: 'video'; src: string }
  | { kind: 'link'; url: string; host: string }

export function parseEmbed(rawUrl: string): Embed | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.replace(/^(www|m)\./, '')

  if (host === 'youtu.be' || host === 'youtube.com') {
    const id =
      host === 'youtu.be'
        ? url.pathname.slice(1, 12)
        : url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1]
    if (id && /^[\w-]{11}$/.test(id)) {
      return {
        kind: 'iframe',
        src: `https://www.youtube-nocookie.com/embed/${id}`,
        title: 'YouTube動画',
        vertical: url.pathname.startsWith('/shorts/'),
      }
    }
  }
  if (host === 'nicovideo.jp' || host === 'nico.ms') {
    const id = url.pathname.match(/((?:sm|nm|so)\d+)/)?.[1]
    if (id) return { kind: 'iframe', src: `https://embed.nicovideo.jp/watch/${id}`, title: 'ニコニコ動画' }
  }
  if (host === 'vimeo.com') {
    const id = url.pathname.match(/^\/(\d+)/)?.[1]
    if (id) return { kind: 'iframe', src: `https://player.vimeo.com/video/${id}`, title: 'Vimeo動画' }
  }
  if (/\.(mp4|webm|mov)$/i.test(url.pathname)) return { kind: 'video', src: url.toString() }
  return { kind: 'link', url: url.toString(), host }
}

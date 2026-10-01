import type { CSSProperties } from 'react'
import { BACKGROUND_IMAGE_URL } from '@/lib/background'

// ポートフォリオページのデザイン設定（profiles.page_background / cover_image_url / portfolio_videos）

export type PageBackground = {
  type: 'preset' | 'color' | 'image'
  value: string
  overlay?: number // 背景の上に重ねる白いベールの濃さ（0〜80%）
}

export type PortfolioVideo = { youtubeId: string; title?: string }

export const MAX_PORTFOLIO_VIDEOS = 6

// 背景のプリセット（画像を用意しなくても選べるよう、空以外はCSSのグラデーションで作る）
export const BACKGROUND_PRESETS: { key: string; label: string; css: string; dark?: boolean }[] = [
  {
    key: 'sky',
    label: '青空',
    css: `linear-gradient(180deg, rgba(56,189,248,0.35) 0%, rgba(224,242,254,0.25) 45%, rgba(255,255,255,0.1) 100%), url(${BACKGROUND_IMAGE_URL})`,
  },
  { key: 'sunset', label: '夕焼け', css: 'linear-gradient(160deg, #fde68a 0%, #fca5a5 45%, #c4b5fd 100%)' },
  { key: 'sakura', label: '桜', css: 'radial-gradient(circle at 20% 20%, #fff1f2 0%, transparent 40%), linear-gradient(160deg, #fbcfe8 0%, #fce7f3 50%, #fff7ed 100%)' },
  { key: 'mint', label: 'ミント', css: 'linear-gradient(160deg, #a7f3d0 0%, #ccfbf1 50%, #e0f2fe 100%)' },
  { key: 'lavender', label: 'ラベンダー', css: 'linear-gradient(160deg, #ddd6fe 0%, #ede9fe 45%, #fce7f3 100%)' },
  {
    key: 'night',
    label: '夜空',
    css: 'radial-gradient(1px 1px at 20% 30%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 70% 60%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 40% 80%, #fde68a 50%, transparent 51%), radial-gradient(1px 1px at 85% 15%, #fff 50%, transparent 51%), linear-gradient(180deg, #0f172a 0%, #312e81 60%, #6d28d9 100%)',
    dark: true,
  },
  {
    key: 'paper',
    label: 'ドット紙',
    css: 'radial-gradient(#cbd5e1 1px, transparent 1px) 0 0 / 18px 18px, #f8fafc',
  },
  { key: 'mono', label: 'モノクロ', css: 'linear-gradient(160deg, #f1f5f9 0%, #e2e8f0 100%)' },
]

export const DEFAULT_BACKGROUND: PageBackground = { type: 'preset', value: 'sky', overlay: 0 }

export function normalizeBackground(raw: unknown): PageBackground {
  if (!raw || typeof raw !== 'object') return DEFAULT_BACKGROUND
  const r = raw as Record<string, unknown>
  const type = r.type === 'color' || r.type === 'image' || r.type === 'preset' ? r.type : 'preset'
  const value = typeof r.value === 'string' && r.value ? r.value : 'sky'
  const overlay = typeof r.overlay === 'number' ? Math.min(80, Math.max(0, r.overlay)) : 0
  return { type, value, overlay }
}

const isSafeColor = (v: string) => /^#[0-9a-fA-F]{3,8}$/.test(v)
const isSafeImageUrl = (v: string) => /^https:\/\/[^\s"'()]+$/.test(v)

// ページ全体の背景のスタイル。値は本人が自由に入れられるので、色と https の画像URL以外は使わない
export function backgroundStyle(bg: PageBackground): CSSProperties {
  const veil = bg.overlay ? `linear-gradient(rgba(255,255,255,${bg.overlay / 100}), rgba(255,255,255,${bg.overlay / 100})), ` : ''
  if (bg.type === 'color' && isSafeColor(bg.value)) {
    return { background: `${veil}${bg.value}` }
  }
  if (bg.type === 'image' && isSafeImageUrl(bg.value)) {
    return { background: `${veil}url("${bg.value}") center / cover fixed no-repeat` }
  }
  const preset = BACKGROUND_PRESETS.find((p) => p.key === bg.value) || BACKGROUND_PRESETS[0]
  return { background: `${veil}${preset.css}`, backgroundSize: preset.key === 'sky' ? 'cover' : undefined, backgroundPosition: 'center' }
}

export const isDarkBackground = (bg: PageBackground) =>
  bg.type === 'preset' && !!BACKGROUND_PRESETS.find((p) => p.key === bg.value)?.dark && (bg.overlay ?? 0) < 40

// YouTubeのURL（watch / youtu.be / shorts / embed / live）から動画IDを取り出す
export function parseYouTubeId(input: string): string | null {
  const text = input.trim()
  if (/^[\w-]{11}$/.test(text)) return text
  try {
    const url = new URL(text)
    const host = url.hostname.replace(/^www\.|^m\./, '')
    if (host === 'youtu.be') return url.pathname.slice(1, 12) || null
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = url.searchParams.get('v')
      if (v && /^[\w-]{11}$/.test(v)) return v
      const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)
      if (match) return match[1]
    }
  } catch {
    return null
  }
  return null
}

export const normalizeVideos = (raw: unknown): PortfolioVideo[] =>
  Array.isArray(raw)
    ? raw
        .filter((v) => v && typeof v.youtubeId === 'string' && /^[\w-]{11}$/.test(v.youtubeId))
        .slice(0, MAX_PORTFOLIO_VIDEOS)
        .map((v) => ({ youtubeId: v.youtubeId, title: typeof v.title === 'string' ? v.title : '' }))
    : []

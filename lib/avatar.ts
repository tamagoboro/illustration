import { supabase } from '@/lib/supabase'

// 登録時のアイコンまわり（プリセットアイコン・アップロード）。
// メールでの新規登録（app/login）と、Googleで入った直後の初期設定（app/welcome）で共用する。

// アップロード不要で選べるプリセットアイコン（絵文字＋グラデーションのSVGをその場で生成）
export const AVATAR_PRESETS: { id: string; emoji: string; colors: [string, string] }[] = [
  { id: 'cloud', emoji: '☁️', colors: ['#38bdf8', '#22d3ee'] },
  { id: 'palette', emoji: '🎨', colors: ['#fb923c', '#f59e0b'] },
  { id: 'pencil', emoji: '✏️', colors: ['#60a5fa', '#818cf8'] },
  { id: 'star', emoji: '⭐', colors: ['#f472b6', '#fb7185'] },
  { id: 'brush', emoji: '🖌️', colors: ['#34d399', '#10b981'] },
  { id: 'sparkle', emoji: '💫', colors: ['#a78bfa', '#8b5cf6'] },
]

export const buildAvatarDataUrl = (colors: [string, string], emoji: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient></defs><rect width="200" height="200" rx="100" fill="url(#g)"/><text x="50%" y="54%" font-size="96" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// アップロードされた画像をアイコン用に軽量化（600px・webp）してからStorageへ保存する
const compressAvatarImage = (file: File, maxWidth = 600, quality = 0.85): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error('ファイルサイズが大きすぎます（10MB以下の画像を選択してください）'))
      return
    }
    if (!file.type.startsWith('image/')) {
      reject(new Error('画像ファイルを選択してください'))
      return
    }

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('画像の処理に失敗しました'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('画像の圧縮に失敗しました'))),
        'image/webp',
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('画像の読み込みに失敗しました。別の画像でお試しください。'))
    }
    img.src = objectUrl
  })
}

export const uploadCustomAvatar = async (userId: string, file: File): Promise<string> => {
  const blob = await compressAvatarImage(file)
  const fileName = `${userId}/avatar_${Date.now()}.webp`
  const { error: uploadError } = await supabase.storage
    .from('portfolios')
    .upload(fileName, blob, { contentType: 'image/webp', upsert: true })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('portfolios').getPublicUrl(fileName)
  return data.publicUrl
}

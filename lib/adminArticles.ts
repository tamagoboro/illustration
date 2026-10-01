import { supabase } from './supabase'
import { convertToWebp } from './imageUtils'

// 記事の記入ページで使う部品（管理者専用）

// 記事の画像をアップロードし、公開URLを返す（portfolios バケットの articles/ 。管理者はどこにでも置ける）
export async function uploadArticleImage(file: File, maxDimension = 1600) {
  if (!file.type.startsWith('image/')) throw new Error('画像ファイルを選んでください')
  if (file.size > 15 * 1024 * 1024) throw new Error('15MB以下の画像を選んでください')
  // GIFはアニメーションが消えないよう、そのまま上げる
  const isGif = file.type === 'image/gif'
  const blob = isGif ? file : await convertToWebp(file, 0.85, maxDimension)
  const path = `articles/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${isGif ? 'gif' : 'webp'}`
  const { error } = await supabase.storage.from('portfolios').upload(path, blob, { contentType: isGif ? 'image/gif' : 'image/webp' })
  if (error) throw error
  return supabase.storage.from('portfolios').getPublicUrl(path).data.publicUrl
}

// 保存した記事を、公開ページにすぐ反映させる（失敗しても5分以内には反映される）
export async function refreshArticlePages(slugs: string[]) {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    await fetch('/api/articles/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ slugs }),
    })
  } catch (e) {
    console.error('記事ページの更新エラー:', e)
  }
}

import { supabase } from './supabase'

const LOCAL_KEY = 'favorite_creators'

function getLocalFavorites(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(LOCAL_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (e) {
    console.error('お気に入り(ローカル)の読み込みエラー:', e)
    return []
  }
}

function setLocalFavorites(ids: string[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LOCAL_KEY, JSON.stringify(ids))
}

// ログイン中ならアカウントに保存されたお気に入り一覧を返す（未ログイン時はローカル保存分を返す）。
// ログイン直後で、まだローカルにだけお気に入りが残っている場合は、ここで一度だけアカウントへ引き継ぐ。
export async function loadFavorites(viewerId: string | null): Promise<string[]> {
  if (!viewerId) return getLocalFavorites()

  const localIds = getLocalFavorites()
  if (localIds.length > 0) {
    const rows = localIds.map((creatorId) => ({ user_id: viewerId, creator_id: creatorId }))
    const { error } = await supabase
      .from('favorite_creators')
      .upsert(rows, { onConflict: 'user_id,creator_id', ignoreDuplicates: true })

    if (!error) {
      setLocalFavorites([])
    } else {
      console.error('お気に入りのアカウント引き継ぎエラー:', error)
    }
  }

  const { data, error } = await supabase
    .from('favorite_creators')
    .select('creator_id')
    .eq('user_id', viewerId)

  if (error) {
    console.error('お気に入り一覧の取得エラー:', error)
    return []
  }

  return (data || []).map((row) => row.creator_id as string)
}

// お気に入りの追加/解除。ログイン中はDB、未ログイン中はローカルに保存する。
// 戻り値は処理後の「お気に入りかどうか」。
export async function toggleFavoriteRecord(
  viewerId: string | null,
  creatorId: string,
  isCurrentlyFavorite: boolean
): Promise<boolean> {
  if (!viewerId) {
    const current = getLocalFavorites()
    const next = isCurrentlyFavorite
      ? current.filter((cid) => cid !== creatorId)
      : [...current, creatorId]
    setLocalFavorites(next)
    return !isCurrentlyFavorite
  }

  if (isCurrentlyFavorite) {
    const { error } = await supabase
      .from('favorite_creators')
      .delete()
      .eq('user_id', viewerId)
      .eq('creator_id', creatorId)

    if (error) {
      console.error('お気に入り解除エラー:', error)
      return isCurrentlyFavorite
    }
    return false
  }

  const { error } = await supabase
    .from('favorite_creators')
    .insert({ user_id: viewerId, creator_id: creatorId })

  if (error) {
    console.error('お気に入り追加エラー:', error)
    return isCurrentlyFavorite
  }
  return true
}

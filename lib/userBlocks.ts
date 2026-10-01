import { supabase } from '@/lib/supabase'

// ブロック・ミュート（user_blocks / supabase/improve_feed.sql）。
//   mute  … 相手の投稿・コメントを自分の画面に出さない。相手には伝わらない
//   block … ミュートに加えて、相手は自分の投稿にコメント・いいねできず、自分をフォローできない（DBのトリガーで止める）
export type BlockKind = 'block' | 'mute'

export const BLOCK_KIND_LABELS: Record<BlockKind, string> = {
  block: 'ブロック',
  mute: 'ミュート',
}

// 自分がブロック・ミュートしている相手の一覧（相手のユーザーID → 種類）
export async function loadUserBlocks(userId: string): Promise<Record<string, BlockKind>> {
  const { data, error } = await supabase.from('user_blocks').select('target_id, kind').eq('user_id', userId)
  if (error) {
    console.error('ブロック・ミュートの取得エラー:', error)
    return {}
  }
  const map: Record<string, BlockKind> = {}
  ;(data || []).forEach((row: any) => {
    map[row.target_id] = row.kind
  })
  return map
}

// ブロック／ミュートする。すでにどちらかを設定済みの相手は、指定した種類に切り替わる
export async function setUserBlock(userId: string, targetId: string, kind: BlockKind) {
  const { error } = await supabase
    .from('user_blocks')
    .upsert({ user_id: userId, target_id: targetId, kind }, { onConflict: 'user_id,target_id' })
  if (error) console.error('ブロック・ミュートの設定エラー:', error)
  return !error
}

export async function removeUserBlock(userId: string, targetId: string) {
  const { error } = await supabase.from('user_blocks').delete().eq('user_id', userId).eq('target_id', targetId)
  if (error) console.error('ブロック・ミュートの解除エラー:', error)
  return !error
}

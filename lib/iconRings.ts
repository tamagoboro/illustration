import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// アイコンリングのカタログはDB(icon_rings テーブル)で管理し、
// 管理画面（/admin/rings）からイラストレーター制作の画像を追加・入れ替えできる。
// 購入時の消費ポイントもDB側の値が優先される（supabase/add_icon_rings_admin.sql の purchase_ring 関数を参照）。
export type IconRing = {
  id: string
  name: string
  cost: number
  image: string
}

let cache: IconRing[] | null = null
let inflight: Promise<IconRing[]> | null = null

const mapRow = (row: any): IconRing => ({
  id: row.id,
  name: row.name,
  cost: row.cost,
  image: row.image_url,
})

async function loadIconRings(): Promise<IconRing[]> {
  if (cache) return cache
  if (inflight) return inflight

  inflight = supabase
    .from('icon_rings')
    .select('*')
    .order('sort_order', { ascending: true })
    .then(({ data, error }) => {
      inflight = null
      if (error || !data) {
        console.error('アイコンリング一覧の取得に失敗しました:', error)
        return []
      }
      cache = data.map(mapRow)
      return cache
    })

  return inflight
}

// 管理画面での追加・編集・削除後に呼び、次回参照時にDBから取り直させる
export function invalidateIconRingsCache() {
  cache = null
  inflight = null
}

// カタログ一覧を取得するフック（/rewards のショップ表示や管理画面で使用）
export function useIconRings() {
  const [rings, setRings] = useState<IconRing[]>(cache || [])

  useEffect(() => {
    let mounted = true
    loadIconRings().then((r) => {
      if (mounted) setRings(r)
    })
    return () => {
      mounted = false
    }
  }, [])

  return rings
}

// 特定のリングIDから情報を引くフック（AvatarRing など、装着中リングの画像表示に使用）
export function useIconRing(ringId: string | null | undefined): IconRing | null {
  const rings = useIconRings()
  if (!ringId) return null
  return rings.find((r) => r.id === ringId) || null
}

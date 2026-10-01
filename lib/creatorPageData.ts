import { supabase } from '@/lib/supabase'
import { normalizeSoulListing, SoulListing } from '@/lib/soulListings'

// クリエイターページ（app/creator/[id]）の表示に必要なデータをまとめて読み込む。
// 公開中のページはサーバーで、非公開ページの本人プレビューはブラウザで、同じ処理を使う。
// プロフィールが存在しなければ null を返す（公開・非公開の判定は呼び出し側で行う）。
export async function loadCreatorPageData(id: string) {
  // 互いに依存しないクエリはPromise.allでまとめて並行実行し、サーバー応答を高速化する
  // （直列だと1件ずつ待つ分だけページの初期表示が遅くなっていた）
  const [profileRes, worksRes, formsRes, reviewRowsRes, creatorRingRes, soulsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', id).single(),
    supabase.from('portfolio_items').select('*').eq('user_id', id).order('sort_order', { ascending: true }),
    // 複数の見積もりフォームに対応。新形式（estimate_forms）が無ければ
    // 旧形式（profiles.form_config）を1件だけのフォームとして扱う（後方互換）
    supabase.from('estimate_forms').select('*').eq('user_id', id).order('sort_order', { ascending: true }),
    // レビュー・評価。reviewer_id は auth.users のみ参照しており profiles を
    // 持たない一般ユーザーも投稿できるため、表示名・アイコンは別クエリで取得して手動で合成する
    supabase.from('reviews').select('*').eq('creator_id', id).order('created_at', { ascending: false }),
    // クリエイター本人の装着中アイコンリング
    supabase.from('public_equipped_rings').select('equipped_ring_id').eq('user_id', id).maybeSingle(),
    // 魂募集（表示するのは掲載期間内で募集中のものだけ。判定は表示側で行う）
    supabase.from('soul_listings').select('*').eq('user_id', id).order('sort_order', { ascending: true }),
  ])

  const profile = profileRes.data
  if (!profile) return null

  const initialWorks = worksRes.data
  const estimateForms = formsRes.data
  const reviewRows = reviewRowsRes.data
  const creatorRingRow = creatorRingRes.data
  const initialSouls: SoulListing[] = (soulsRes.data || []).map(normalizeSoulListing)

  let reviewerProfileMap: Record<string, { display_name: string | null; avatar_url: string | null }> = {}
  let reviewerRingMap: Record<string, string> = {}
  if (reviewRows && reviewRows.length > 0) {
    const reviewerIds = Array.from(new Set(reviewRows.map((r) => r.reviewer_id)))
    const { data: reviewerProfiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', reviewerIds)

    reviewerProfileMap = Object.fromEntries(
      (reviewerProfiles || []).map((p) => [p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url }])
    )

    // アイコンリング（装着中のもののみ、残高は含まない公開ビューから取得）
    const { data: reviewerRings } = await supabase
      .from('public_equipped_rings')
      .select('user_id, equipped_ring_id')
      .in('user_id', reviewerIds)

    reviewerRingMap = Object.fromEntries(
      (reviewerRings || []).map((r) => [r.user_id, r.equipped_ring_id as string])
    )
  }

  const initialReviews = (reviewRows || []).map((r) => ({
    ...r,
    reviewer_display_name: reviewerProfileMap[r.reviewer_id]?.display_name || null,
    reviewer_avatar_url: reviewerProfileMap[r.reviewer_id]?.avatar_url || null,
    reviewer_ring_id: reviewerRingMap[r.reviewer_id] || null,
  }))

  const creatorRingId = creatorRingRow?.equipped_ring_id || null

  return {
    profile,
    initialWorks: initialWorks || [],
    estimateForms: estimateForms || [],
    initialReviews,
    creatorRingId,
    initialSouls,
  }
}

export type CreatorPageData = NonNullable<Awaited<ReturnType<typeof loadCreatorPageData>>>

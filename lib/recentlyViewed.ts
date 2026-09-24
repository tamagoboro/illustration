// 「最近見たクリエイター」履歴。DBやAIを使わず、ブラウザのlocalStorageだけで完結させる。
// 比較検討中に見失ったクリエイターへすぐ戻れるようにするための、依頼者向けの導線。

const STORAGE_KEY = 'drawker_recently_viewed_v1'
const MAX_ITEMS = 8

export type RecentlyViewedCreator = {
  userId: string
  displayName: string
  avatarUrl: string | null
  thumbnailUrl: string | null
  viewedAt: number
}

export function recordRecentlyViewed(creator: Omit<RecentlyViewedCreator, 'viewedAt'>) {
  try {
    const list = getRecentlyViewed().filter((c) => c.userId !== creator.userId)
    list.unshift({ ...creator, viewedAt: Date.now() })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ITEMS)))
  } catch (e) {
    // noop（プライベートブラウジング等でlocalStorageが使えない場合も機能に支障は出さない）
  }
}

export function getRecentlyViewed(): RecentlyViewedCreator[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

export function clearRecentlyViewed() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    // noop
  }
}

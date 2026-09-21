// 見積もりシミュレーター・リクエストフォームの入力途中保存（ブラウザのlocalStorageのみ）。
// サーバーには送らないため、同じ端末・同じブラウザでの再開にのみ対応する。
// プライベートブラウジング等でlocalStorageが使えない場合も機能に支障が出ないよう握りつぶす。

const PREFIX = 'drawker_draft_'

export function saveDraft<T>(key: string, data: T) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data))
  } catch (e) {
    // noop
  }
}

export function loadDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch (e) {
    return null
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch (e) {
    // noop
  }
}

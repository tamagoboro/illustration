// 「ログインしたあとに戻るページ」の記録。
// 依頼リクエスト・フォロー・コメントなどでログインを求められたとき、ログイン後にトップページへ飛ばすと
// 見ていたクリエイターのページに戻れず迷子になる。そこで、最後に見ていたページを覚えておき、
// ログイン・新規登録のあとはそこへ戻す。
//
// ログインへのリンクは各所にあるので、リンクごとに戻り先を付けるのではなく、
// components/SessionGuard.tsx がページを移動するたびにここへ記録する。
// sessionStorage を使うので、タブを閉じれば消える。

const RETURN_PATH_KEY = 'drawker:returnTo'
// 新規登録の画面で選んでいた利用方法（Googleで登録する場合に、戻ってきたあとの初期設定画面へ引き継ぐ）
const SIGNUP_TYPE_KEY = 'drawker:signupType'

// ここ自体へは戻さないページ（ログイン・登録の途中の画面）
const NOT_RETURNABLE_PREFIXES = ['/login', '/reset-password', '/auth', '/welcome']

// サイト内の相対パスだけを許可する（外部サイトへ飛ばされるのを防ぐ）
export const isSafeInternalPath = (path: unknown): path is string =>
  typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')

export const isReturnablePath = (path: string) => !NOT_RETURNABLE_PREFIXES.some((prefix) => path.startsWith(prefix))

export function saveReturnPath(path: string) {
  if (!isSafeInternalPath(path) || !isReturnablePath(path)) return
  try {
    sessionStorage.setItem(RETURN_PATH_KEY, path)
  } catch {
    // sessionStorage が使えない環境では、戻り先なし（トップページへ）で動く
  }
}

// 記録しておいた戻り先。無ければ fallback（既定はトップページ）
export function readReturnPath(fallback = '/'): string {
  try {
    const path = sessionStorage.getItem(RETURN_PATH_KEY)
    return isSafeInternalPath(path) && isReturnablePath(path) ? path : fallback
  } catch {
    return fallback
  }
}

export function saveSignupType(type: 'client' | 'creator' | null) {
  try {
    if (type) sessionStorage.setItem(SIGNUP_TYPE_KEY, type)
    else sessionStorage.removeItem(SIGNUP_TYPE_KEY)
  } catch {
    // 保存できなくても、初期設定の画面で選び直せる
  }
}

export function readSignupType(): 'client' | 'creator' | null {
  try {
    const type = sessionStorage.getItem(SIGNUP_TYPE_KEY)
    return type === 'client' || type === 'creator' ? type : null
  } catch {
    return null
  }
}

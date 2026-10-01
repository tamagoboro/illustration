import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

export type AccountType = 'client' | 'creator'

// 新しいプロフィール行の初期値（表示名・アイコン・利用方法以外）
const NEW_PROFILE_DEFAULTS = {
  status: 'available',
  theme_color: 'indigo',
  tastes: [],
  menu_items: [],
  sns_links: [],
  lead_time_days: 14,
  commercial_use_allowed: true,
  ai_learning_allowed: false,
  express_option_available: false,
  copyright_transfer_available: false,
  r18_allowed: false,
  campaign_enabled: false,
}

// 新規登録フォームで決めた表示名・アイコンをprofilesテーブルへ反映する。
// メール確認が必須な設定の場合、signUp直後はまだセッションが無くDBへ書き込めないため、
// （書き込みにはauth.uid()が必要）確認後の初回ログイン時にもここを呼び、
// user_metadataに保存しておいた値から埋める。既にprofilesの行がある場合は何もしない。
// 今回プロフィールを新しく作ったときだけ true を返す（＝登録後の最初のログイン。行き先を決めるのに使う）。
export async function ensureProfileFromSignupMetadata(user: User): Promise<boolean> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return false

  const meta = user.user_metadata || {}
  const displayName = typeof meta.display_name === 'string' ? meta.display_name.trim() : ''
  if (!displayName) return false

  // 新規登録時に選んだ「依頼者/クリエイター」で初期状態を分ける。
  // クリエイターを選んだ場合のみ、最初から一覧に公開しダッシュボード導線を表示する。
  // 依頼者を選んだ場合も、あとからダッシュボードで保存すればいつでもクリエイター化できる。
  const isCreator = meta.account_type === 'creator'

  const { error } = await supabase.from('profiles').upsert(
    {
      ...NEW_PROFILE_DEFAULTS,
      user_id: user.id,
      is_public: isCreator,
      has_dashboard_setup: isCreator,
      display_name: displayName,
      avatar_url: typeof meta.avatar_url === 'string' ? meta.avatar_url : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) console.error('プロフィール作成エラー:', error)
  return !error
}

// 登録を終えた直後のプロフィールに、選んだ内容（表示名・アイコン・依頼者/クリエイター）を反映する。
// メールでの新規登録の直後（app/login）と、Googleで入った直後の初期設定（app/welcome）で使う。
//
// auth.users への登録時点で、DBのトリガー（handle_new_user）が profiles の行を先に作る
// （表示名だけが入り、アイコンは空、is_public / has_dashboard_setup は列の既定値のまま）。
// そのため「行が無ければ作る」だけでは、選んだアイコンや「クリエイターとして利用する」が反映されない。
// ここでは、行があれば上書きし、無ければ新しく作る。
//
// 登録直後にだけ呼ぶこと。あとから呼ぶと、本人がダッシュボードで変えた公開設定を上書きしてしまう。
export async function completeProfileSetup(
  userId: string,
  values: { displayName: string; avatarUrl: string | null; accountType: AccountType }
): Promise<boolean> {
  const isCreator = values.accountType === 'creator'
  const chosen = {
    display_name: values.displayName.trim(),
    avatar_url: values.avatarUrl,
    is_public: isCreator,
    has_dashboard_setup: isCreator,
    updated_at: new Date().toISOString(),
  }

  const { data: existing, error: selectError } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (selectError) {
    console.error('プロフィール取得エラー:', selectError)
    return false
  }

  const { error } = existing
    ? await supabase.from('profiles').update(chosen).eq('user_id', userId)
    : await supabase.from('profiles').insert({ ...NEW_PROFILE_DEFAULTS, ...chosen, user_id: userId })
  if (error) console.error('プロフィール設定エラー:', error)
  return !error
}

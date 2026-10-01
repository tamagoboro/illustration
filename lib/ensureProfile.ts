import { supabase } from './supabase'
import type { SupabaseClient, User } from '@supabase/supabase-js'

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
      user_id: user.id,
      is_public: isCreator,
      has_dashboard_setup: isCreator,
      display_name: displayName,
      status: 'available',
      theme_color: 'indigo',
      tastes: [],
      menu_items: [],
      sns_links: [],
      lead_time_days: 14,
      commercial_use_allowed: true,
      avatar_url: typeof meta.avatar_url === 'string' ? meta.avatar_url : null,
      ai_learning_allowed: false,
      express_option_available: false,
      copyright_transfer_available: false,
      r18_allowed: false,
      campaign_enabled: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) console.error('プロフィール作成エラー:', error)
  return !error
}

// Google等のOAuthログインでは、auth.usersへのINSERT時点でDBトリガー（handle_new_user）が
// display_name空欄のままprofilesの行を自動作成してしまう（このトリガーはraw_user_meta_data->>'display_name'
// しか見ないため、GoogleがくれるフルネームやアイコンURLは反映されない）。
// そのため、こちらはメール登録の ensureProfileFromSignupMetadata とは別に、
// 「行はすでにあるが表示名が空」のケースをOAuthのuser_metadataから埋める。
// 呼び出し元（サーバー側/ブラウザ側）でSupabaseクライアントのインスタンスが異なるため引数で受け取る。
export async function fillProfileFromOAuthMetadata(client: SupabaseClient, user: User) {
  const { data: existing } = await client
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!existing) return
  if (existing.display_name && existing.display_name.trim()) return

  const meta = user.user_metadata || {}
  const displayName =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    (typeof user.email === 'string' && user.email.split('@')[0]) ||
    'ユーザー'
  const avatarUrl =
    existing.avatar_url ||
    (typeof meta.avatar_url === 'string' ? meta.avatar_url : null) ||
    (typeof meta.picture === 'string' ? meta.picture : null)

  await client
    .from('profiles')
    .update({ display_name: displayName, avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
}

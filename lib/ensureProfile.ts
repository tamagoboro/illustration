import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

// 新規登録フォームで決めた表示名・アイコンをprofilesテーブルへ反映する。
// メール確認が必須な設定の場合、signUp直後はまだセッションが無くDBへ書き込めないため、
// （書き込みにはauth.uid()が必要）確認後の初回ログイン時にもここを呼び、
// user_metadataに保存しておいた値から埋める。既にprofilesの行がある場合は何もしない。
export async function ensureProfileFromSignupMetadata(user: User) {
  const { data: existing } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return

  const meta = user.user_metadata || {}
  const displayName = typeof meta.display_name === 'string' ? meta.display_name.trim() : ''
  if (!displayName) return

  await supabase.from('profiles').upsert(
    {
      user_id: user.id,
      is_public: true,
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
}

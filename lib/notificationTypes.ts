// 通知の種類（notifications.type）と、Discord通知の設定画面に出す名前。
// supabase/add_soul_listings_and_discord.sql の notification_settings.discord_types の初期値と合わせる。
export type NotificationTypeOption = { type: string; label: string; description: string }

export const NOTIFICATION_TYPE_GROUPS: { title: string; items: NotificationTypeOption[] }[] = [
  {
    title: '依頼・応募',
    items: [
      { type: 'new_request', label: '新しいリクエスト', description: '依頼者からリクエストが届いたとき' },
      { type: 'soul_application', label: '魂募集への応募', description: '魂募集イラストに応募があったとき' },
      { type: 'request_response', label: 'リクエストへの返信', description: '自分が送ったリクエストが承諾・辞退されたとき' },
      { type: 'new_review', label: 'レビュー', description: 'レビューが投稿されたとき' },
    ],
  },
  {
    title: 'ファンからの反応',
    items: [
      { type: 'new_follower', label: 'フォロー', description: '誰かにフォローされたとき' },
      { type: 'new_favorite', label: 'お気に入り登録', description: '誰かがお気に入りに追加したとき' },
      { type: 'post_like', label: 'フィード投稿へのいいね', description: 'フィードの投稿にいいねされたとき' },
      { type: 'post_comment', label: 'フィード投稿へのコメント', description: 'フィードの投稿にコメントされたとき' },
    ],
  },
  {
    title: 'フォロー中のクリエイター',
    items: [
      { type: 'favorite_creator_available', label: '受付再開', description: 'フォロー・お気に入り中のクリエイターが受付を再開したとき' },
      { type: 'follow_new_post', label: 'フィード投稿', description: 'フォロー中のクリエイターが投稿したとき' },
      { type: 'follow_campaign', label: 'キャンペーン開始', description: 'フォロー中のクリエイターがキャンペーンを始めたとき' },
    ],
  },
  {
    title: 'その他',
    items: [
      { type: 'referral_signup', label: '紹介ボーナス', description: '紹介リンクから新しい登録があったとき' },
      { type: 'portfolio_image_broken', label: '作品画像のエラー', description: '登録した作品画像が表示できなくなったとき' },
    ],
  },
]

export const ALL_NOTIFICATION_TYPES = NOTIFICATION_TYPE_GROUPS.flatMap((g) => g.items.map((i) => i.type))

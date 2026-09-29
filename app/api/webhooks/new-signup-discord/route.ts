import { NextResponse } from 'next/server'

// Supabaseの Database Webhook（profilesテーブル・INSERT）から呼ばれ、新規登録があった
// たびにDiscordへ通知する。app/api/webhooks/new-creator/route.ts（X自動投稿用）と同じ
// 仕組みの上に、別の通知先を追加したもの。Supabase側の設定で、同じ「profiles / INSERT」
// イベントに対して、この関数とnew-creatorの2つのWebhookを両方登録すればよい
// （1つのイベントに複数のWebhook URLを登録できる）。
//
// 注意: このWebhookは auth.usersの作成に連動してprofilesの行ができた瞬間（handle_new_user
// トリガー）に発火する。メール登録は display_name がこの時点で正しく入っているが、
// Googleログインでの新規登録は、display_nameが空のまま届く（Googleの名前で埋める処理は
// この後に別途走るため）。その場合は「（表示名未設定）」と表示する。
export async function POST(req: Request) {
  try {
    // 1. セキュリティチェック（new-creatorと同じSecretを共用）
    const authHeader = req.headers.get('x-webhook-secret')
    if (authHeader !== process.env.SUPABASE_WEBHOOK_SECRET) {
      console.warn('Webhook認証エラー: Secretキーが一致しません')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    // 2. 初回登録（INSERT）のみ実行
    if (body.type !== 'INSERT') {
      return NextResponse.json({ message: 'Skipped: Not an INSERT event' }, { status: 200 })
    }

    const profile = body.record
    if (!profile || !profile.user_id) {
      return NextResponse.json({ message: 'No profile data found' }, { status: 400 })
    }

    const webhookUrl = process.env.DISCORD_NEW_USER_WEBHOOK_URL
    if (!webhookUrl) {
      console.error('DISCORD_NEW_USER_WEBHOOK_URL が設定されていません')
      return NextResponse.json({ error: 'Discord webhook URL is missing' }, { status: 500 })
    }

    const displayName = profile.display_name?.trim() || '（表示名未設定）'
    const profileUrl = `https://drawker.com/creator/${profile.user_id}`

    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `🎉 新規登録がありました\n**${displayName}**\n${profileUrl}`,
      }),
    })

    if (!discordRes.ok) {
      const errText = await discordRes.text()
      console.error('Discord通知エラー:', discordRes.status, errText)
      return NextResponse.json({ error: 'Failed to notify Discord' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('新規登録Discord通知エラー:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

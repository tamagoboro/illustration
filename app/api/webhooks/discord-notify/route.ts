import { NextResponse } from 'next/server'
import { createServiceClient, decryptSecret, sendDiscordMessage } from '@/lib/discordServer'
import { ALL_NOTIFICATION_TYPES } from '@/lib/notificationTypes'

// Supabaseの Database Webhook（notificationsテーブル・INSERT）から呼ばれ、
// 通知の宛先ユーザーがDiscord Webhookを設定していて、その種類の通知をオンにしている場合だけDiscordへ送る。
// 他のWebhook（new-creator / new-signup-discord）と同じく x-webhook-secret ヘッダーで呼び出し元を確認する。
export const runtime = 'nodejs'

type NotificationRecord = {
  user_id: string
  type: string
  title: string
  body: string | null
  link_url: string | null
}

export async function POST(req: Request) {
  if (req.headers.get('x-webhook-secret') !== process.env.SUPABASE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (body?.type !== 'INSERT' || !body.record?.user_id) {
    return NextResponse.json({ message: 'Skipped' })
  }
  const record = body.record as NotificationRecord

  const admin = createServiceClient()
  const [{ data: webhook }, { data: settings }] = await Promise.all([
    admin.from('discord_webhooks').select('encrypted_url').eq('user_id', record.user_id).maybeSingle(),
    admin.from('notification_settings').select('discord_enabled, discord_types').eq('user_id', record.user_id).maybeSingle(),
  ])

  if (!webhook) return NextResponse.json({ message: 'No webhook' })
  // 設定の行が無い＝初期設定のまま（全種類オン）
  const enabled = settings?.discord_enabled ?? true
  const types: string[] = settings?.discord_types ?? ALL_NOTIFICATION_TYPES
  if (!enabled || !types.includes(record.type)) {
    return NextResponse.json({ message: 'Disabled by user setting' })
  }

  try {
    const result = await sendDiscordMessage(decryptSecret(webhook.encrypted_url), {
      title: record.title,
      body: record.body,
      linkUrl: record.link_url,
    })
    // 404 = Discord側でWebhookが削除済み。以降送れないので保存分も消し、設定画面で「未設定」に戻す
    if (result.status === 404) {
      await Promise.all([
        admin.from('discord_webhooks').delete().eq('user_id', record.user_id),
        admin.from('notification_settings').update({ discord_webhook_hint: null }).eq('user_id', record.user_id),
      ])
    }
    return NextResponse.json({ sent: result.ok, status: result.status })
  } catch (e) {
    console.error('Discord通知の送信エラー:', e)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}

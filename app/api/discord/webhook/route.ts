import { NextResponse } from 'next/server'
import {
  createServiceClient,
  encryptSecret,
  decryptSecret,
  getServerConfigError,
  getUserFromRequest,
  isDiscordWebhookUrl,
  maskWebhookUrl,
  sendDiscordMessage,
} from '@/lib/discordServer'

// ログイン中のユーザーが、自分のDiscord Webhookを登録・テスト送信・解除するためのAPI。
// Webhook URLはここで暗号化してから保存し、ブラウザに返すのは伏せ字（hint）だけ。
export const runtime = 'nodejs'

const unauthorized = () => NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

// 想定外のエラーでも、画面に原因の分かる説明を返す（以前は500のHTMLが返り「通信に失敗しました」としか出なかった）
const withErrorHandling =
  (label: string, handler: (req: Request) => Promise<Response>) =>
  async (req: Request) => {
    try {
      const configError = getServerConfigError()
      if (configError) {
        console.error(`Discord Webhook ${label}: ${configError}`)
        return NextResponse.json({ error: configError }, { status: 500 })
      }
      return await handler(req)
    } catch (e) {
      console.error(`Discord Webhook ${label} エラー:`, e)
      return NextResponse.json(
        { error: `${label}に失敗しました（${(e as Error)?.message || '不明なエラー'}）。時間をおいて再度お試しください。` },
        { status: 500 }
      )
    }
  }

// 登録（保存前にテスト送信して、正しく届くURLかを確かめる）
export const POST = withErrorHandling('連携', async (req: Request) => {
  const user = await getUserFromRequest(req)
  if (!user) return unauthorized()

  const body = await req.json().catch(() => null)
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!isDiscordWebhookUrl(url)) {
    return NextResponse.json(
      { error: 'DiscordのWebhook URLの形式ではありません。「https://discord.com/api/webhooks/…」で始まるURLを貼り付けてください。' },
      { status: 400 }
    )
  }

  const test = await sendDiscordMessage(url, {
    title: '✅ Drawkerとの連携が完了しました',
    body: 'これから、選んだ種類の通知がこのチャンネルに届きます。',
    linkUrl: '/dashboard/notifications',
  })
  if (!test.ok) {
    return NextResponse.json(
      { error: 'このURLにメッセージを送れませんでした。Webhookが削除されていないか、URLが正しいか確認してください。' },
      { status: 400 }
    )
  }

  const admin = createServiceClient()
  const hint = maskWebhookUrl(url)
  const [{ error: saveError }, { error: settingsError }] = await Promise.all([
    admin
      .from('discord_webhooks')
      .upsert({ user_id: user.id, encrypted_url: encryptSecret(url), updated_at: new Date().toISOString() }),
    admin
      .from('notification_settings')
      .upsert({ user_id: user.id, discord_webhook_hint: hint, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }),
  ])
  if (saveError || settingsError) {
    console.error('Discord Webhook 保存エラー:', saveError || settingsError)
    // テーブルが無い（SQL未実行）などの原因が分かるよう、DBのエラー文も添える（秘密の値は含まれない）
    const reason = (saveError || settingsError)?.message
    return NextResponse.json({ error: `保存に失敗しました（${reason}）。` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, hint })
})

// テスト送信（保存済みのWebhookに送る）
export const PUT = withErrorHandling('テスト送信', async (req: Request) => {
  const user = await getUserFromRequest(req)
  if (!user) return unauthorized()

  const admin = createServiceClient()
  const { data } = await admin.from('discord_webhooks').select('encrypted_url').eq('user_id', user.id).maybeSingle()
  if (!data) return NextResponse.json({ error: 'Webhookがまだ設定されていません' }, { status: 404 })

  const result = await sendDiscordMessage(decryptSecret(data.encrypted_url), {
    title: '🔔 テスト通知',
    body: 'Drawkerからのテスト通知です。この通知が見えていれば設定は完了しています。',
    linkUrl: '/dashboard/notifications',
  })
  if (!result.ok) {
    return NextResponse.json(
      { error: '送信できませんでした。Discord側でWebhookが削除されている可能性があります。設定し直してください。' },
      { status: 400 }
    )
  }
  return NextResponse.json({ ok: true })
})

// 解除
export const DELETE = withErrorHandling('解除', async (req: Request) => {
  const user = await getUserFromRequest(req)
  if (!user) return unauthorized()

  const admin = createServiceClient()
  await Promise.all([
    admin.from('discord_webhooks').delete().eq('user_id', user.id),
    admin.from('notification_settings').update({ discord_webhook_hint: null }).eq('user_id', user.id),
  ])
  return NextResponse.json({ ok: true })
})

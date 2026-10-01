import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { createClient } from '@supabase/supabase-js'

// Discord Webhook URL の暗号化・送信（サーバー専用。ブラウザには絶対に読み込ませない）。
//
// Webhook URL を知っていれば誰でもそのチャンネルに書き込めてしまうため、DBには AES-256-GCM で
// 暗号化した文字列だけを保存する。鍵はDBではなく環境変数 DISCORD_WEBHOOK_ENCRYPTION_KEY にあるので、
// 万一DBの中身が見られても元のURLには戻せない。
//
// 必要な環境変数:
//   DISCORD_WEBHOOK_ENCRYPTION_KEY … 32バイトの乱数をbase64にしたもの
//     作り方: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//     ※ 一度決めたら変えないこと（変えると保存済みのWebhookが復号できなくなり、全員再設定が必要になる）
//   SUPABASE_SERVICE_ROLE_KEY      … discord_webhooks（RLSで誰も読めない）を読み書きするため

const ALGORITHM = 'aes-256-gcm'
const FORMAT_VERSION = 'v1'

const getKey = () => {
  const raw = process.env.DISCORD_WEBHOOK_ENCRYPTION_KEY
  if (!raw) throw new Error('DISCORD_WEBHOOK_ENCRYPTION_KEY が設定されていません')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('DISCORD_WEBHOOK_ENCRYPTION_KEY は32バイト（base64）である必要があります')
  return key
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [FORMAT_VERSION, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':')
}

export function decryptSecret(stored: string) {
  const [version, iv, tag, data] = stored.split(':')
  if (version !== FORMAT_VERSION || !iv || !tag || !data) throw new Error('暗号化データの形式が不正です')
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')
}

// Discordの公式Webhook URLだけを受け付ける（任意のURLに送らせる悪用を防ぐ）
const WEBHOOK_URL_PATTERN =
  /^https:\/\/(?:ptb\.|canary\.)?(?:discord\.com|discordapp\.com)\/api\/webhooks\/(\d{17,20})\/([\w-]{60,100})$/

export const isDiscordWebhookUrl = (url: string) => WEBHOOK_URL_PATTERN.test(url.trim())

// 設定済みのWebhookを本人が見分けられるよう、IDの一部と末尾4文字だけを見せる
export function maskWebhookUrl(url: string) {
  const match = url.trim().match(WEBHOOK_URL_PATTERN)
  if (!match) return '設定済み'
  const [, id, token] = match
  return `…/webhooks/${id.slice(0, 4)}…/••••${token.slice(-4)}`
}

export const createServiceClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY が設定されていません')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, { auth: { persistSession: false } })
}

// API呼び出し元のユーザーを、Authorization: Bearer <アクセストークン> から確認する
export async function getUserFromRequest(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://drawker.com').replace(/\/$/, '')

// Discordに埋め込み（カード）形式で送る。成功ならtrue、Webhookが削除済み等ならfalse
export async function sendDiscordMessage(
  webhookUrl: string,
  message: { title: string; body?: string | null; linkUrl?: string | null }
) {
  const url = message.linkUrl
    ? message.linkUrl.startsWith('http')
      ? message.linkUrl
      : `${SITE_URL}${message.linkUrl}`
    : undefined
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'Drawker',
      // @everyone 等のメンションが本文に含まれていても通知を飛ばさない
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: message.title.slice(0, 256),
          description: message.body ? message.body.slice(0, 2000) : undefined,
          url,
          color: 0x0ea5e9,
          footer: { text: 'Drawker' },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  })
  return { ok: res.ok, status: res.status }
}

import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServiceClient, getUserFromRequest } from '@/lib/discordServer'
import { INQUIRY_CATEGORIES, INQUIRY_LIMITS, inquiryCategoryLabel } from '@/lib/inquiries'

// お問い合わせフォーム（app/contact）の送信先。
// inquiries にはクライアントから直接書き込めないようにしてあり、ここで内容を確かめてから保存する。
// 保存後、管理者全員に通知（notifications）を作る。管理者がDiscord連携していれば、既存の仕組みでDiscordにも届く。
export const runtime = 'nodejs'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// 同じ接続元からの連続送信の上限
const LIMIT_PER_10_MIN = 3
const LIMIT_PER_DAY = 10

function hashIp(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  const salt = process.env.SUPABASE_WEBHOOK_SECRET || 'drawker'
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: '送信内容を読み取れませんでした。' }, { status: 400 })

  // 人には見えない入力欄に何か入っている＝機械的な送信。成功したふりをして保存しない
  if (typeof body.website === 'string' && body.website.trim()) {
    return NextResponse.json({ ok: true })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const category = INQUIRY_CATEGORIES.some((c) => c.value === body.category) ? (body.category as string) : 'other'

  if (!name || name.length > INQUIRY_LIMITS.name) {
    return NextResponse.json({ error: `お名前は${INQUIRY_LIMITS.name}文字以内で入力してください。` }, { status: 400 })
  }
  if (!EMAIL_PATTERN.test(email) || email.length > INQUIRY_LIMITS.email) {
    return NextResponse.json({ error: 'メールアドレスの形式が正しくありません。' }, { status: 400 })
  }
  if (!message || message.length > INQUIRY_LIMITS.message) {
    return NextResponse.json({ error: `お問い合わせ内容は${INQUIRY_LIMITS.message}文字以内で入力してください。` }, { status: 400 })
  }

  let admin
  try {
    admin = createServiceClient()
  } catch (e) {
    console.error('お問い合わせ: サーバー設定エラー', e)
    return NextResponse.json({ error: '現在お問い合わせを受け付けられません。お手数ですが公式X（@Drawker06）までご連絡ください。' }, { status: 500 })
  }

  const ipHash = hashIp(req)
  const now = Date.now()
  const { data: recent } = await admin
    .from('inquiries')
    .select('created_at')
    .eq('ip_hash', ipHash)
    .gte('created_at', new Date(now - 24 * 60 * 60 * 1000).toISOString())
  const recentCount10Min = (recent || []).filter((r) => now - new Date(r.created_at).getTime() < 10 * 60 * 1000).length
  if ((recent || []).length >= LIMIT_PER_DAY || recentCount10Min >= LIMIT_PER_10_MIN) {
    return NextResponse.json({ error: '短時間に続けて送信されています。しばらく時間をおいてからお試しください。' }, { status: 429 })
  }

  const user = await getUserFromRequest(req)

  const { error } = await admin.from('inquiries').insert({
    user_id: user?.id ?? null,
    name,
    email,
    category,
    message,
    ip_hash: ipHash,
  })
  if (error) {
    console.error('お問い合わせの保存エラー:', error)
    return NextResponse.json({ error: '送信に失敗しました。時間をおいてもう一度お試しください。' }, { status: 500 })
  }

  // 管理者への通知（失敗してもお問い合わせ自体は保存済みなので、送信者にはエラーを返さない）
  try {
    const { data: admins } = await admin.from('admins').select('user_id')
    if (admins && admins.length > 0) {
      await admin.from('notifications').insert(
        admins.map((a) => ({
          user_id: a.user_id,
          type: 'inquiry',
          title: `📮 お問い合わせ：${inquiryCategoryLabel(category)}`,
          body: `${name}：${message.slice(0, 200)}${message.length > 200 ? '…' : ''}`,
          link_url: '/admin/inquiries',
        }))
      )
    }
  } catch (e) {
    console.error('お問い合わせの通知エラー:', e)
  }

  return NextResponse.json({ ok: true })
}

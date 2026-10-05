import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/discordServer'

// 納期が近づいた「合意内容の控え」を、クリエイターと依頼者の両方に知らせる。
// Vercel の定期実行（vercel.json の crons）が毎日1回呼ぶ。Vercel は環境変数 CRON_SECRET を
// 「Authorization: Bearer <CRON_SECRET>」として付けて呼ぶので、それ以外からの呼び出しは断る。
//
// 対象：同意済み・受け取り完了の記録がない・納期が今日から3日以内・まだお知らせしていない控え
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REMIND_DAYS_BEFORE = 3

// 日本時間の日付（YYYY-MM-DD）
const jstDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000))

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET が設定されていません' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createServiceClient()
  const today = jstDate()
  const until = jstDate(REMIND_DAYS_BEFORE)

  const { data: rows, error } = await admin
    .from('agreements')
    .select('id, creator_id, client_id, title, deadline')
    .eq('status', 'agreed')
    .is('deadline_reminded_at', null)
    .gte('deadline', today)
    .lte('deadline', until)
  if (error) {
    console.error('納期のお知らせ：控えの取得エラー:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!rows || rows.length === 0) return NextResponse.json({ sent: 0 })

  // 受け取りまで終わっている取引には送らない
  const { data: finished } = await admin
    .from('agreement_events')
    .select('agreement_id')
    .eq('kind', 'received')
    .in('agreement_id', rows.map((r) => r.id))
  const finishedIds = new Set((finished || []).map((f) => f.agreement_id))
  const targets = rows.filter((r) => !finishedIds.has(r.id))

  let sent = 0
  for (const row of targets) {
    const date = new Date(`${row.deadline}T00:00:00+09:00`).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric' })
    const notifications = [row.creator_id, row.client_id].filter(Boolean).map((userId) => ({
      user_id: userId,
      type: 'agreement',
      title: `⏰ 納期（${date}）が近づいています`,
      body: `「${row.title}」の納期まであと少しです。進み具合を確認しましょう`,
      link_url: `/agreements/${row.id}`,
    }))
    const { error: insertError } = await admin.from('notifications').insert(notifications)
    if (insertError) {
      console.error('納期のお知らせ：通知の作成エラー:', row.id, insertError)
      continue
    }
    await admin.from('agreements').update({ deadline_reminded_at: new Date().toISOString() }).eq('id', row.id)
    sent++
  }

  return NextResponse.json({ sent })
}

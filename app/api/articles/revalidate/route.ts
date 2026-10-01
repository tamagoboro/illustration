import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient, getUserFromRequest } from '@/lib/discordServer'
import { SLUG_PATTERN } from '@/lib/articles'

// 記事を保存・公開・削除したときに、記入ページから呼ぶ。
// 記事の一覧・記事ページは5分ごとに作り直す設定なので、これを呼んで今すぐ反映させる（管理者のみ）。
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

  try {
    const { data: admin } = await createServiceClient().from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
    if (!admin) return NextResponse.json({ error: '管理者のみ操作できます' }, { status: 403 })
  } catch {
    return NextResponse.json({ error: 'サーバーの設定が未完了です' }, { status: 500 })
  }

  const body = await req.json().catch(() => null)
  const slugs: string[] = Array.isArray(body?.slugs) ? body.slugs.filter((s: unknown) => typeof s === 'string' && SLUG_PATTERN.test(s)) : []

  revalidatePath('/articles')
  slugs.forEach((slug) => revalidatePath(`/articles/${slug}`))
  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'

export async function GET() {
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://drawker.com'
  const baseUrl = rawSiteUrl.startsWith('http') ? rawSiteUrl : `https://${rawSiteUrl}`

  // 末尾スラッシュ付きの書き方(/login/など)だと実際のURL(/login)にはマッチせず
  // ブロックできていなかったため、末尾スラッシュなしに修正。
  // (この書き方でも配下のパス、例: /dashboard/form-builder も引き続きブロックされる)
  const content = `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /login
Disallow: /admin

Sitemap: ${baseUrl}/sitemap.xml
`

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}
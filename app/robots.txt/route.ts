import { NextResponse } from 'next/server'

export async function GET() {
  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const baseUrl = rawSiteUrl.startsWith('http') ? rawSiteUrl : `https://${rawSiteUrl}`

  const content = `User-agent: *
Allow: /
Disallow: /dashboard/
Disallow: /login/

Sitemap: ${baseUrl}/sitemap.xml
`

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// VercelのプレビュードメインなどでアクセスされてもURLが独自ドメインに揃うように、
// drawker.com（または www.drawker.com）以外のホストからのアクセスは常にdrawker.comへ302転送する。
// ローカル開発（localhost）は対象外にする。
const CANONICAL_HOST = 'drawker.com'

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''

  const isCanonical = host === CANONICAL_HOST || host === `www.${CANONICAL_HOST}`
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1')

  if (isCanonical || isLocal) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  url.protocol = 'https'
  url.host = CANONICAL_HOST
  url.port = ''

  return NextResponse.redirect(url, 308)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

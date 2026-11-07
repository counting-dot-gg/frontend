import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { CLIENT_IP_HEADER, CLIENT_IP_KEY_HEADER, clientIdentityHeaders } from './lib/clientIdentity'

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers)

  if (request.nextUrl.pathname.startsWith('/api/')) {
    headers.delete(CLIENT_IP_HEADER)
    headers.delete(CLIENT_IP_KEY_HEADER)
    for (const [name, value] of Object.entries(clientIdentityHeaders(request.headers))) {
      headers.set(name, value)
    }
    return NextResponse.next({ request: { headers } })
  }

  headers.set('x-pathname', request.nextUrl.pathname)
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/thread/:path*', '/api/:path*'],
}

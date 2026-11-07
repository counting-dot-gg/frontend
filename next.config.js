const origin = (url) => {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

const withWebSocket = (url) => {
  const o = origin(url)
  return o ? [o, o.replace(/^http/, 'ws')] : []
}

const apiOrigins = [process.env.NEXT_PUBLIC_API_HOST, process.env.NEXT_PUBLIC_LOGIN].map(origin).filter(Boolean)
const socketOrigins = [process.env.NEXT_PUBLIC_SOCKET_HOST, process.env.NEXT_PUBLIC_SOCKET_LOCAL].flatMap(withWebSocket)
const dev = process.env.NODE_ENV !== 'production'

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https: ${apiOrigins.join(' ')}`,
  "font-src 'self' data:",
  `connect-src 'self' ${[...apiOrigins, ...socketOrigins].join(' ')} https://oauth.reddit.com https://www.reddit.com wss://*.reddit.com${dev ? ' ws:' : ''}`,
  "media-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${apiOrigins.join(' ')}`,
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
  { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  ...(dev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]),
]

const nextConfig = {
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_BUILD_SLOT: process.env.NEXT_DIST_DIR || '.next',
  },
  allowedDevOrigins: [
    '10.0.0.236',
    '*.trycloudflare.com',
    'dev.counting.gg',
    '*.counting.gg',
  ],
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  async rewrites() {
    const apiHost = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'
    return [
      {
        source: '/api/:path*',
        destination: `${apiHost}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig

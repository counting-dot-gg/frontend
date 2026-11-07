'use client'

import { notify } from './toast'

let installed = false

const NOTICE_COOLDOWN_MS = 6000
let lastNoticeAt = 0

let lastRateLimitAt = 0

export function wasRateLimitedRecently(withinMs = 3000): boolean {
  return Date.now() - lastRateLimitAt < withinMs
}

export function notifyRateLimited(retryAfterSeconds?: number): void {
  lastRateLimitAt = Date.now()
  if (Date.now() - lastNoticeAt <= NOTICE_COOLDOWN_MS) return
  lastNoticeAt = Date.now()

  const detail =
    retryAfterSeconds && retryAfterSeconds > 0
      ? retryAfterSeconds < 60
        ? `Try again in ${Math.ceil(retryAfterSeconds)}s.`
        : `Try again in about ${Math.ceil(retryAfterSeconds / 60)} min.`
      : 'The server is rate-limiting you. Give it a moment.'

  notify('Slow down: too many requests', {
    kind: 'warn',
    detail,
    dedupeKey: 'rate-limit',
  })
}

export function installRateLimitNotice(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  const original = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await original(input, init)

    if (res.status === 429) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const api = ''
      const isOurs = url.startsWith('/') || (api && url.startsWith(api)) ||
        (typeof window !== 'undefined' && url.startsWith(window.location.origin))

      if (isOurs) {
        const retry = Number(res.headers.get('retry-after'))
        notifyRateLimited(Number.isFinite(retry) ? retry : undefined)
      }
    }

    return res
  }

  const XHR = window.XMLHttpRequest
  if (XHR?.prototype) {
    const originalOpen = XHR.prototype.open
    XHR.prototype.open = function (this: XMLHttpRequest, ...args: any[]) {
      this.addEventListener('load', () => {
        if (this.status === 429) {
          const retry = Number(this.getResponseHeader('retry-after'))
          notifyRateLimited(Number.isFinite(retry) ? retry : undefined)
        }
      })
      return originalOpen.apply(this, args as any)
    } as typeof XHR.prototype.open
  }
}

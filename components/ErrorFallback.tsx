'use client'

import { useEffect, useRef, useState } from 'react'

function report(error: (Error & { digest?: string }) | undefined, scope?: string): string {
  const lines: string[] = []
  if (scope) lines.push(`Where:  ${scope}`)
  if (typeof window !== 'undefined') {
    lines.push(`URL:    ${window.location.href}`)
    lines.push(`Time:   ${new Date().toISOString()}`)
  }
  if (error?.digest) lines.push(`Digest: ${error.digest}`)
  lines.push('')
  lines.push(error?.message || 'Unknown error')
  if (error?.stack) lines.push('', error.stack)
  return lines.join('\n')
}

import { API } from '@/lib/apiBase'

function isChunkLoadError(error: Error | undefined): boolean {
  return (
    error?.name === 'ChunkLoadError' ||
    /Failed to load chunk|Loading chunk [\w-]+ failed/i.test(error?.message ?? '')
  )
}

function isAutomatedBrowser(): boolean {
  return navigator.webdriver === true || /HeadlessChrome/i.test(navigator.userAgent)
}

const RELOAD_KEY = 'cgg:chunk-reload'
const RELOAD_WINDOW_MS = 60_000

function reloadedRecently(): boolean | null {
  try {
    const raw = sessionStorage.getItem(RELOAD_KEY)
    if (!raw) return false
    const { url, at } = JSON.parse(raw) as { url: string; at: number }
    return url === window.location.href && Date.now() - at < RELOAD_WINDOW_MS
  } catch {
    return null
  }
}

function markReload(): boolean {
  try {
    sessionStorage.setItem(RELOAD_KEY, JSON.stringify({ url: window.location.href, at: Date.now() }))
    return true
  } catch {
    return false
  }
}

type ChunkPlan = 'none' | 'reload' | 'silent' | 'report-after-reload'

function chunkPlan(error: Error | undefined): ChunkPlan {
  if (typeof window === 'undefined' || !isChunkLoadError(error)) return 'none'
  if (isAutomatedBrowser()) return 'silent'
  const recent = reloadedRecently()
  if (recent === false) return 'reload'
  return 'report-after-reload'
}

export default function ErrorFallback({
  error,
  reset,
  scope,
}: {
  error: Error & { digest?: string }
  reset?: () => void
  scope?: string
}) {
  const reported = useRef(false)
  const [plan] = useState<ChunkPlan>(() => chunkPlan(error))

  useEffect(() => {
    if (reported.current) return
    reported.current = true

    if (plan === 'reload') {
      if (markReload()) {
        window.location.reload()
        return
      }
    }
    if (plan === 'silent') return

    fetch(`${API}/api/api/reportClientError`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: scope ?? 'page',
        url: window.location.href,
        message: plan === 'report-after-reload'
          ? `${error?.message} (still failing after an automatic reload)`
          : error?.message,
        digest: error?.digest,
        stack: error?.stack,
      }),
    }).catch(() => {})
  }, [error, scope, plan])

  if (plan === 'reload') return null

  return (
    <div
      role="alert"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 14, padding: '48px 20px', textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 40, lineHeight: 1 }} aria-hidden="true">67 🥀 67</div>

      <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
        I messed up.
      </h1>

      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ink-2)', maxWidth: 460, lineHeight: 1.6 }}>
        Screenshot this and ping <strong>@pull_fish</strong> on Discord: including
        the details below, which say what actually broke.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {reset && (
          <button
            onClick={reset}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            Try again
          </button>
        )}
        <a
          href="/"
          style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            border: '1px solid rgb(var(--ink-rgb) / 0.15)', color: '#ccc', textDecoration: 'none',
          }}
        >
          Back to the site
        </a>
      </div>

      <details open style={{ marginTop: 6, maxWidth: 900, width: '100%', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--ink-3)', fontWeight: 700, flex: 1 }}>
            Technical details
          </summary>
          <button
            onClick={() => { void navigator.clipboard?.writeText(report(error, scope)) }}
            style={{
              padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              border: '1px solid rgb(var(--ink-rgb) / 0.15)', background: 'none',
              color: 'var(--ink-3)', cursor: 'pointer',
            }}
          >
            Copy
          </button>
        </div>
        <div
          style={{
            marginTop: 8, padding: 12, borderRadius: 8,
            background: 'rgb(var(--shadow-rgb) / 0.5)', border: '1px solid rgb(var(--ink-rgb) / 0.1)',
            fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff9a9a',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}
        >
          {report(error, scope)}
        </div>
      </details>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSocket } from '@/lib/socket'

interface Win {
  days: number[]
  override: { open: boolean; until: number | null } | null
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const d = Math.floor(s / 86400)
  const hms = [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':')
  return d > 0 ? `${d}d ${hms}` : hms
}

const when = (ms: number) =>
  new Date(ms).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function BingoWindowAdmin({ live }: { live: { open: boolean; next: number | null } | undefined }) {
  const [win, setWin] = useState<Win | null>(null)
  const [until, setUntil] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const load = useCallback(async () => {
    const res = await fetch('/api/features/bingo-window', { credentials: 'include' })
    if (res.ok) setWin(await res.json())
  }, [])
  useEffect(() => { void load() }, [load])

  const save = useCallback(async (next: Win) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/features/bingo-window', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(next),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? `${res.status}`)
      setWin(await res.json())
      window.setTimeout(() => getSocket().emit('bingo_list'), 5500)
    } catch (e: any) {
      setError(`Couldn’t save: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }, [])

  if (!win) return null
  const untilMs = until ? new Date(until).getTime() : null
  const override = (open: boolean) => void save({ ...win, override: { open, until: untilMs } })

  return (
    <section style={{
      marginTop: 18, padding: '14px 16px', borderRadius: 10,
      background: 'rgb(var(--ink-rgb) / 0.025)', border: '1px solid rgb(var(--ink-rgb) / 0.07)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>Bingo window</span>
        {live && (
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: live.open ? 'var(--success)' : 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>
            {live.open ? 'Open' : 'Closed'}
            {live.next != null && ` · ${live.open ? 'closes' : 'opens'} in ${countdown(live.next - now)}`}
          </span>
        )}
      </div>

      {error && <div style={{ marginTop: 8, fontSize: '0.82rem', color: 'var(--destructive)' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
        {DAYS.map((d, i) => {
          const on = win.days.includes(i)
          return (
            <button
              key={d}
              type="button"
              disabled={busy}
              aria-pressed={on}
              onClick={() => void save({ ...win, days: on ? win.days.filter(x => x !== i) : [...win.days, i] })}
              style={{
                padding: '6px 10px', borderRadius: 7, fontSize: '0.8rem', fontWeight: 700,
                border: on ? 'none' : '1px solid var(--border)',
                background: on ? 'var(--primary)' : 'transparent',
                color: on ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              {d}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" disabled={busy} onClick={() => override(true)} style={btn('var(--success)')}>Open now</button>
        <button type="button" disabled={busy} onClick={() => override(false)} style={btn('var(--destructive)')}>Close now</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
          until
          <input
            type="datetime-local"
            value={until}
            onChange={e => setUntil(e.target.value)}
            style={{
              padding: '5px 8px', borderRadius: 7, border: '1px solid var(--border)',
              background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.8rem',
            }}
          />
        </label>
      </div>

      {win.override && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: '0.82rem' }}>
          <span>
            {win.override.open ? 'Opened' : 'Closed'} {win.override.until ? `until ${when(win.override.until)}` : 'until cleared'}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save({ ...win, override: null })}
            style={{ ...btn('transparent'), color: 'var(--foreground)', border: '1px solid var(--border)' }}
          >
            Clear
          </button>
        </div>
      )}
    </section>
  )
}

const btn = (bg: string): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: 7, border: 'none', fontSize: '0.8rem', fontWeight: 700,
  background: bg, color: '#fff', cursor: 'pointer',
})

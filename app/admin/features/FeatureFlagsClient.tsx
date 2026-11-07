'use client'

import { useCallback, useEffect, useState } from 'react'
import BingoWindowAdmin from '@/components/bingo/BingoWindowAdmin'
import { useBingo } from '@/components/bingo/useBingo'

interface Flag {
  flagKey: string
  description: string
  enabled: boolean
  updatedAt: number | null
  updatedBy: string | null
}

export default function FeatureFlagsClient() {
  const { lobby } = useBingo(true, { follow: false })
  const [flags, setFlags] = useState<Flag[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/features/admin', { credentials: 'include' })
      if (!res.ok) throw new Error(`${res.status}`)
      setFlags(await res.json())
    } catch (e: any) {
      setError(`Couldn’t load flags: ${e.message}`)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const toggle = useCallback(async (flag: Flag) => {
    setBusy(flag.flagKey)
    setError(null)
    setFlags(prev => prev?.map(f => f.flagKey === flag.flagKey ? { ...f, enabled: !f.enabled } : f) ?? prev)
    try {
      const res = await fetch('/api/features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key: flag.flagKey, enabled: !flag.enabled }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
    } catch (e: any) {
      setError(`Couldn’t save: ${e.message}`)
    } finally {
      setBusy(null)
      void load()
    }
  }, [load])

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px' }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4 }}>Experimental features</h1>
      <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: 20, lineHeight: 1.5 }}>
        Turning one off hides its entry points and makes the server refuse the actions behind it.
        Admins keep access either way, so a feature can be exercised before it is opened up.
        Changes apply within about five seconds: no deploy, no restart.
      </p>

      {error && (
        <div style={{
          marginBottom: 14, padding: '9px 12px', borderRadius: 8, fontSize: '0.82rem',
          background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5',
        }}>{error}</div>
      )}

      {flags === null ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>Loading…</div>
      ) : flags.length === 0 ? (
        <div style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>No feature flags defined.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {flags.map(f => (
            <div
              key={f.flagKey}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 16px', borderRadius: 10,
                background: 'rgb(var(--ink-rgb) / 0.025)', border: '1px solid rgb(var(--ink-rgb) / 0.07)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: 2 }}>{f.flagKey}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', lineHeight: 1.45 }}>
                  {f.description}
                </div>
                {f.updatedAt && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: 4, opacity: 0.75 }}>
                    Last changed {new Date(Number(f.updatedAt)).toLocaleString()}
                  </div>
                )}
              </div>
              <button
                onClick={() => void toggle(f)}
                disabled={busy === f.flagKey}
                aria-pressed={f.enabled}
                aria-label={`${f.enabled ? 'Disable' : 'Enable'} ${f.flagKey}`}
                style={{
                  width: 52, height: 28, borderRadius: 14, border: 'none', flexShrink: 0,
                  cursor: busy === f.flagKey ? 'default' : 'pointer',
                  background: f.enabled ? 'var(--success)' : 'rgb(var(--ink-rgb) / 0.14)',
                  position: 'relative', transition: 'background 0.15s',
                  opacity: busy === f.flagKey ? 0.6 : 1,
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: f.enabled ? 27 : 3,
                  width: 22, height: 22, borderRadius: 11, background: '#fff',
                  transition: 'left 0.15s',
                }} />
              </button>
            </div>
          ))}
        </div>
      )}

      <BingoWindowAdmin live={lobby?.window} />
    </div>
  )
}

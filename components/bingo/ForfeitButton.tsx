'use client'

import { useEffect, useState } from 'react'

export default function ForfeitButton({ gameId, pending, send, size = 'full' }: {
  gameId: number
  pending: boolean
  send: (event: string, data?: Record<string, unknown>) => void
  size?: 'full' | 'small'
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 6000)
    return () => window.clearTimeout(t)
  }, [armed])

  const small = size === 'small'
  const base = {
    padding: small ? '3px 10px' : '8px 0',
    borderRadius: small ? 6 : 8,
    fontWeight: small ? 700 : 600,
    fontSize: small ? 11 : 13,
    cursor: pending ? 'default' : 'pointer',
    opacity: pending ? 0.6 : 1,
  } as const
  const quiet = { ...base, border: '1px solid var(--border)', background: small ? 'var(--background)' : 'transparent', color: 'var(--muted-foreground)' }

  if (!armed) {
    return (
      <button type="button" disabled={pending} onClick={() => setArmed(true)}
        style={{ ...quiet, width: small ? undefined : '100%' }}>
        Forfeit
      </button>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 6, width: small ? undefined : '100%' }}>
      <button type="button" disabled={pending}
        onClick={() => { setArmed(false); send('bingo_forfeit', { gameId }) }}
        style={{ ...base, flex: small ? undefined : 1, border: '1px solid var(--danger)', background: 'var(--danger)', color: '#fff', fontWeight: 800 }}>
        Forfeit
      </button>
      <button type="button" disabled={pending} autoFocus onClick={() => setArmed(false)}
        style={{ ...quiet, flex: small ? undefined : 1, color: 'var(--foreground)' }}>
        Keep playing
      </button>
    </div>
  )
}

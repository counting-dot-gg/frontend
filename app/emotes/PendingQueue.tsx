'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { notify } from '@/lib/toast'

import { API } from '@/lib/apiBase'

interface PendingEmote {
  id: number
  name: string
  filename: string
  approved: boolean
  ownerUUID: string | null
  createdByUUID: string | null
  createdAt: string
}

export default function PendingQueue({ apiHost }: { apiHost: string }) {
  const router = useRouter()
  const [pending, setPending] = useState<PendingEmote[]>([])
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/emote/all`, { credentials: 'include' })
      if (!res.ok) return
      const rows: PendingEmote[] = await res.json()
      setPending(rows.filter(e => !e.approved))
    } catch {}
  }, [])

  useEffect(() => { void load() }, [load])

  const act = useCallback(async (emote: PendingEmote, approve: boolean) => {
    if (!approve && !confirm(
      `Reject "${emote.name}"?\n\nThe image is deleted and the submitter's emote slot is refunded, so they can try again.`,
    )) return

    setBusy(emote.id)
    try {
      const res = approve
        ? await fetch(`${API}/api/emote/${emote.id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ approved: true }),
          })
        : await fetch(`${API}/api/emote/${emote.id}`, {
            method: 'DELETE',
            credentials: 'include',
          })
      if (!res.ok) throw new Error(String(res.status))
      notify(
        approve ? `"${emote.name}" is live` : `"${emote.name}" rejected: slot refunded`,
        { kind: approve ? 'success' : 'info', icon: approve ? '✅' : '↩️' },
      )
      setPending(prev => prev.filter(e => e.id !== emote.id))
      if (approve) router.refresh()
    } catch {
      notify('That didn’t work', { kind: 'error', detail: 'The server refused it.' })
      void load()
    } finally {
      setBusy(null)
    }
  }, [load, router])

  if (pending.length === 0) return null

  return (
    <section style={{
      background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.3)',
      borderRadius: 10, padding: 18, marginBottom: 36,
    }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 800 }}>
        Awaiting review ({pending.length})
      </h2>
      <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '0 0 14px' }}>
        Submitted by counters using an emote slot. Rejecting refunds the slot.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pending.map(e => (
          <div
            key={e.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 12px', borderRadius: 8,
              background: 'rgb(var(--shadow-rgb) / 0.25)', border: '1px solid rgb(var(--ink-rgb) / 0.08)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${apiHost}/uploads/emotes/${e.filename}`}
              alt=""
              width={28}
              height={28}
              style={{ display: 'block', objectFit: 'contain', flexShrink: 0 }}
            />
            <code style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ink-1)' }}>{e.name}</code>

            <button
              onClick={() => act(e, true)}
              disabled={busy === e.id}
              style={{
                padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                border: 'none', background: 'var(--success)', color: '#06210f',
                cursor: busy === e.id ? 'default' : 'pointer', opacity: busy === e.id ? 0.5 : 1,
              }}
            >
              Approve
            </button>
            <button
              onClick={() => act(e, false)}
              disabled={busy === e.id}
              style={{
                padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                border: '1px solid rgba(239,68,68,0.5)', background: 'transparent', color: 'var(--danger)',
                cursor: busy === e.id ? 'default' : 'pointer', opacity: busy === e.id ? 0.5 : 1,
              }}
            >
              Reject
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

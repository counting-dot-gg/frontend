'use client'

import { useMemo, useState } from 'react'
import { getAllEmotes, getEmote } from '@/lib/emotes'
import { getNativeEmoji } from '@/lib/nativeEmoji'
import { notify } from '@/lib/toast'

import { API } from '@/lib/apiBase'

type Reactions = Record<string, string[]>

export default function BlogReactions({
  blogUuid,
  initial,
  meUuid,
  canReact,
}: {
  blogUuid: string
  initial?: Reactions | null
  meUuid?: string | null
  canReact: boolean
}) {
  const [reactions, setReactions] = useState<Reactions>(() => normalise(initial))
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const entries = useMemo(
    () =>
      Object.entries(reactions)
        .filter(([, uuids]) => uuids.length > 0)
        .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])),
    [reactions],
  )

  const toggle = async (id: string) => {
    if (!canReact || busy) return
    setPickerOpen(false)

    const before = reactions
    const mine = !!(meUuid && reactions[id]?.includes(meUuid))
    if (meUuid) {
      const next: Reactions = { ...reactions }
      const list = next[id] ? [...next[id]] : []
      if (mine) {
        const filtered = list.filter(u => u !== meUuid)
        if (filtered.length) next[id] = filtered
        else delete next[id]
      } else {
        next[id] = [...list, meUuid]
      }
      setReactions(next)
    }

    setBusy(id)
    try {
      const res = await fetch(`${API}/api/thread/blogReaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ blog_uuid: blogUuid, id }),
      })
      if (!res.ok) {
        setReactions(before)
        let msg = `The server rejected that (${res.status}).`
        try {
          const body = await res.json()
          if (typeof body?.message === 'string') msg = body.message
        } catch {}
        notify('Reaction not saved', { kind: 'error', detail: msg })
        return
      }
      const data = await res.json()
      setReactions(normalise(data?.reactions))
    } catch {
      setReactions(before)
      notify('Couldn’t reach the server', { kind: 'error' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', position: 'relative' }}>
      {entries.map(([id, uuids]) => {
        const mine = !!(meUuid && uuids.includes(meUuid))
        return (
          <button
            key={id}
            onClick={() => toggle(id)}
            disabled={!canReact}
            title={`${uuids.length} ${uuids.length === 1 ? 'reaction' : 'reactions'}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 9px', borderRadius: 999, fontSize: 12, lineHeight: 1,
              border: `1px solid ${mine ? '#f97316' : 'rgb(var(--ink-rgb) / 0.12)'}`,
              background: mine ? 'rgba(249,115,22,0.16)' : 'rgb(var(--ink-rgb) / 0.04)',
              color: mine ? '#f97316' : 'var(--ink-2)',
              cursor: canReact ? 'pointer' : 'default',
              opacity: busy === id ? 0.55 : 1,
            }}
          >
            <EmoteGlyph id={id} />
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{uuids.length}</span>
          </button>
        )
      })}

      {canReact && (
        <button
          onClick={() => setPickerOpen(v => !v)}
          aria-label="Add a reaction"
          aria-expanded={pickerOpen}
          style={{
            padding: '3px 10px', borderRadius: 999, fontSize: 13, lineHeight: 1,
            border: '1px dashed rgb(var(--ink-rgb) / 0.18)', background: 'transparent',
            color: 'var(--ink-3)', cursor: 'pointer',
          }}
        >
          +
        </button>
      )}

      {pickerOpen && (
        <>
          <div
            onClick={() => setPickerOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 41,
            width: 'min(320px, calc(100vw - 40px))', maxHeight: 220, overflowY: 'auto',
            padding: 8, borderRadius: 10,
            background: 'var(--surface-raised)', border: '1px solid rgb(var(--ink-rgb) / 0.14)',
            boxShadow: '0 12px 32px rgb(var(--shadow-rgb) / 0.5)',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(34px, 1fr))', gap: 4,
          }}>
            {getAllEmotes().map(e => (
              <button
                key={e.id}
                onClick={() => toggle(e.id)}
                title={`:${e.id}:`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 32, borderRadius: 6, border: 'none',
                  background: 'transparent', cursor: 'pointer',
                }}
                onMouseEnter={ev => { (ev.currentTarget as HTMLElement).style.background = 'rgb(var(--ink-rgb) / 0.08)' }}
                onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <EmoteGlyph id={e.id} size={22} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function EmoteGlyph({ id, size = 16 }: { id: string; size?: number }) {
  const emote = getEmote(id)
  if (emote?.imgUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={emote.imgUrl} alt={`:${id}:`} width={size} height={size} style={{ display: 'block' }} />
  }
  const native = getNativeEmoji(id)
  return <span style={{ fontSize: size * 0.95, lineHeight: 1 }}>{native ?? `:${id}:`}</span>
}

function normalise(value: unknown): Reactions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Reactions = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(v) && v.length) out[k] = v.filter(x => typeof x === 'string')
  }
  return out
}

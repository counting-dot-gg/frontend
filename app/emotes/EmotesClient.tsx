'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CUSTOM_EMOJIS } from '@/lib/emotes'

import { API } from '@/lib/apiBase'

export interface AdminEmote {
  id: number
  name: string
  filename: string
}

export default function EmotesClient({ emotes, isAdmin, apiHost }: {
  emotes: AdminEmote[]
  isAdmin: boolean
  apiHost: string
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const upload = useCallback(async () => {
    if (!name.trim() || !file) return
    setBusy(true)
    setError(null)
    try {
      const body = new FormData()
      body.append('name', name.trim())
      body.append('image', file)
      const res = await fetch(`${API}/api/emote/upload`, {
        method: 'POST',
        credentials: 'include',
        body,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.message ?? `Upload failed (${res.status})`)
      }
      setName('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? 'Upload failed')
    } finally {
      setBusy(false)
    }
  }, [name, file, router])

  const remove = useCallback(async (emote: AdminEmote) => {
    if (!confirm(`Delete the "${emote.name}" emote? Posts using it will show \`${emote.name}\` as plain text.`)) return
    try {
      const res = await fetch(`${API}/api/emote/${emote.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? 'Delete failed')
    }
  }, [router])

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px 80px' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: '0 0 32px', letterSpacing: '-0.02em' }}>Emotes</h1>

      {isAdmin && (
        <section style={{
          background: 'rgb(var(--ink-rgb) / 0.025)', border: '1px solid rgb(var(--ink-rgb) / 0.08)',
          borderRadius: 10, padding: 18, marginBottom: 36,
        }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 4px' }}>Add an emote</h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--ink-3)', margin: '0 0 14px' }}>
            PNG, GIF, WebP or JPEG, up to 512KB. Names are 2–32 characters, letters, numbers and underscores only.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="name"
              style={{
                width: 170, background: 'rgb(var(--ink-rgb) / 0.05)', border: '1px solid rgb(var(--ink-rgb) / 0.12)',
                borderRadius: 6, padding: '7px 10px', fontSize: '0.85rem', color: 'var(--ink-1)',
                outline: 'none', fontFamily: 'var(--font-mono)',
              }}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/gif,image/webp,image/jpeg"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              style={{ fontSize: '0.8rem', color: 'var(--ink-3)', flex: 1, minWidth: 200 }}
            />
            <button
              onClick={upload}
              disabled={busy || !name.trim() || !file}
              style={{
                padding: '8px 18px', borderRadius: 7, border: 'none',
                background: '#f97316', color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                cursor: busy || !name.trim() || !file ? 'default' : 'pointer',
                opacity: busy || !name.trim() || !file ? 0.5 : 1,
              }}
            >
              {busy ? 'Uploading…' : 'Upload'}
            </button>
          </div>
          {name.trim() && (
            <div style={{ marginTop: 12, fontSize: '0.78rem', color: 'var(--ink-3)' }}>
              Will be used as{' '}
              <code style={{ color: '#f97316', fontFamily: 'var(--font-mono)' }}>
                `{name.trim()}`
              </code>
            </div>
          )}
          {error && <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--danger)' }}>{error}</div>}
        </section>
      )}

      <EmoteGrid
        title="Uploaded"
        subtitle={emotes.length === 0 ? 'None yet.' : `${emotes.length} emote${emotes.length === 1 ? '' : 's'}`}
        items={emotes.map(e => ({
          key: String(e.id),
          name: e.name,
          src: `${apiHost}/uploads/emotes/${e.filename}`,
          onDelete: isAdmin ? () => remove(e) : undefined,
        }))}
      />

      <EmoteGrid
        title="Built-in"
        subtitle={`${CUSTOM_EMOJIS.length} emotes`}
        items={CUSTOM_EMOJIS.map(e => ({ key: e.id, name: e.id, src: e.imgUrl }))}
      />
    </div>
  )
}

function EmoteGrid({ title, subtitle, items }: {
  title: string
  subtitle: string
  items: { key: string; name: string; src: string; onDelete?: () => void }[]
}) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 2px' }}>{title}</h2>
      <p style={{ fontSize: '0.78rem', color: 'var(--ink-3)', margin: '0 0 14px' }}>{subtitle}</p>
      {items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 10 }}>
          {items.map(item => (
            <div
              key={item.key}
              style={{
                background: 'rgb(var(--ink-rgb) / 0.025)', border: '1px solid rgb(var(--ink-rgb) / 0.07)',
                borderRadius: 8, padding: '12px 8px', textAlign: 'center', position: 'relative',
              }}
            >
              <img
                src={item.src}
                alt={item.name}
                style={{ height: 40, width: 'auto', maxWidth: '100%', objectFit: 'contain', display: 'block', margin: '0 auto 8px' }}
              />
              <div style={{
                fontSize: '0.72rem', color: 'var(--ink-2)', fontFamily: 'var(--font-mono)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                `{item.name}`
              </div>
              {item.onDelete && (
                <button
                  onClick={item.onDelete}
                  title="Delete emote"
                  style={{
                    position: 'absolute', top: 4, right: 4, background: 'none', border: 'none',
                    color: 'var(--danger)', cursor: 'pointer', fontSize: 12, padding: 2, lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

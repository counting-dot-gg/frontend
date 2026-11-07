'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { notify } from '@/lib/toast'

import { API } from '@/lib/apiBase'

interface Submission {
  id: number
  name: string
  filename: string
  approved: boolean
  createdAt: string
}

export default function SubmitEmote({ apiHost }: { apiHost: string }) {
  const router = useRouter()
  const [available, setAvailable] = useState<number | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/emote/slots`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setAvailable(Number(data?.available ?? 0))
      setSubmissions(data?.submissions ?? [])
    } catch {}
  }, [])

  useEffect(() => { void load() }, [load])

  const nameOk = /^[A-Za-z0-9_]{2,32}$/.test(name.trim())
  const canSubmit = nameOk && !!file && (available ?? 0) > 0 && !busy

  const submit = useCallback(async () => {
    if (!canSubmit || !file) return
    if (!confirm(`Submit "${name.trim()}" for review? This uses one of your ${available} emote slots.`)) return

    setBusy(true)
    try {
      const body = new FormData()
      body.append('name', name.trim())
      body.append('image', file)
      const res = await fetch(`${API}/api/emote/submit`, {
        method: 'POST',
        credentials: 'include',
        body,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        notify('Not submitted', {
          kind: 'error',
          detail: data?.message ?? `The server rejected it (${res.status}).`,
        })
        void load()
        return
      }
      notify(`"${name.trim()}" submitted for review`, {
        kind: 'success',
        icon: '🎨',
        detail: 'A moderator will approve it. Your slot comes back if it’s rejected.',
      })
      setName('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      void load()
      router.refresh()
    } catch {
      notify('Couldn’t reach the server', { kind: 'error' })
      void load()
    } finally {
      setBusy(false)
    }
  }, [canSubmit, file, name, available, load, router])

  if (available === null && submissions.length === 0) return null

  const pending = submissions.filter(s => !s.approved)
  const live = submissions.filter(s => s.approved)

  return (
    <section style={{
      background: 'rgb(var(--ink-rgb) / 0.025)', border: '1px solid rgb(var(--ink-rgb) / 0.08)',
      borderRadius: 10, padding: 18, marginBottom: 36,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Submit an emote</h2>
        <span style={{
          fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 999,
          background: (available ?? 0) > 0 ? 'rgba(249,115,22,0.16)' : 'rgb(var(--ink-rgb) / 0.06)',
          color: (available ?? 0) > 0 ? '#f97316' : 'var(--ink-3)',
        }}>
          {available ?? 0} slot{available === 1 ? '' : 's'}
        </span>
      </div>


      {(available ?? 0) > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="emote_name"
            maxLength={32}
            style={{
              background: 'rgb(var(--ink-rgb) / 0.05)',
              border: `1px solid ${name && !nameOk ? 'rgba(239,68,68,0.5)' : 'rgb(var(--ink-rgb) / 0.12)'}`,
              borderRadius: 6, padding: '7px 10px', fontSize: 13, color: 'var(--ink-1)',
              outline: 'none', fontFamily: 'var(--font-mono)', width: 180,
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/gif,image/webp,image/jpeg"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: 12, color: 'var(--ink-3)' }}
          />
          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{
              padding: '7px 16px', borderRadius: 7, border: 'none',
              background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 13,
              cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.4,
            }}
          >
            {busy ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      )}

      {name && !nameOk && (
        <p style={{ fontSize: 11, color: 'var(--danger)', margin: '8px 0 0' }}>
          2–32 characters, letters, numbers and underscores only.
        </p>
      )}

      {(pending.length > 0 || live.length > 0) && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgb(var(--ink-rgb) / 0.07)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-3)', letterSpacing: '0.06em', marginBottom: 8 }}>
            YOUR SUBMISSIONS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[...pending, ...live].map(s => (
              <span
                key={s.id}
                title={s.approved ? 'Approved and live' : 'Waiting on a moderator'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '4px 10px 4px 5px', borderRadius: 999,
                  background: 'rgb(var(--ink-rgb) / 0.04)',
                  border: `1px solid ${s.approved ? 'rgba(34,197,94,0.4)' : 'rgba(249,115,22,0.4)'}`,
                  fontSize: 12,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${apiHost}/uploads/emotes/${s.filename}`}
                  alt=""
                  width={20}
                  height={20}
                  style={{ display: 'block', objectFit: 'contain' }}
                />
                <code style={{ color: 'var(--ink-2)' }}>{s.name}</code>
                <span style={{ fontSize: 10, fontWeight: 800, color: s.approved ? 'var(--success-ink)' : 'var(--brand-ink)' }}>
                  {s.approved ? 'LIVE' : 'PENDING'}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

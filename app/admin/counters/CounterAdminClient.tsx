'use client'

import { useCallback, useEffect, useState } from 'react'
import { notify } from '@/lib/toast'

import { API } from '@/lib/apiBase'

const ROLES = [
  'unverified', 'discord_verified', 'manual_verification_needed', 'denied',
  'counter', 'bot',
  'speed_verifier', 'mod', 'admin',
  'banned', 'muted',
  'contestant', 'eliminated',
  'blaze', 'radiant', 'wave', 'emboldened', 'ascended',
]

interface AdminCounter {
  uuid: string
  discordId: string
  name: string
  username: string
  color: string
  roles: string[]
  avatar: string
  cardStyle: string
  cardBorderStyle: string
  pronouns: [string, string, string, string]
  title: string
  xp: number
  rainbow: number
  emoji?: string
  money: number
}

interface ListResponse {
  total: number
  page: number
  pageCount: number
  counters: AdminCounter[]
}

const inputCls: React.CSSProperties = {
  background: 'rgb(var(--ink-rgb) / 0.05)',
  border: '1px solid rgb(var(--ink-rgb) / 0.12)',
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 13,
  color: 'var(--ink-1)',
  outline: 'none',
  width: '100%',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
        {label}
      </span>
      {children}
    </label>
  )
}

export default function CounterAdminClient() {
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<AdminCounter | null>(null)
  const [original, setOriginal] = useState<AdminCounter | null>(null)
  const [saving, setSaving] = useState(false)

  const openEditor = (c: AdminCounter) => {
    setEditing({ ...c })
    setOriginal({ ...c })
  }

  useEffect(() => {
    const id = setTimeout(() => { setSearch(query); setPage(1) }, 300)
    return () => clearTimeout(id)
  }, [query])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`${API}/api/counter/admin/list?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error(String(res.status))
      setData(await res.json())
    } catch {
      notify('Couldn’t load counters', { kind: 'error' })
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { void load() }, [load])

  const save = async () => {
    if (!editing || !original) return

    const changed = <K extends keyof AdminCounter>(key: K) =>
      JSON.stringify(editing[key]) !== JSON.stringify(original[key])

    const counterChanges: Record<string, unknown> = {}
    const COUNTER_KEYS: (keyof AdminCounter)[] = [
      'name', 'username', 'color', 'roles', 'cardStyle', 'cardBorderStyle',
      'pronouns', 'title', 'xp', 'rainbow', 'emoji', 'avatar', 'discordId',
    ]
    for (const key of COUNTER_KEYS) {
      if (changed(key)) counterChanges[key] = editing[key]
    }

    const userChanges: Record<string, unknown> = {}
    if (changed('money')) userChanges.money = Number(editing.money) || 0

    if (Object.keys(counterChanges).length === 0 && Object.keys(userChanges).length === 0) {
      notify('Nothing changed', { kind: 'info' })
      return
    }

    if ('discordId' in counterChanges) {
      const next = String(editing.discordId ?? '')
      const retiring = /^\d{17,20}\D/.test(next)
      const ok = window.confirm(
        retiring
          ? `Retire @${original.username}'s Discord ID?

` +
            `${original.discordId}  →  ${next}

` +
            `Nobody will be able to log into this account afterwards, and ` +
            `${original.discordId} becomes free for another account to take.`
          : `Move @${original.username} to a different Discord account?

` +
            `${original.discordId}  →  ${next}

` +
            `The old Discord account loses access to it; the new one gains it.`,
      )
      if (!ok) return
    }

    setSaving(true)
    try {
      const res = await fetch(`${API}/api/counter/admin/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uuid: editing.uuid, counterChanges, userChanges }),
      })
      if (!res.ok) {
        let msg = `The server rejected it (${res.status}).`
        try {
          const body = await res.json()
          if (typeof body?.message === 'string') msg = body.message
        } catch {}
        notify('Not saved', { kind: 'error', detail: msg })
        return
      }
      const fields = [...Object.keys(counterChanges), ...Object.keys(userChanges)]
      notify(`Saved ${editing.username}`, {
        kind: 'success',
        icon: '✅',
        detail: `Updated ${fields.join(', ')}.`,
      })
      setEditing(null)
      setOriginal(null)
      void load()
    } catch {
      notify('Couldn’t reach the server', { kind: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const patch = (p: Partial<AdminCounter>) =>
    setEditing(prev => (prev ? { ...prev, ...p } : prev))

  const toggleRole = (role: string) => {
    if (!editing) return
    const has = editing.roles.includes(role)
    patch({ roles: has ? editing.roles.filter(r => r !== role) : [...editing.roles, role] })
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 80px' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
        Counter admin
      </h1>
      <p style={{ color: 'var(--ink-3)', fontSize: '0.85rem', margin: '0 0 20px' }}>
        Every account, including unverified, denied and banned. Changes here skip
        the normal ownership checks: a title or emoji doesn’t have to be owned.
      </p>

      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search username, display name, uuid or Discord ID…"
        style={{ ...inputCls, marginBottom: 16, maxWidth: 420 }}
      />

      {loading && !data ? (
        <div style={{ color: '#666', fontSize: 13 }}>Loading…</div>
      ) : !data || data.counters.length === 0 ? (
        <div style={{ color: '#666', fontSize: 13 }}>No counters match.</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', border: '1px solid rgb(var(--ink-rgb) / 0.08)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgb(var(--ink-rgb) / 0.04)', textAlign: 'left' }}>
                  {['Counter', 'Roles', 'XP', 'Money', 'Title', ''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.counters.map(c => (
                  <tr key={c.uuid} style={{ borderTop: '1px solid rgb(var(--ink-rgb) / 0.06)' }}>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      <span style={{ color: c.color, fontWeight: 700 }}>{c.name || '-'}</span>
                      <span style={{ color: '#666', marginLeft: 6 }}>@{c.username}</span>
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--ink-3)', fontSize: 11 }}>
                      {c.roles.join(', ')}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {c.xp?.toLocaleString() ?? 0}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {c.money?.toLocaleString() ?? 0}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{c.title}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <button
                        onClick={() => openEditor(c)}
                        style={{
                          padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                          border: '1px solid rgba(249,115,22,0.4)', background: 'transparent',
                          color: '#f97316', cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, fontSize: 12, color: 'var(--ink-3)' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid rgb(var(--ink-rgb) / 0.15)', background: 'transparent', color: '#ccc', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}
            >
              ← Prev
            </button>
            <span>Page {data.page} of {data.pageCount || 1} · {data.total.toLocaleString()} accounts</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= data.pageCount}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid rgb(var(--ink-rgb) / 0.15)', background: 'transparent', color: '#ccc', cursor: page >= data.pageCount ? 'default' : 'pointer', opacity: page >= data.pageCount ? 0.4 : 1 }}
            >
              Next →
            </button>
          </div>
        </>
      )}

      {editing && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setEditing(null); setOriginal(null) } }}
          style={{
            position: 'fixed', inset: 0, background: 'rgb(var(--shadow-rgb) / 0.6)', zIndex: 100,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '40px 16px', overflowY: 'auto',
          }}
        >
          <div style={{
            width: '100%', maxWidth: 620, background: 'var(--surface-raised)',
            border: '1px solid rgb(var(--ink-rgb) / 0.12)', borderRadius: 12, padding: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{editing.username}</h2>
              <span style={{ fontSize: 11, color: '#666', fontFamily: 'var(--font-mono)' }}>{editing.uuid}</span>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 11, color: '#666' }}>
              Only the fields you change are sent, so this won’t overwrite anything
              that moved since you opened it.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Field label="DISCORD ID: ACCOUNT TRANSFER">
                <input
                  value={editing.discordId ?? ''}
                  onChange={e => patch({ discordId: e.target.value.trim() })}
                  placeholder="17–20 digits, or snowflake-suffix to retire"
                  style={{
                    ...inputCls,
                    fontFamily: 'var(--font-mono)',
                    borderColor: original && editing.discordId !== original.discordId
                      ? '#f59e0b'
                      : 'rgb(var(--ink-rgb) / 0.12)',
                  }}
                />
                {/^\d{17,20}$/.test(editing.discordId ?? '') && (
                  <button
                    type="button"
                    onClick={() => patch({ discordId: `${editing.discordId}-retired` })}
                    style={{
                      alignSelf: 'flex-start', marginTop: 2,
                      background: 'none', border: 'none', padding: 0,
                      color: '#f59e0b', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      textDecoration: 'underline', textUnderlineOffset: 3,
                    }}
                  >
                    Retire this ID (frees it for another account)
                  </button>
                )}
              </Field>
              <Field label="DISPLAY NAME">
                <input value={editing.name} onChange={e => patch({ name: e.target.value })} style={inputCls} />
              </Field>
              <Field label="USERNAME">
                <input value={editing.username} onChange={e => patch({ username: e.target.value })} style={inputCls} />
              </Field>
              <Field label="COLOR">
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(editing.color) ? editing.color : '#1e88e5'}
                    onChange={e => patch({ color: e.target.value })}
                    style={{ width: 34, height: 32, padding: 2, background: 'transparent', border: '1px solid rgb(var(--ink-rgb) / 0.12)', borderRadius: 6, cursor: 'pointer' }}
                  />
                  <input value={editing.color} onChange={e => patch({ color: e.target.value })} style={{ ...inputCls, fontFamily: 'var(--font-mono)' }} />
                </div>
              </Field>
              <Field label="TITLE">
                <input value={editing.title ?? ''} onChange={e => patch({ title: e.target.value })} style={inputCls} />
              </Field>
              <Field label="EMOJI">
                <input value={editing.emoji ?? ''} onChange={e => patch({ emoji: e.target.value })} style={inputCls} />
              </Field>
              <Field label="XP">
                <input type="number" value={editing.xp ?? 0} onChange={e => patch({ xp: Number(e.target.value) })} style={inputCls} />
              </Field>
              <Field label="MONEY">
                <input type="number" value={editing.money ?? 0} onChange={e => patch({ money: Number(e.target.value) })} style={inputCls} />
              </Field>
              <Field label="RAINBOW (1–100000)">
                <input type="number" min={1} max={100000} value={editing.rainbow ?? 1} onChange={e => patch({ rainbow: Number(e.target.value) })} style={inputCls} />
              </Field>
              <Field label="CARD STYLE">
                <input value={editing.cardStyle ?? ''} onChange={e => patch({ cardStyle: e.target.value })} style={inputCls} />
              </Field>
              <Field label="CARD BORDER">
                <input value={editing.cardBorderStyle ?? ''} onChange={e => patch({ cardBorderStyle: e.target.value })} style={inputCls} />
              </Field>
              <Field label="AVATAR HASH">
                <input value={editing.avatar ?? ''} onChange={e => patch({ avatar: e.target.value })} style={inputCls} />
              </Field>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 6 }}>ROLES</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ROLES.map(role => {
                  const on = editing.roles.includes(role)
                  return (
                    <button
                      key={role}
                      onClick={() => toggleRole(role)}
                      style={{
                        padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: on ? 700 : 500,
                        border: `1px solid ${on ? '#f97316' : 'rgb(var(--ink-rgb) / 0.12)'}`,
                        background: on ? 'rgba(249,115,22,0.16)' : 'transparent',
                        color: on ? '#f97316' : 'var(--ink-3)', cursor: 'pointer',
                      }}
                    >
                      {role}
                    </button>
                  )
                })}
              </div>
              {editing.roles.some(r => !ROLES.includes(r)) && (
                <p style={{ margin: '8px 0 0', fontSize: 11, color: '#f59e0b' }}>
                  Also holds: {editing.roles.filter(r => !ROLES.includes(r)).join(', ')} - kept on save.
                </p>
              )}
            </div>

            <div style={{ marginTop: 16 }}>
              <Field label="PRONOUNS (4 values, e.g. they / them / their / theirs)">
                <input
                  value={(editing.pronouns ?? []).join(' / ')}
                  onChange={e => {
                    const parts = e.target.value.split('/').map(v => v.trim())
                    patch({ pronouns: [parts[0] ?? '', parts[1] ?? '', parts[2] ?? '', parts[3] ?? ''] })
                  }}
                  style={inputCls}
                />
              </Field>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none', background: '#f97316',
                  color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                onClick={() => { setEditing(null); setOriginal(null) }}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid rgb(var(--ink-rgb) / 0.15)',
                  background: 'transparent', color: '#ccc', fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

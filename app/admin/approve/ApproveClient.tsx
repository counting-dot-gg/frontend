'use client'

import { useState } from 'react'

import { API } from '@/lib/apiBase'
import Field from './Field'

export interface PendingCounter {
  uuid: string
  username: string
  name: string
  color: string
  roles: string[]
  discordId?: string
  avatar?: string
  signedUpAt?: string | null
}

type Action = 'makeCounter' | 'makeDiscordVerified' | 'denyCounter'

const ACTIONS: { key: Action; label: string; hint: string; tone: 'primary' | 'neutral' | 'danger' }[] = [
  { key: 'makeCounter', label: 'Approve as counter', hint: 'Full access: they can post counts.', tone: 'primary' },
  { key: 'makeDiscordVerified', label: 'Mark Discord-verified', hint: 'Lets them register, still needs approval after.', tone: 'neutral' },
  { key: 'denyCounter', label: 'Deny', hint: 'Rejects the registration.', tone: 'danger' },
]

function roleBadge(roles: string[]): { label: string; cls: string } {
  if (roles.includes('manual_verification_needed')) {
    return { label: 'awaiting approval', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' }
  }
  if (roles.includes('discord_verified')) {
    return { label: 'not yet registered', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30' }
  }
  if (roles.includes('denied')) {
    return { label: 'denied', cls: 'bg-red-500/15 text-red-400 border-red-500/30' }
  }
  return { label: 'unverified', cls: 'bg-white/10 text-muted-foreground border-white/15' }
}

export default function ApproveClient({
  initialPending,
}: {
  initialPending: PendingCounter[]
}) {
  const [pending, setPending] = useState(initialPending)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<Action | null>(null)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const toggle = (uuid: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      return next
    })
  }

  const toggleExpanded = (uuid: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(uuid)) next.delete(uuid)
      else next.add(uuid)
      return next
    })
  }

  const allSelected = pending.length > 0 && selected.size === pending.length
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(pending.map(p => p.uuid)))
  }

  const allExpanded = pending.length > 0 && expanded.size === pending.length
  const toggleAllExpanded = () => {
    setExpanded(allExpanded ? new Set() : new Set(pending.map(p => p.uuid)))
  }

  const run = async (action: Action) => {
    if (selected.size === 0 || busy) return
    const ids = [...selected]
    setBusy(action)
    setMessage(null)
    try {
      const res = await fetch(`${API}/api/counter/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ counter_ids: ids }),
      })
      if (!res.ok) {
        setMessage({ text: `Server rejected the request (${res.status}). Nothing was changed.`, ok: false })
        return
      }
      if (action === 'makeDiscordVerified') {
        setPending(prev => prev.map(p =>
          selected.has(p.uuid)
            ? { ...p, roles: [...new Set([...p.roles.filter(r => r !== 'unverified'), 'discord_verified'])] }
            : p))
      } else {
        setPending(prev => prev.filter(p => !selected.has(p.uuid)))
      }
      setSelected(new Set())
      const verb = action === 'denyCounter' ? 'Denied' : action === 'makeCounter' ? 'Approved' : 'Marked Discord-verified'
      setMessage({ text: `${verb} ${ids.length} ${ids.length === 1 ? 'counter' : 'counters'}.`, ok: true })
    } catch {
      setMessage({ text: 'Couldn’t reach the server. Nothing was changed.', ok: false })
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Approve registrations</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {pending.length === 0
            ? 'Nothing waiting right now.'
            : `${pending.length} ${pending.length === 1 ? 'account is' : 'accounts are'} waiting.`}
        </p>

        {message && (
          <p
            role="status"
            className={
              'mb-5 rounded-lg border px-3 py-2 text-sm ' +
              (message.ok
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-destructive/40 bg-destructive/10')
            }
          >
            {message.text}
          </p>
        )}

        {pending.length > 0 && (
          <>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                  className="size-4 accent-[var(--primary)]"
                />
                <span className="text-xs font-semibold text-muted-foreground">
                  {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
                </span>
                <button
                  onClick={toggleAllExpanded}
                  className="ml-auto text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  {allExpanded ? 'Collapse all' : 'Expand all'}
                </button>
              </div>

              <ul>
                {pending.map((c) => {
                  const badge = roleBadge(c.roles)
                  const isOpen = expanded.has(c.uuid)
                  return (
                    <li key={c.uuid} className="border-b border-border last:border-b-0">
                      <div className="flex items-start gap-3 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(c.uuid)}
                          onChange={() => toggle(c.uuid)}
                          aria-label={`Select ${c.username || c.uuid}`}
                          className="mt-1 size-4 accent-[var(--primary)] shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold truncate" style={{ color: c.color || undefined }}>
                              {c.name || '(no display name)'}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              @{c.username || '-'}
                            </span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </div>

                          <div className="mt-1 font-mono text-[11px] text-muted-foreground break-all">
                            {c.uuid}
                            {c.signedUpAt ? ` · signed up ${c.signedUpAt}` : ''}
                            {c.discordId ? ` · discord ${c.discordId}` : ''}
                          </div>

                          <button
                            onClick={() => toggleExpanded(c.uuid)}
                            aria-expanded={isOpen}
                            className="mt-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                          >
                            {isOpen ? 'Hide details' : 'Details'}
                          </button>

                          {isOpen && (
                            <div className="mt-2 space-y-2.5">
                              <div className="rounded-lg border border-border bg-background/40 p-2.5 space-y-1">
                                <Field label="Discord ID" value={c.discordId ?? null} />
                                <Field label="Roles" value={c.roles.length ? c.roles.join(', ') : null} />
                              </div>

                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {ACTIONS.map(({ key, label, hint, tone }) => (
                <button
                  key={key}
                  onClick={() => run(key)}
                  disabled={selected.size === 0 || busy !== null}
                  title={hint}
                  className={
                    'rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ' +
                    (tone === 'primary' ? 'bg-primary text-white'
                      : tone === 'danger' ? 'border border-destructive/50 text-destructive hover:bg-destructive/10'
                      : 'border border-border hover:bg-muted')
                  }
                >
                  {busy === key ? 'Working…' : label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Actions apply to every selected account at once.
            </p>
          </>
        )}
      </div>
    </main>
  )
}

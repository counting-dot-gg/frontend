'use client'

import { useState } from 'react'
import Link from 'next/link'

import { API } from '@/lib/apiBase'

export interface AchievementOption {
  id: number
  name: string
  description: string
  hidden: boolean
}

interface ResolvedCounter {
  uuid: string
  username: string
  name: string
  color?: string
}

export default function AwardAchievementClient({ achievements }: { achievements: AchievementOption[] }) {
  const [query, setQuery] = useState('')
  const [counter, setCounter] = useState<ResolvedCounter | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [looking, setLooking] = useState(false)

  const [achievementId, setAchievementId] = useState('')
  const [awarding, setAwarding] = useState(false)
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null)

  const lookup = async () => {
    const q = query.trim()
    if (!q || looking) return
    setLooking(true)
    setLookupError(null)
    setCounter(null)
    setResult(null)
    try {
      const res = await fetch(`${API}/api/counter/load_counter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uuid: q }),
      })
      if (!res.ok) { setLookupError('No counter found with that username or uuid.'); return }
      const data = await res.json()
      const c = data?.loadedCounter
      if (!c?.uuid) { setLookupError('No counter found with that username or uuid.'); return }
      setCounter({ uuid: c.uuid, username: c.username, name: c.name, color: c.color })
    } catch {
      setLookupError('Couldn’t reach the server.')
    } finally {
      setLooking(false)
    }
  }

  const award = async () => {
    const id = parseInt(achievementId, 10)
    if (!counter || !Number.isFinite(id) || awarding) return
    setAwarding(true)
    setResult(null)
    try {
      const res = await fetch(`${API}/api/counter/awardAchievement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ counter_uuid: counter.uuid, achievement_id: id }),
      })
      if (res.ok) {
        const chosen = achievements.find(a => a.id === id)
        setResult({
          text: `Awarded ${chosen ? `“${chosen.name}”` : `achievement ${id}`} to ${counter.name}.`,
          ok: true,
        })
      } else {
        setResult({ text: `Server rejected the request (${res.status}). Nothing was awarded.`, ok: false })
      }
    } catch {
      setResult({ text: 'Couldn’t reach the server. Nothing was awarded.', ok: false })
    } finally {
      setAwarding(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary transition-colors'
  const selected = achievements.find(a => a.id === parseInt(achievementId, 10))

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-10">
        <Link href="/admin" className="text-xs font-semibold text-primary hover:underline underline-offset-4">
          ← Admin
        </Link>

        <h1 className="mt-3 text-3xl font-bold tracking-tight mb-1">Award achievement</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Grants an achievement to a counter. There&apos;s no un-award.
        </p>

        <section className="rounded-xl border border-border bg-card p-4 mb-4">
          <label htmlFor="counter-q" className="block text-xs font-semibold mb-1.5">
            Counter
          </label>
          <div className="flex gap-2">
            <input
              id="counter-q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookup() } }}
              placeholder="username or uuid"
              className={inputCls}
              spellCheck={false}
              autoComplete="off"
            />
            <button
              onClick={lookup}
              disabled={!query.trim() || looking}
              className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-40"
            >
              {looking ? '…' : 'Find'}
            </button>
          </div>

          {lookupError && <p className="mt-2 text-sm text-destructive">{lookupError}</p>}

          {counter && (
            <div className="mt-3 rounded-lg border border-border bg-background px-3 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold" style={{ color: counter.color || undefined }}>
                  {counter.name}
                </span>
                <span className="text-xs text-muted-foreground">@{counter.username}</span>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{counter.uuid}</p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <label htmlFor="ach" className="block text-xs font-semibold mb-1.5">
            Achievement
          </label>
          {achievements.length > 0 ? (
            <select
              id="ach"
              value={achievementId}
              onChange={(e) => setAchievementId(e.target.value)}
              className={inputCls}
            >
              <option value="">Pick one</option>
              {achievements.map(a => (
                <option key={a.id} value={a.id}>
                  {a.id} - {a.name}{a.hidden ? ' (hidden)' : ''}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                id="ach"
                value={achievementId}
                onChange={(e) => setAchievementId(e.target.value)}
                placeholder="achievement id"
                inputMode="numeric"
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Couldn&apos;t load the achievement list: enter the numeric id directly.
              </p>
            </>
          )}

          {selected?.description && (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{selected.description}</p>
          )}

          <button
            onClick={award}
            disabled={!counter || !achievementId || awarding}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {awarding ? 'Awarding…' : counter ? `Award to ${counter.name}` : 'Find a counter first'}
          </button>
        </section>

        {result && (
          <p
            role="status"
            className={
              'mt-5 rounded-lg border px-3 py-2 text-sm ' +
              (result.ok ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-destructive/40 bg-destructive/10')
            }
          >
            {result.text}
          </p>
        )}
      </div>
    </main>
  )
}

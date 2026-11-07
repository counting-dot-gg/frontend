'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const ADMIN_STATS = '/api/api/admin/stats'

type JobKind = 'all' | 'day' | 'counter' | 'achievements' | 'gaps'

type Job = {
  id: string
  kind: JobKind
  target: string | null
  startedAt: number
  finishedAt: number | null
  status: 'running' | 'done' | 'failed'
  error: string | null
  note: string | null
}

const JOBS: {
  kind: JobKind
  label: string
  blurb: string
  needs?: 'day' | 'counter'
  heavy?: boolean
}[] = [
  {
    kind: 'day',
    label: 'Regenerate one day',
    blurb: 'Rebuilds that day\'s thread and counter stats from the posts. Seconds, and the usual fix for a day that came out wrong or empty.',
    needs: 'day',
  },
  {
    kind: 'counter',
    label: 'Recalculate one counter',
    blurb: 'Rebuilds a single profile\'s stats from their posts. Use for a profile showing wrong totals or a wrong first count.',
    needs: 'counter',
  },
  {
    kind: 'gaps',
    label: 'Find and repair missing days',
    blurb: 'Looks for days the database has posts for but the stats files do not, and rebuilds up to 30 of them. Runs nightly on its own too.',
  },
  {
    kind: 'achievements',
    label: 'Re-check achievements',
    blurb: 'Runs the achievement pass over every counter. Long — this is the one that walks each counter\'s post history.',
    heavy: true,
  },
  {
    kind: 'all',
    label: 'Regenerate everything',
    blurb: 'Full rebuild from the first post to now. Hours, and it competes with the five-minute cycle the whole time. Last resort.',
    heavy: true,
  },
]

function since(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export default function AdminStatsClient() {
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [day, setDay] = useState('')
  const [counterUuid, setCounterUuid] = useState('')
  const [, setTick] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${ADMIN_STATS}/status`, { credentials: 'include' })
      if (!res.ok) throw new Error(`status ${res.status}`)
      const data = await res.json()
      setJob(data.job ?? null)
    } catch {
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const running = job?.status === 'running'
  useEffect(() => {
    if (!running) return
    const poll = setInterval(refresh, 2000)
    const tick = setInterval(() => setTick(t => t + 1), 1000)
    return () => { clearInterval(poll); clearInterval(tick) }
  }, [running, refresh])

  const start = async (kind: JobKind, target?: string) => {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(`${ADMIN_STATS}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kind, target }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message ?? `Request failed (${res.status})`)
      if (data?.started === false) setError(data.reason ?? 'The job was not started.')
      if (data?.job) setJob(data.job)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the job.')
    } finally {
      setBusy(false)
    }
  }

  const card: React.CSSProperties = {
    border: '1px solid rgb(var(--ink-rgb) / 0.12)',
    borderRadius: 10,
    padding: 16,
    background: 'var(--surface-raised, rgb(var(--ink-rgb) / 0.03))',
  }
  const input: React.CSSProperties = {
    padding: '7px 10px', fontSize: 13, borderRadius: 6,
    border: '1px solid rgb(var(--ink-rgb) / 0.2)',
    background: 'rgb(var(--ink-rgb) / 0.05)', color: 'var(--ink-1)', outline: 'none',
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 16px', color: 'var(--ink-1)' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 }}>Stats admin</h1>
      <p style={{ color: 'var(--ink-3)', fontSize: 13, marginBottom: 20 }}>
        Regeneration jobs. One runs at a time — starting a second while one is going is refused
        rather than queued, because two writing the same files interleave into each other&apos;s output.
      </p>

      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: 8 }}>
          {running ? 'Running' : 'Last job'}
        </div>
        {!job ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Nothing has run since the stats service started.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
            <div>
              <strong>{job.kind}</strong>
              {job.target && <span style={{ color: 'var(--ink-3)' }}> · {job.target}</span>}
              <span style={{
                marginLeft: 8, fontSize: 11, padding: '1px 7px', borderRadius: 999,
                background: job.status === 'running' ? 'rgba(59,130,246,0.18)'
                  : job.status === 'done' ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)',
                color: job.status === 'running' ? '#3b82f6' : job.status === 'done' ? '#22c55e' : '#ef4444',
              }}>{job.status}</span>
            </div>
            <div style={{ color: 'var(--ink-3)' }}>
              {job.status === 'running'
                ? `running for ${since(Date.now() - job.startedAt)}`
                : `took ${since((job.finishedAt ?? job.startedAt) - job.startedAt)}`}
            </div>
            {job.note && <div style={{ color: 'var(--ink-2)' }}>{job.note}</div>}
            {job.error && <div style={{ color: '#ef4444' }}>{job.error}</div>}
          </div>
        )}
      </div>

      {error && (
        <div style={{ ...card, marginBottom: 20, borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {JOBS.map(j => (
          <div key={j.kind} style={card}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <strong style={{ fontSize: 14 }}>{j.label}</strong>
              {j.heavy && (
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#f59e0b' }}>
                  slow
                </span>
              )}
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: '0 0 10px' }}>{j.blurb}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {j.needs === 'day' && (
                <input type="date" value={day} onChange={e => setDay(e.target.value)} style={input} />
              )}
              {j.needs === 'counter' && (
                <input
                  type="text"
                  value={counterUuid}
                  onChange={e => setCounterUuid(e.target.value)}
                  placeholder="counter uuid"
                  style={{ ...input, minWidth: 300, fontFamily: 'var(--font-mono, monospace)' }}
                />
              )}
              <button
                disabled={busy || running || (j.needs === 'day' && !day) || (j.needs === 'counter' && !counterUuid.trim())}
                onClick={() => start(j.kind, j.needs === 'day' ? day : j.needs === 'counter' ? counterUuid.trim() : undefined)}
                style={{
                  padding: '7px 14px', fontSize: 13, fontWeight: 600, borderRadius: 6,
                  border: '1px solid rgb(var(--ink-rgb) / 0.2)',
                  background: running || busy ? 'rgb(var(--ink-rgb) / 0.06)' : 'var(--brand, #3b82f6)',
                  color: running || busy ? 'var(--ink-3)' : 'var(--brand-ink, #fff)',
                  cursor: running || busy ? 'not-allowed' : 'pointer',
                }}
              >
                {running ? 'A job is running' : 'Run'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

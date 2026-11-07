'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { fetchAllThreads } from '@/lib/threadList'
import type { ChallengeLog } from '@/lib/rankUtils'

type Thread = { uuid: string; name: string; title?: string }

function useThreadNames() {
  const [names, setNames] = useState<Map<string, Thread>>(new Map())
  useEffect(() => {
    let live = true
    fetchAllThreads<Thread>()
      .then(ts => { if (live) setNames(new Map(ts.map(t => [t.uuid, t]))) })
      .catch(() => {})
    return () => { live = false }
  }, [])
  return names
}

export function SpreadBreakdown({ log }: { log: ChallengeLog }) {
  let tallies: Record<string, number> = {}
  try {
    tallies = log.accuracyWindow ? JSON.parse(log.accuracyWindow) : {}
  } catch {}
  return <SpreadRows tallies={tallies} need={Number(log.params?.minThreads ?? 1)} target={log.target} />
}

export function SpreadRows({ tallies, need: needRaw, target, links = false }: {
  tallies: Record<string, unknown>
  need: number
  target: number
  links?: boolean
}) {
  const names = useThreadNames()
  const sorted = Object.entries(tallies)
    .filter((e): e is [string, number] => typeof e[1] === 'number')
    .sort((a, b) => b[1] - a[1])

  const need = Math.max(1, needRaw || 1)
  const counting = sorted.slice(0, need)
  const next = sorted[need]
  const empty = Math.max(0, need - counting.length)

  const row = (key: string, uuid: string | null, n: number, dim = false) => {
    const pct = target > 0 ? Math.min(100, (n / target) * 100) : 0
    const done = n >= target
    const t = uuid ? names.get(uuid) : null
    const label = uuid ? (t ? t.title || t.name : '…') : 'Any other thread'
    return (
      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, opacity: dim ? 0.6 : 1 }}>
        <span style={{ flex: '0 1 40%', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-1)', fontWeight: 600 }}>
          {links && t ? (
            <Link prefetch={false} href={`/thread/${t.name}`} style={{ color: 'inherit' }}>{label}</Link>
          ) : label}
        </span>
        <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgb(var(--ink-rgb) / 0.1)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: done ? 'var(--success-ink)' : '#3b82f6' }} />
        </div>
        <span style={{ flexShrink: 0, width: 74, textAlign: 'right', color: done ? 'var(--success-ink)' : 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          {Math.min(n, target).toLocaleString()} / {target.toLocaleString()}
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 10px 4px' }}>
      {counting.map(([uuid, n]) => row(uuid, uuid, n))}
      {Array.from({ length: empty }, (_, i) => row(`empty-${i}`, null, 0, true))}
      {next && row(next[0], next[0], next[1], true)}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { loadProgress, peekProgress } from '@/lib/rankCache'
import { challengeTypeOrder, getProgressLabel, RANK_COLORS, type ChallengeLog } from '@/lib/rankUtils'

export function CounterProgressMini({ username, scope }: { username: string; scope: string | null }) {
  const [logs, setLogs] = useState<ChallengeLog[] | null>(peekProgress(username) ?? null)
  useEffect(() => {
    let live = true
    loadProgress(username).then(l => { if (live) setLogs(l) })
    return () => { live = false }
  }, [username])

  if (!logs) return <div style={{ padding: '6px 8px', fontSize: 12, color: 'var(--ink-3)' }}>…</div>
  const mine = logs
    .filter(l => (l.threadUuid ?? null) === scope && l.context === 'rank')
    .sort((a, b) => challengeTypeOrder(a.type) - challengeTypeOrder(b.type))
  if (mine.length === 0) return <div style={{ padding: '6px 8px', fontSize: 12, color: 'var(--ink-3)' }}>None open</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 8px 8px 38px' }}>
      {mine.map(l => {
        const locked = l.availableAt != null && Number(l.availableAt) > Date.now()
        const pct = l.type === 'accuracy_rate' || l.target <= 0 ? 0 : Math.min(100, (l.progress / l.target) * 100)
        return (
          <div key={l.id} style={{ opacity: locked ? 0.5 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12 }}>
              <span style={{ flex: 1, minWidth: 0, color: 'var(--ink-1)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {locked ? '🔒 ' : ''}{getProgressLabel(l, l.progress)}
              </span>
              <span style={{ color: '#f97316', fontWeight: 700, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>+{l.ggReward} GG</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'rgb(var(--ink-rgb) / 0.1)', overflow: 'hidden', marginTop: 2 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: RANK_COLORS[l.rank] ?? 'var(--ink-3)' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

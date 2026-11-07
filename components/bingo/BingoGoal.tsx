'use client'

import { useEffect, useState } from 'react'
import { RANK_COLORS, RANK_LABELS, type RankName } from '@/lib/rankUtils'

interface Goal {
  seasonId: number | null
  ranks: Array<{ rank: string; squares: number; target: number }>
  complete: boolean
}

export default function BingoGoal() {
  const [goal, setGoal] = useState<Goal | null>(null)

  useEffect(() => {
    let live = true
    const load = () => fetch('/api/bingo/goal')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (live) setGoal(d) })
      .catch(() => {})
    load()
    const t = window.setInterval(load, 30_000)
    return () => { live = false; window.clearInterval(t) }
  }, [])

  if (!goal || goal.seasonId == null) return null

  return (
    <section>
    <h2 style={{
      fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.09em',
      opacity: 0.6, margin: '0 0 8px', fontWeight: 800,
    }}>
      Season goal
    </h2>
    <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '6px 10px', alignItems: 'center', fontSize: 12 }}>
      {goal.ranks.map(({ rank, squares, target }) => {
        const r = rank as RankName
        const pct = Math.min(100, (squares / Math.max(1, target)) * 100)
        const color = RANK_COLORS[r] ?? 'var(--primary)'
        return (
          <Row key={rank}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, whiteSpace: 'nowrap' }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
              {RANK_LABELS[r] ?? rank}
            </span>
            <span style={{ height: 8, borderRadius: 999, background: 'var(--muted)', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: color, borderRadius: 999, transition: 'width 0.4s ease-out' }} />
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, textAlign: 'right', color: squares >= target ? color : 'var(--muted-foreground)' }}>
              {squares.toLocaleString()}<span style={{ opacity: 0.6 }}> / {target.toLocaleString()}</span>
            </span>
          </Row>
        )
      })}
    </div>
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

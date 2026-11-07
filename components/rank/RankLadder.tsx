'use client'

import { useEffect, useState } from 'react'
import { loadRankUps, peekRankUps } from '@/lib/rankCache'
import { RankIconBadge } from '@/components/rank/RankIconBadge'
import { RankChallengesMini } from '@/components/rank/RankChallengesMini'
import { Fragment } from 'react'
import { RANK_COLORS, RANK_GG, RANK_LABELS, RANK_ORDER, cumulativeDivFloor, type RankName } from '@/lib/rankUtils'

const ROMAN = ['I', 'II', 'III'] as const

function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex)
  if (!m) return '#fff'
  const [r, g, b] = [m[1], m[2], m[3]].map(x => parseInt(x, 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#15181f' : '#fff'
}

function Bar({ start, end, position, color, reached, date }: {
  start: number; end: number; position: number; color: string; reached: boolean; date?: string
}) {
  const pct = reached ? 100 : end > start ? Math.max(0, Math.min(1, (position - start) / (end - start))) * 100 : 0
  return (
    <div style={{ height: date ? 15 : 5, borderRadius: 4, background: 'rgb(var(--ink-rgb) / 0.1)', overflow: 'hidden', marginTop: 3 }}>
      <div style={{
        width: `${pct}%`, height: '100%', background: color, borderRadius: 4,
        display: 'flex', alignItems: 'center', paddingLeft: date ? 6 : 0,
        fontSize: 10, fontWeight: 800, color: inkOn(color), letterSpacing: '0.02em', whiteSpace: 'nowrap',
      }}>
        {date}
      </div>
    </div>
  )
}


export function RankLadder({ rank, division, gg, username, scope, seasonId }: {
  rank: RankName; division: 1 | 2 | 3; gg: number
  username?: string
  scope?: string | null
  seasonId?: number | null
}) {
  const cached = username ? peekRankUps(username, scope ?? null, seasonId) : undefined
  const [ups, setUps] = useState(cached?.events ?? [])
  const [startedAt, setStartedAt] = useState<number | null>(cached?.startedAt ?? null)
  const [openRank, setOpenRank] = useState<RankName | null>(null)
  useEffect(() => {
    if (!username) return
    let live = true
    loadRankUps(username, scope ?? null, seasonId).then(d => {
      if (!live) return
      setUps(d.events)
      setStartedAt(d.startedAt)
    })
    return () => { live = false }
  }, [username, scope, seasonId])

  const position = cumulativeDivFloor(rank, 1) + gg
  const rows: { rank: RankName; div: 1 | 2 | 3; at: number }[] = []
  for (const r of RANK_ORDER) {
    if (r === 'peak') break
    for (const d of [1, 2, 3] as const) rows.push({ rank: r, div: d, at: cumulativeDivFloor(r, d) })
  }
  rows.push({ rank: 'peak', div: 3, at: RANK_ORDER.filter(r => r !== 'peak').reduce((sum, r) => sum + RANK_GG[r], 0) })

  const indexOf = (r: RankName, d: number) => rows.findIndex(x => x.rank === r && (r === 'peak' || x.div === d))
  const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
  const dateFor = (i: number): string | undefined => {
    if (i === 0) return startedAt != null ? fmt.format(new Date(startedAt)) : undefined
    const hit = ups.find(u => indexOf(u.toRank, u.toDivision) >= i)
    return hit ? fmt.format(new Date(hit.createdAt)) : undefined
  }

  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: '6px 0 2px', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {rows.map(({ rank: r, div: d, at }, i) => {
        const isPeak = r === 'peak'
        const current = isPeak ? rank === 'peak' : r === rank && d === division
        const reached = current || RANK_ORDER.indexOf(r) < RANK_ORDER.indexOf(rank) || (r === rank && d < division)
        const from = i === 0 ? 0 : rows[i - 1].at
        const toggle = () => setOpenRank(openRank === r ? null : r)
        return (
          <Fragment key={`${r}-${d}`}>
          <li
            role={isPeak ? undefined : 'button'}
            tabIndex={isPeak ? undefined : 0}
            aria-expanded={isPeak ? undefined : openRank === r}
            onClick={isPeak ? undefined : (e) => { e.stopPropagation(); toggle() }}
            onKeyDown={isPeak ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle() } }}
            style={{
              cursor: isPeak ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px', borderRadius: 6,
              background: current ? 'rgb(var(--ink-rgb) / 0.07)' : 'transparent',
            }}
          >
            <RankIconBadge rank={r} division={d} size="mini" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: current ? 800 : 600, color: reached && !current ? 'var(--ink-3)' : 'var(--ink-1)' }}>
                {RANK_LABELS[r]}{isPeak ? '' : ` ${ROMAN[d - 1]}`}
              </span>
              <Bar start={from} end={at} position={position} color={RANK_COLORS[r]} reached={reached} date={reached ? dateFor(i) : undefined} />
            </div>
            <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--ink-3)', fontWeight: 500 }}>
              {reached ? '✓' : `${position.toLocaleString()} / ${at.toLocaleString()} GG`}
            </span>
          </li>
          {!isPeak && d === 3 && openRank === r && (
            <li style={{ listStyle: 'none' }} onClick={(e) => e.stopPropagation()}>
              <RankChallengesMini rank={r} scope={scope ?? null} seasonId={seasonId} />
            </li>
          )}
          </Fragment>
        )
      })}
    </ol>
  )
}

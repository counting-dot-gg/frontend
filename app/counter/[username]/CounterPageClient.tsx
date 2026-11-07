'use client'

import BingoStats from '@/components/bingo/BingoStats'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { CounterProfile, CounterProfilePage, CounterStats } from './page'
import type { CounterRankProfileResponse, ThreadRankRow, RankName } from '@/lib/rankUtils'
import { RANK_COLORS, RANK_LABELS, RANK_ORDER, divFloor, divCeil, formatClockTime } from '@/lib/rankUtils'
import { calculateLevel, isMaxLevel, levelProgressPct } from '@/lib/levels'
import { formatDurationShort, formatDurationFull, formatDurationCompact } from '@/lib/duration'
import { medal } from '@/lib/counterUtils'
import { RankIconBadge } from '@/components/rank/RankIconBadge'
import { ContributionGraph, ClockCoverage, EndingsGraph } from './CoverageGraphs'
import type { ContributionDays, SecondsCoverage, EndingsCoverage } from './CoverageGraphs'

function formatTimeDiff(ms: number): string {
  const year = 31536000000, day = 86400000, hour = 3600000, minute = 60000, second = 1000
  const years = Math.floor(ms / year)
  const days = Math.floor((ms % year) / day)
  const hours = Math.floor((ms % day) / hour)
  const minutes = Math.floor((ms % hour) / minute)
  const seconds = Math.floor((ms % minute) / second)
  const parts: string[] = []
  if (years) parts.push(`${years} year${years > 1 ? 's' : ''}`)
  if (days) parts.push(`${days} day${days > 1 ? 's' : ''}`)
  if (hours && !years) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`)
  if (minutes && !years && !days) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`)
  if (seconds && !years && !days && !hours) parts.push(`${seconds} second${seconds > 1 ? 's' : ''}`)
  return parts.join(', ') || 'just now'
}

function formatAgeShort(ms: number): string {
  const day = 86400000
  const years = Math.floor(ms / (365 * day))
  const days = Math.floor((ms % (365 * day)) / day)
  if (years > 0) return `${years}y ${days}d`
  if (days > 0) return `${days}d`
  return 'today'
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

function pct(n: number, d: number): string {
  if (!d) return '0%'
  return (n / d * 100).toFixed(1) + '%'
}

function StatCell({ label, value, sub, wide }: { label: string; value: string; sub?: string; wide?: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: '10px 14px',
      background: 'rgb(var(--ink-rgb) / 0.03)',
      border: '1px solid rgb(var(--ink-rgb) / 0.06)',
      borderRadius: 6,
      gridColumn: wide ? '1 / -1' : undefined,
    }}>
      <span style={{ fontSize: '0.6rem', letterSpacing: '0.2em', color: 'rgb(var(--ink-rgb) / 0.52)', textTransform: 'uppercase' }}>{label}</span>
      <span style={{
        fontSize: wide ? '0.8rem' : '1rem',
        fontWeight: 700, color: 'var(--ink-1)', fontFamily: 'monospace',
        ...(wide ? { wordBreak: 'break-all' as const, userSelect: 'all' as const } : null),
      }}>{value}</span>
      {sub && <span style={{ fontSize: '0.65rem', color: 'rgb(var(--ink-rgb) / 0.48)' }}>{sub}</span>}
    </div>
  )
}

function ProgressBar({ value, color = '#f97316', height = 6 }: { value: number; color?: string; height?: number }) {
  return (
    <div style={{ width: '100%', height, background: 'rgb(var(--ink-rgb) / 0.08)', borderRadius: height }}>
      <div style={{ height, width: `${Math.max(0, Math.min(100, value))}%`, background: color, borderRadius: height, transition: 'width 0.3s' }} />
    </div>
  )
}

function LevelPip({ level, color }: { level: string; color: string }) {
  return (
    <div
      title={`Level ${level}`}
      style={{
        width: 22, height: 22, borderRadius: '50%',
        background: color,
        border: '2px solid var(--surface-raised)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: level.length > 2 ? '0.5rem' : '0.62rem',
        fontWeight: 800, color: '#fff', lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        boxShadow: '0 1px 2px rgb(var(--shadow-rgb) / 0.4)',
      }}
    >
      {level}
    </div>
  )
}

function RankBadge({ rank, division, size = 'sm' }: { rank: RankName; division: 1 | 2 | 3; size?: 'sm' | 'lg' }) {
  const color = RANK_COLORS[rank] ?? '#888'
  const label = RANK_LABELS[rank] ?? rank
  const px = size === 'lg' ? 14 : 11
  const divDots = [1, 2, 3].map(i => (
    <div key={i} style={{
      width: size === 'lg' ? 7 : 5,
      height: size === 'lg' ? 7 : 5,
      borderRadius: '50%',
      background: i <= division ? color : 'rgb(var(--ink-rgb) / 0.15)',
    }} />
  ))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: `2px ${size === 'lg' ? 10 : 7}px`,
        borderRadius: 4,
        background: color + '22',
        border: `1px solid ${color}55`,
        fontSize: px, fontWeight: 700, color, letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 2 }}>{divDots}</div>
    </div>
  )
}

type StatEntry = CounterStats[string]

function accuracyOf(d: StatEntry): number | null {
  const total = d.counts + d.mistakes
  return total > 0 ? (d.counts / total) * 100 : null
}

function firstCountHref(raw?: string): string | null {
  if (!raw) return null
  const slash = raw.indexOf('/')
  if (slash < 1) return null
  return `/thread/${raw.slice(0, slash)}/${raw.slice(slash + 1)}`
}

function AllStatsBand({ data, color }: { data: StatEntry; color: string }) {
  const acc = accuracyOf(data)
  const parity = data.odds + data.evens
  const oddPct = parity > 0 ? (data.odds / parity) * 100 : 0
  const href = firstCountHref(data.first_count)
  const secondsPosted =
    data.seconds_posted != null && data.seconds_posted > 0 ? data.seconds_posted : null
  const figCount = 3 + (secondsPosted != null || acc != null ? 1 : 0)

  const figure = (value: string, label: string, tint?: string, title?: string) => (
    <div style={{ minWidth: 0 }}>
      <div title={title} style={{
        fontSize: 'clamp(1.5rem, 4.5vw, 2.4rem)', fontWeight: 800, lineHeight: 1.05,
        fontVariantNumeric: 'tabular-nums', color: tint ?? 'var(--ink-1)',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 'clamp(0.6rem, 1.4vw, 0.72rem)', letterSpacing: '0.22em',
        fontWeight: 600, color: 'rgb(var(--ink-rgb) / 0.52)', marginTop: 4,
      }}>
        {label}
      </div>
    </div>
  )

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 12, marginBottom: 14,
      }}>
        {href && (
          <Link href={href} style={{
            fontSize: 'clamp(0.68rem, 1.5vw, 0.8rem)', whiteSpace: 'nowrap',
            color: 'rgb(var(--ink-rgb) / 0.55)', textDecoration: 'none',
          }}>
            first count →
          </Link>
        )}
      </div>

      <div className={`cgg-prof-figs cgg-prof-figs-${figCount}`}>
        {figure(data.counts.toLocaleString(), 'COUNTS')}
        {figure(data.posts.toLocaleString(), 'POSTS')}
        {figure(data.mistakes.toLocaleString(), 'MISTAKES', data.mistakes > 0 ? 'var(--danger)' : undefined)}
        {secondsPosted != null
          ? figure(
              formatDurationShort(secondsPosted),
              'TIME POSTING',
              'var(--success)',
              formatDurationFull(secondsPosted),
            )
          : acc != null && figure(`${acc.toFixed(1)}%`, 'ACCURACY', 'var(--success)')}
      </div>

      {parity > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ position: 'relative', display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${oddPct}%`, background: color, transition: 'width 0.3s ease' }} />
            <div style={{
              width: `${100 - oddPct}%`,
              background: `color-mix(in srgb, ${color} 28%, rgb(var(--ink-rgb) / 0.30))`,
              transition: 'width 0.3s ease',
            }} />
            <div
              aria-hidden
              style={{
                position: 'absolute', left: '50%', top: -1, bottom: -1, width: 1,
                background: 'var(--surface-raised)', opacity: 0.85,
              }}
            />
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginTop: 6,
            fontSize: 'clamp(0.7rem, 1.6vw, 0.85rem)', color: 'rgb(var(--ink-rgb) / 0.62)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: color }} />
              {data.odds.toLocaleString()} odd
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {data.evens.toLocaleString()} even
              <span style={{
                width: 7, height: 7, borderRadius: 2,
                background: `color-mix(in srgb, ${color} 28%, rgb(var(--ink-rgb) / 0.30))`,
              }} />
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

type StatSort = 'counts' | 'posts' | 'mistakes' | 'accuracy' | 'speed' | 'split' | 'time'

const LOWER_IS_BETTER: StatSort[] = ['speed', 'split']

function formatPb(us: number): string {
  const s = us / 1_000_000
  if (s < 60) return `${s.toFixed(3)}s`
  if (s < 600) return formatClockTime(us / 1000)
  const m = Math.floor(s / 60)
  return `${m}m ${(s - m * 60).toFixed(1)}s`
}

function pbReplayHref(d: StatEntry, metric: StatSort): string | null {
  const name = d.thread_name
  if (!name) return null
  const start = metric === 'speed' ? d.best_speed_start : d.best_split_start
  const end = metric === 'speed' ? d.best_speed_end : d.best_split_end
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  return `/replay/${name}?startValidCountNumber=${start}&endValidCountNumber=${end}`
}

function pbCountsPerSecond(d: StatEntry, metric: StatSort): number | null {
  const us = metric === 'speed' ? d.best_speed_us : d.best_split_us
  const start = metric === 'speed' ? d.best_speed_start : d.best_split_start
  const end = metric === 'speed' ? d.best_speed_end : d.best_split_end
  if (us == null || us <= 0 || start == null || end == null) return null
  const counts = Number(end) - Number(start)
  return counts > 0 ? counts / (us / 1_000_000) : null
}

const isPb = (metric: StatSort) => metric === 'speed' || metric === 'split'

type PbOrder = 'cps' | 'time'

function listValue(d: StatEntry, metric: StatSort, pbOrder: PbOrder = 'cps'): number | null {
  return isPb(metric) && pbOrder === 'cps' ? pbCountsPerSecond(d, metric) : metricValue(d, metric)
}

const listLowerIsBetter = (metric: StatSort, pbOrder: PbOrder) =>
  LOWER_IS_BETTER.includes(metric) && !(isPb(metric) && pbOrder === 'cps')

function metricValue(d: StatEntry, metric: StatSort): number | null {
  if (metric === 'accuracy') return accuracyOf(d)
  if (metric === 'speed') return d.best_speed_us ?? null
  if (metric === 'split') return d.best_split_us ?? null
  if (metric === 'time') return d.seconds_posted != null && d.seconds_posted > 0 ? d.seconds_posted : null
  return d[metric] as number
}

const SORTS: { key: StatSort; label: string }[] = [
  { key: 'counts', label: 'Counts' },
  { key: 'speed', label: 'Speed PB' },
  { key: 'split', label: 'Split PB' },
  { key: 'posts', label: 'Posts' },
  { key: 'mistakes', label: 'Mistakes' },
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'time', label: 'Time' },
]

function RankChip({ rank, metricLabel }: { rank?: number; metricLabel?: string }) {
  if (rank == null || rank < 1) return null
  const m = medal(rank)
  return (
    <span
      title={`#${rank.toLocaleString()} sitewide${metricLabel ? ` on ${metricLabel}` : ''}`}
      style={{
        position: 'relative', flexShrink: 0,
        minWidth: 30, padding: '2px 6px', borderRadius: 5,
        fontSize: 'clamp(0.66rem, 1.6vw, 1rem)', fontWeight: 800, textAlign: 'center',
        fontVariantNumeric: 'tabular-nums',
        background: m ? m.bg : 'rgb(var(--ink-rgb) / 0.08)',
        color: m ? m.color : 'rgb(var(--ink-rgb) / 0.55)',
      }}
    >
      {rank}
    </span>
  )
}

type RankRow = { rank: number; counter: string; value: number }
type RankListResponse = {
  metric: string
  total: number
  rank: number | null
  rows: RankRow[]
  counters: { uuid: string; username: string; name?: string; color?: string }[]
}

function formatRankValue(metric: StatSort, v: number): string {
  if (metric === 'accuracy') return `${v.toFixed(1)}%`
  if (metric === 'speed' || metric === 'split') return formatPb(v)
  if (metric === 'time') return formatDurationCompact(v)
  return Math.round(v).toLocaleString()
}

function ThreadLeaderboard({ threadName, metric, meUuid, color }: {
  threadName: string; metric: StatSort; meUuid: string; color: string
}) {
  const [rows, setRows] = useState<RankRow[] | null>(null)
  const [names, setNames] = useState<Map<string, { label: string; color?: string }>>(new Map())
  const [total, setTotal] = useState(0)
  const [myRank, setMyRank] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const absorb = useCallback((data: RankListResponse) => {
    setTotal(data.total)
    setMyRank(data.rank)
    setNames(prev => {
      const next = new Map(prev)
      for (const c of data.counters ?? []) {
        next.set(c.uuid, { label: c.name || c.username, color: c.color })
      }
      return next
    })
    setRows(prev => {
      const byRank = new Map((prev ?? []).map(r => [r.rank, r] as const))
      for (const r of data.rows ?? []) byRank.set(r.rank, r)
      return [...byRank.values()].sort((a, b) => a.rank - b.rank)
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    setRows(null)
    setNames(new Map())
    setTotal(0)
    setMyRank(null)
    setError(null)
    setLoading(true)

    void (async () => {
      try {
        const res = await fetch('/api/thread/stats/threadRankList', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            thread: threadName, metric, around: meUuid, top: 5, span: 1,
          }),
        })
        if (!res.ok) throw new Error('unavailable')
        const data: RankListResponse = await res.json()
        if (cancelled) return
        absorb(data)
      } catch {
        if (!cancelled) setError('Could not load the leaderboard.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [metric, threadName, meUuid, absorb])


  const call = async (body: Record<string, unknown>) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/thread/stats/threadRankList', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ thread: threadName, metric, ...body }),
      })
      if (!res.ok) throw new Error('unavailable')
      absorb(await res.json())
    } catch {
      setError('Could not load the leaderboard.')
    } finally {
      setLoading(false)
    }
  }

  const gapButton = (key: string, offset: number, count: number) => (
    <button
      key={key}
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        call({ around: meUuid, offset, limit: Math.min(count, 100) })
      }}
      disabled={loading}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: 'none', border: 'none', padding: '2px 4px',
        cursor: loading ? 'default' : 'pointer', font: 'inherit',
        fontSize: 'clamp(0.66rem, 1.4vw, 0.74rem)',
        color: 'rgb(var(--ink-rgb) / 0.45)', fontStyle: 'italic',
      }}
    >
      {loading ? 'Loading…' : `… ${count.toLocaleString()} more`}
    </button>
  )

  if (rows === null) {
    return (
      <div style={{
        padding: '2px 4px 10px',
        fontSize: 'clamp(0.68rem, 1.5vw, 0.76rem)',
        color: 'rgb(var(--ink-rgb) / 0.45)',
      }}>
        {error ? (
          <>
            <span style={{ color: 'var(--danger)' }}>{error}</span>{' '}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); call({ around: meUuid, top: 5, span: 1 }) }}
              disabled={loading}
              style={{
                background: 'none', border: 'none', padding: 0, font: 'inherit',
                color, fontWeight: 700, textDecoration: 'underline',
                cursor: loading ? 'default' : 'pointer',
              }}
            >
              Retry
            </button>
          </>
        ) : (
          'Loading leaderboard…'
        )}
      </div>
    )
  }

  if (total === 0) {
    return (
      <div style={{ padding: '2px 4px 10px', fontSize: '0.72rem', color: 'rgb(var(--ink-rgb) / 0.45)' }}>
        No leaderboard for this metric yet.
      </div>
    )
  }

  const pieces: React.ReactNode[] = []
  let prevRank = 0
  for (const r of rows) {
    const missing = r.rank - prevRank - 1
    if (missing > 0) pieces.push(gapButton(`gap-${r.rank}`, prevRank, missing))

    const isMe = r.counter === meUuid
    const who = names.get(r.counter)
    const m = medal(r.rank)
    pieces.push(
      <div
        key={r.rank}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px',
          borderRadius: 4, fontVariantNumeric: 'tabular-nums',
          fontSize: 'clamp(0.7rem, 1.5vw, 0.8rem)',
          background: isMe ? `${color}1f` : undefined,
          fontWeight: isMe ? 800 : 500,
        }}
      >
        <span style={{
          minWidth: 34, textAlign: 'right', flexShrink: 0, fontWeight: 800,
          color: m ? m.color : 'rgb(var(--ink-rgb) / 0.45)',
        }}>
          {r.rank}
        </span>
        <span style={{
          flex: 1, minWidth: 0, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: who?.color || 'var(--ink-1)',
        }}>
          {who?.label ?? r.counter.slice(0, 8)}
        </span>
        <span style={{ flexShrink: 0, color: 'var(--ink-1)' }}>
          {formatRankValue(metric, r.value)}
        </span>
      </div>,
    )
    prevRank = r.rank
  }
  const trailing = total - prevRank
  if (trailing > 0) pieces.push(gapButton('gap-end', prevRank, trailing))

  return (
    <div style={{ padding: '2px 4px 10px' }}>
      <div style={{
        fontSize: '0.62rem', letterSpacing: '0.18em', fontWeight: 700,
        color: 'rgb(var(--ink-rgb) / 0.4)', marginBottom: 4,
      }}>
        {SORTS.find(x => x.key === metric)?.label.toUpperCase()} · {total.toLocaleString()} ranked
        {myRank == null && ' · you are unranked here'}
      </div>
      {pieces}
      {error && (
        <div style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: 4 }}>{error}</div>
      )}
    </div>
  )
}

function ThreadStatsRow({ title, data, max, metric, color, meUuid, pbOrder = 'cps' }: {
  title: string; data: StatEntry; max: number; metric: StatSort; color: string
  pbOrder?: PbOrder
  meUuid: string
}) {
  const [open, setOpen] = useState(false)
  const acc = accuracyOf(data)
  const raw = metricValue(data, metric)
  const lower = LOWER_IS_BETTER.includes(metric)
  const cps = isPb(metric) ? pbCountsPerSecond(data, metric) : null
  const shown = listValue(data, metric, pbOrder)
  const fill = shown == null || max <= 0 ? 0
    : listLowerIsBetter(metric, pbOrder) ? (max / shown) * 100 : (shown / max) * 100
  const value = raw ?? 0
  const replayHref = lower ? pbReplayHref(data, metric) : null
  const href = firstCountHref(data.first_count)

  return (
    <div style={{ borderBottom: '1px solid rgb(var(--ink-rgb) / 0.05)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 'clamp(6px, 1.6vw, 10px)', width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          padding: 'clamp(9px, 1.8vw, 10px) 4px', color: 'inherit', position: 'relative',
        }}
      >
        <div style={{
          position: 'absolute', left: 0, top: 2, bottom: 2,
          width: `${Math.min(fill, 100)}%`,
          background: `${color}14`, borderLeft: `2px solid ${color}55`,
          transition: 'width 0.3s ease', pointerEvents: 'none',
        }} />
        <RankChip
          rank={data.ranks?.[metric]}
          metricLabel={SORTS.find(s => s.key === metric)?.label.toLowerCase()}
        />
        <span style={{
          position: 'relative', flex: 1, minWidth: 0,
          fontSize: 'clamp(0.84rem, 2.1vw, 1.05rem)', fontWeight: 700,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-1)',
        }}>
          {title}
        </span>
        {metric === 'posts' ? null : <span className="cgg-prof-sub" style={{
          position: 'relative', fontSize: 'clamp(0.7rem, 1.5vw, 0.82rem)',
          color: 'rgb(var(--ink-rgb) / 0.55)',
          fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        }}>
          {data.posts.toLocaleString()} posts
        </span>}
        <span style={{
          position: 'relative', minWidth: 'clamp(58px, 9vw, 88px)', textAlign: 'right',
          fontWeight: 800, fontSize: 'clamp(0.88rem, 2vw, 1.08rem)',
          fontVariantNumeric: 'tabular-nums', color: 'var(--ink-1)',
          whiteSpace: 'nowrap',
        }}>
          {metric === 'accuracy'
            ? (acc == null ? '-' : `${acc.toFixed(1)}%`)
            : lower
              ? raw == null
                ? '—'
                : replayHref
                  ? (
                    <>
                      {cps != null && <span>{cps.toFixed(2)} counts/s</span>}
                      <Link
                        href={replayHref}
                        onClick={(e) => e.stopPropagation()}
                        style={{ color, textDecoration: 'none', borderBottom: `1px dotted ${color}`, marginLeft: cps != null ? 10 : 0 }}
                        title="Watch this run"
                      >
                        {formatPb(raw)}
                      </Link>
                    </>
                  )
                  : <>{cps != null && <span>{cps.toFixed(2)} counts/s</span>}<span style={{ marginLeft: cps != null ? 10 : 0 }}>{formatPb(raw)}</span></>
              : metric === 'time'
                ? (raw == null ? '—' : formatDurationCompact(raw))
                : (raw ?? 0).toLocaleString()}
        </span>
      </button>

      {open && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '5px 18px', padding: '0 4px 10px',
          fontSize: 'clamp(0.72rem, 1.6vw, 0.84rem)', color: 'rgb(var(--ink-rgb) / 0.45)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          <span>Counts <strong style={{ color: 'var(--ink-1)' }}>{data.counts.toLocaleString()}</strong></span>
          <span>Mistakes <strong style={{ color: data.mistakes > 0 ? 'var(--danger)' : 'var(--ink-1)' }}>{data.mistakes.toLocaleString()}</strong></span>
          {acc != null && <span>Accuracy <strong style={{ color: 'var(--success-ink)' }}>{acc.toFixed(1)}%</strong></span>}
          <span>Odd/Even <strong style={{ color: 'var(--ink-1)' }}>{data.odds.toLocaleString()} / {data.evens.toLocaleString()}</strong></span>
          {href && <Link href={href} style={{ color: color, textDecoration: 'none' }}>first count →</Link>}
        </div>
      )}

      {open && data.thread_name && (
        <ThreadLeaderboard
          threadName={data.thread_name}
          metric={metric}
          meUuid={meUuid}
          color={color}
        />
      )}
    </div>
  )
}

function ThreadStatsList({ stats, color, meUuid }: {
  stats: [string, StatEntry][]; color: string; meUuid: string
}) {
  const [metric, setMetric] = useState<StatSort>('counts')
  const [pbOrder, setPbOrder] = useState<PbOrder>('cps')

  const sorted = useMemo(() => {
    const lower = listLowerIsBetter(metric, pbOrder)
    const value = (d: StatEntry) => {
      const v = listValue(d, metric, pbOrder)
      if (v == null) return lower ? Number.POSITIVE_INFINITY : -1
      return v
    }
    return [...stats].sort((a, b) =>
      lower ? value(a[1]) - value(b[1]) : value(b[1]) - value(a[1]),
    )
  }, [stats, metric, pbOrder])

  const max = useMemo(() => {
    const lower = listLowerIsBetter(metric, pbOrder)
    const values = sorted
      .map(([, d]) => listValue(d, metric, pbOrder))
      .filter((v): v is number => v != null && v > 0)
    if (values.length === 0) return 0
    return lower ? Math.min(...values) : Math.max(...values)
  }, [sorted, metric, pbOrder])

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap', marginBottom: 8,
      }}>
        <div style={{
          fontSize: 'clamp(0.78rem, 2.4vw, 1.5rem)', letterSpacing: '0.25em',
          fontWeight: 700, color: 'rgb(var(--ink-rgb) / 0.52)',
        }}>
          BY THREAD · {stats.length}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {SORTS.map(s => (
            <button
              key={s.key}
              onClick={() => setMetric(s.key)}
              style={{
                padding: 'clamp(3px, 0.8vw, 5px) clamp(8px, 1.6vw, 11px)', borderRadius: 10,
                fontSize: 'clamp(0.66rem, 1.5vw, 0.8rem)', fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${metric === s.key ? color : 'rgb(var(--ink-rgb) / 0.12)'}`,
                background: metric === s.key ? `${color}1f` : 'transparent',
                color: metric === s.key ? color : 'rgb(var(--ink-rgb) / 0.4)',
              }}
            >
              {s.label}
            </button>
          ))}
          {isPb(metric) && (
            <div role="group" aria-label="Order personal bests by" style={{ display: 'flex', marginLeft: 6, borderRadius: 10, border: '1px solid rgb(var(--ink-rgb) / 0.12)', overflow: 'hidden' }}>
              {([['cps', 'counts/s'], ['time', 'time']] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setPbOrder(k)}
                  aria-pressed={pbOrder === k}
                  style={{
                    padding: 'clamp(3px, 0.8vw, 5px) clamp(8px, 1.6vw, 11px)', border: 'none', cursor: 'pointer',
                    fontSize: 'clamp(0.66rem, 1.5vw, 0.8rem)', fontWeight: 700,
                    background: pbOrder === k ? `${color}1f` : 'transparent',
                    color: pbOrder === k ? color : 'rgb(var(--ink-rgb) / 0.4)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {sorted.map(([title, data]) => (
        <ThreadStatsRow
          key={title}
          title={title}
          data={data}
          max={max}
          metric={metric}
          color={color}
          meUuid={meUuid}
          pbOrder={pbOrder}
        />
      ))}
    </div>
  )
}

function CompactRankRow({ row }: { row: ThreadRankRow }) {
  const floor = divFloor(row.rank, row.division)
  const ceil = divCeil(row.rank, row.division)
  const hasNext = isFinite(ceil) && ceil > floor
  const pctVal = hasNext ? Math.min(100, Math.round(((row.gg - floor) / (ceil - floor)) * 100)) : 100
  const color = RANK_COLORS[row.rank] ?? '#888'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <RankBadge rank={row.rank} division={row.division} />
      <span style={{ flex: '0 1 auto', fontSize: '0.8rem', color: 'var(--ink-3)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.threadName ?? undefined}>
        {row.threadName ?? 'Unknown'}
      </span>
      <div style={{ flex: 1 }}>
        <ProgressBar value={pctVal} color={color} height={4} />
      </div>
      <span style={{ fontSize: '0.7rem', color: 'var(--ink-4)', flexShrink: 0, minWidth: 70, textAlign: 'right', fontFamily: 'monospace' }}>
        {row.ggTotal.toLocaleString()} GG
      </span>
    </div>
  )
}

const SOCIAL_PLATFORMS: { id: string; label: string; placeholder: string; color: string }[] = [
  { id: 'discord', label: 'Discord', placeholder: 'username', color: '#5865f2' },
  { id: 'reddit', label: 'Reddit', placeholder: 'u/username', color: '#ff4500' },
]

function SocialIcon({ platform }: { platform: string }) {
  const icons: Record<string, string> = {
    discord: '🎮',
    reddit: '🤖',
  }
  return <span>{icons[platform] ?? '🔗'}</span>
}

type SocialLink = { platform: string; handle: string }

function EditProfileModal({
  bio: initialBio,
  socialLinks: initialLinks,
  onClose,
  onSaved,
}: {
  bio: string
  socialLinks: SocialLink[]
  onClose: () => void
  onSaved: (bio: string, socialLinks: SocialLink[]) => void
}) {
  const [bio, setBio] = useState(initialBio)
  const [links, setLinks] = useState<SocialLink[]>(initialLinks)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const API = ''

  const addLink = (platform: string) => {
    setLinks(l => [...l, { platform, handle: '' }])
  }

  const updateLink = (i: number, handle: string) => {
    setLinks(l => l.map((x, idx) => idx === i ? { ...x, handle } : x))
  }

  const removeLink = (i: number) => {
    setLinks(l => l.filter((_, idx) => idx !== i))
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/counter/update_profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bio: bio.trim(),
          socialLinks: links.filter(l => l.handle.trim()).map(l => ({ platform: l.platform, handle: l.handle.trim() })),
        }),
      })
      if (!res.ok) {
        const raw = await res.text().catch(() => '')
        let msg = raw
        try {
          const parsed = JSON.parse(raw)
          if (typeof parsed?.message === 'string') msg = parsed.message
          else if (Array.isArray(parsed?.message)) msg = parsed.message.join(', ')
        } catch {}
        setError(msg || 'Failed to save')
        return
      }
      const saved = links.filter(l => l.handle.trim()).map(l => ({ platform: l.platform, handle: l.handle.trim() }))
      onSaved(bio.trim(), saved)
      onClose()
    } catch (e) {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgb(var(--shadow-rgb) / 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface-raised)', border: '1px solid rgb(var(--ink-rgb) / 0.12)',
          borderRadius: 12, padding: 24, width: '100%', maxWidth: 480,
          display: 'flex', flexDirection: 'column', gap: 18,
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--ink-1)' }}>Edit Profile</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: '0.7rem', letterSpacing: '0.15em', color: 'rgb(var(--ink-rgb) / 0.55)', textTransform: 'uppercase' }}>
            Bio <span style={{ color: bio.length > 450 ? '#f97316' : '#444', fontFamily: 'monospace', letterSpacing: 0 }}>{bio.length}/500</span>
          </label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value.slice(0, 500))}
            placeholder="Tell people about yourself…"
            rows={4}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgb(var(--ink-rgb) / 0.04)', border: '1px solid rgb(var(--ink-rgb) / 0.1)',
              borderRadius: 6, padding: '8px 10px', color: 'var(--ink-1)', fontSize: '0.85rem',
              resize: 'vertical', outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '0.7rem', letterSpacing: '0.15em', color: 'rgb(var(--ink-rgb) / 0.55)', textTransform: 'uppercase' }}>
            Linked Accounts
          </div>
          {links.map((link, i) => {
            const meta = SOCIAL_PLATFORMS.find(p => p.id === link.platform)
            return (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: meta?.color ?? '#888', minWidth: 72, flexShrink: 0 }}>{meta?.label ?? link.platform}</span>
                <input
                  type="text"
                  value={link.handle}
                  onChange={e => updateLink(i, e.target.value)}
                  placeholder={meta?.placeholder ?? 'username'}
                  style={{
                    flex: 1, background: 'rgb(var(--ink-rgb) / 0.04)', border: '1px solid rgb(var(--ink-rgb) / 0.1)',
                    borderRadius: 6, padding: '6px 8px', color: 'var(--ink-1)', fontSize: '0.8rem', outline: 'none',
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  onClick={() => removeLink(i)}
                  style={{ background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}
                >✕</button>
              </div>
            )
          })}

          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
            {SOCIAL_PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => addLink(p.id)}
                style={{
                  fontSize: '0.7rem', padding: '3px 8px', borderRadius: 4,
                  background: p.color + '15', border: `1px solid ${p.color}40`,
                  color: p.color, cursor: 'pointer',
                }}
              >
                + {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '7px 16px', borderRadius: 6, border: '1px solid rgb(var(--ink-rgb) / 0.1)',
            background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '0.85rem',
          }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{
            padding: '7px 16px', borderRadius: 6, border: 'none',
            background: '#f97316', color: '#fff', cursor: saving ? 'default' : 'pointer',
            fontSize: '0.85rem', fontWeight: 600, opacity: saving ? 0.6 : 1,
          }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

type Tab = 'stats' | 'info' | 'achievements' | 'rank'

type Props = {
  counter: CounterProfile
  profilePage: CounterProfilePage
  avatarUrl: string | undefined
  sortedStats: [string, CounterStats[string]][]
  allStats: CounterStats[string] | null
  rankProfile: CounterRankProfileResponse | null
  earnedAchievements: any[]
  allAchievements: any[]
  isMod: boolean
  isOwnProfile: boolean
  viewerUuid: string | null
  joinTs: number | null
  contributionDays: ContributionDays
  timeDays?: ContributionDays
  secondsCoverage: SecondsCoverage | null
  endingsCoverage: EndingsCoverage | null
}

export default function CounterPageClient({
  counter, profilePage, avatarUrl, sortedStats, allStats, rankProfile,
  earnedAchievements, allAchievements, isMod, isOwnProfile, joinTs,
  contributionDays, timeDays, secondsCoverage, endingsCoverage,
}: Props) {
  const [tab, setTab] = useState<Tab>('stats')
  const [showEdit, setShowEdit] = useState(false)
  const [bio, setBio] = useState(profilePage.bio ?? '')
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(profilePage.socialLinks ?? [])

  const color = counter.color || '#f97316'
  const hasContributions = useMemo(
    () => Object.keys(contributionDays ?? {}).length > 0,
    [contributionDays],
  )
  const lvl = calculateLevel(counter.xp)
  const xpPct = levelProgressPct(counter.xp, lvl)

  const nameDisplay = counter.emoji
    ? `${counter.emoji} ${counter.name} ${counter.emoji}`
    : counter.name

  const earnedIds = new Set(earnedAchievements.filter(a => a.isComplete).map((a: any) => a.achievementId))
  const earnedPublic = allAchievements.filter((a: any) => a.isPublic && earnedIds.has(a.id))
  const unearnedPublic = allAchievements.filter((a: any) => a.isPublic && !earnedIds.has(a.id))
  const secret = allAchievements.filter((a: any) => !a.isPublic && earnedIds.has(a.id))

  const sitewideRank = rankProfile?.ranks.find(r => r.threadUuid == null)
  const threadRanks = rankProfile
    ? [...rankProfile.ranks.filter(r => r.threadUuid != null)].sort((a, b) => {
        const rd = RANK_ORDER.indexOf(b.rank) - RANK_ORDER.indexOf(a.rank)
        return rd !== 0 ? rd : b.division - a.division
      })
    : []

  const tabs: { key: Tab; label: string }[] = [
    { key: 'stats', label: 'Stats' },
    { key: 'info', label: 'Info' },
    { key: 'achievements', label: 'Achievements' },
    { key: 'rank', label: 'Rank' },
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px', color: 'var(--ink-1)' }}>

      <style>{`
        .cgg-prof-figs { display: grid; gap: 18px; }
        .cgg-prof-figs-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .cgg-prof-figs-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        @media (max-width: 640px) {
          .cgg-prof-figs { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 12px; }
        }
        @media (max-width: 560px) {
          .cgg-prof-sub { display: none; }
        }
      `}</style>

      <div style={{
        display: 'flex', gap: 'clamp(12px, 3vw, 20px)', alignItems: 'flex-start', flexWrap: 'wrap',
        padding: 'clamp(14px, 3.5vw, 20px) clamp(14px, 4vw, 24px)',
        background: `linear-gradient(135deg, ${color}12, transparent)`,
        border: `1px solid ${color}30`,
        borderRadius: 12, marginBottom: 20,
      }}>
        <div style={{ flexShrink: 0, position: 'relative' }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={counter.name} width={80} height={80}
              style={{
                width: 'clamp(56px, 17vw, 80px)', height: 'clamp(56px, 17vw, 80px)',
                borderRadius: '50%', border: `3px solid ${color}55`, display: 'block',
              }} />
          ) : (
            <div style={{
              width: 'clamp(56px, 17vw, 80px)', height: 'clamp(56px, 17vw, 80px)', borderRadius: '50%',
              background: color + '33', border: `3px solid ${color}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 700, color,
            }}>
              {counter.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          {sitewideRank && (
            <div style={{ position: 'absolute', bottom: -2, left: -4 }}>
              <RankIconBadge rank={sitewideRank.rank} division={sitewideRank.division} size="mini" />
            </div>
          )}
          <div style={{ position: 'absolute', bottom: -2, right: -4 }}>
            <LevelPip level={lvl.level} color={color} />
          </div>
        </div>

        <div style={{ flex: '1 1 200px', minWidth: 'min(200px, 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.2rem, 5.5vw, 1.6rem)', fontWeight: 800, color, wordBreak: 'break-word' }}>{nameDisplay}</h1>
            {counter.title && (
              <span style={{ fontSize: '0.75rem', color: 'rgb(var(--ink-rgb) / 0.62)', fontStyle: 'italic' }}>{counter.title}</span>
            )}
            {isMod && counter.roles.includes('banned') && (
              <span style={{ fontSize: '0.7rem', background: '#ef444422', color: 'var(--danger)', border: '1px solid #ef444444', borderRadius: 4, padding: '2px 6px' }}>BANNED</span>
            )}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--ink-3)', marginBottom: 10 }}>@{counter.username}</div>

          {bio && (
            <p style={{ margin: '6px 0 4px', fontSize: '0.85rem', color: 'var(--ink-3)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {bio}
            </p>
          )}

          {socialLinks.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {socialLinks.map((link, i) => {
                const meta = SOCIAL_PLATFORMS.find(p => p.id === link.platform)
                const href = link.platform === 'reddit'
                  ? `https://reddit.com/u/${link.handle.replace(/^u\//, '')}`
                  : undefined
                const chip = (
                  <>
                    <SocialIcon platform={link.platform} />
                    {link.handle}
                  </>
                )
                const style: React.CSSProperties = {
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: '0.75rem', color: meta?.color ?? '#888',
                  background: (meta?.color ?? '#888') + '15',
                  border: `1px solid ${(meta?.color ?? '#888')}35`,
                  borderRadius: 4, padding: '2px 8px', textDecoration: 'none',
                }
                return href
                  ? <a key={i} href={href} target="_blank" rel="noopener noreferrer" style={style}>{chip}</a>
                  : <span key={i} style={style}>{chip}</span>
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--ink-4)', alignItems: 'center' }}>
            {counter.pronouns?.[0] && counter.pronouns[0] !== 'they' && (
              <span>{counter.pronouns[0]}/{counter.pronouns[1]}/{counter.pronouns[2]}</span>
            )}
            {joinTs && (
              <span title={`Member for ${formatTimeDiff(Date.now() - joinTs)}`}>
                Joined {formatDate(joinTs)} · {formatAgeShort(Date.now() - joinTs)}
              </span>
            )}
            {isOwnProfile && (
              <button onClick={() => setShowEdit(true)} style={{
                padding: '2px 8px', borderRadius: 4,
                background: 'rgb(var(--ink-rgb) / 0.06)', border: '1px solid rgb(var(--ink-rgb) / 0.12)',
                color: 'var(--ink-4)', cursor: 'pointer', fontSize: '0.68rem',
                lineHeight: 1.6, whiteSpace: 'nowrap',
              }}>
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="profile-detail-optional" style={{
          flex: '1 1 140px', minWidth: 140,
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 10px',
        }}>
          <div style={{
            fontSize: '0.65rem', letterSpacing: '0.2em', whiteSpace: 'nowrap',
            color: 'rgb(var(--ink-rgb) / 0.52)', flexShrink: 0,
          }}>
            LEVEL {lvl.level}
          </div>
          <div
            style={{ flex: '1 1 90px', minWidth: 70 }}
            title={`${counter.xp.toLocaleString()}${isMaxLevel(lvl) ? ' XP (max)' : ` / ${lvl.xpRequired.toLocaleString()} XP`}`}
          >
            <ProgressBar value={xpPct} color={color} height={8} />
          </div>
          {sitewideRank && (
            <div
              style={{ flexShrink: 0 }}
              title={`${sitewideRank.ggTotal.toLocaleString()} GG total`}
            >
              <RankBadge rank={sitewideRank.rank} division={sitewideRank.division} size="lg" />
            </div>
          )}
          <div className="profile-detail-optional" style={{
            fontSize: '0.65rem', color: 'var(--ink-5)', fontFamily: 'monospace',
            flexBasis: '100%',
          }}>
            {counter.xp.toLocaleString()} {isMaxLevel(lvl) ? 'XP (max)' : `/ ${lvl.xpRequired.toLocaleString()} XP`}
            {sitewideRank && <> · {sitewideRank.ggTotal.toLocaleString()} GG</>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgb(var(--ink-rgb) / 0.08)', marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: tab === t.key ? 700 : 400,
            color: tab === t.key ? color : 'var(--ink-4)',
            borderBottom: tab === t.key ? `2px solid ${color}` : '2px solid transparent',
            marginBottom: -1,
            transition: 'color 0.1s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgb(var(--ink-rgb) / 0.08)' }}>
            <div style={{ height: 60, background: color }} />
            <div style={{ padding: '10px 14px', background: 'rgb(var(--ink-rgb) / 0.03)', fontSize: '0.8rem', color: 'var(--ink-3)' }}>
              Color: <span style={{ color, fontFamily: 'monospace', fontWeight: 600 }}>{color}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 6 }}>
            <StatCell label="UUID" value={counter.uuid} sub={`ID: ${counter.id}`} wide />
            <StatCell label="Rainbow" value={counter.rainbow?.toString() ?? '-'} sub="ms reply time" />
            {counter.pronouns?.[0] && (
              <StatCell label="Pronouns" value={`${counter.pronouns[0]}/${counter.pronouns[1]}/${counter.pronouns[2]}`} />
            )}
            {joinTs && <StatCell label="Member for" value={formatTimeDiff(Date.now() - joinTs)} />}
          </div>


          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {counter.roles.map(r => (
              <span key={r} style={{
                fontSize: '0.7rem', padding: '3px 8px', borderRadius: 4,
                background: r === 'admin' ? '#ef444422' : r === 'mod' ? '#f9731622' : 'rgb(var(--ink-rgb) / 0.06)',
                border: `1px solid ${r === 'admin' ? '#ef444444' : r === 'mod' ? '#f9731644' : 'rgb(var(--ink-rgb) / 0.1)'}`,
                color: r === 'admin' ? 'var(--danger)' : r === 'mod' ? '#f97316' : '#888',
                fontWeight: 600,
              }}>{r}</span>
            ))}
          </div>

          {isMod && (
            <div style={{ display: 'flex', gap: 8, padding: '12px 14px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-4)', marginRight: 4 }}>Mod:</span>
              <ModButton uuid={counter.uuid} action="ban" active={counter.roles.includes('banned')} />
              <ModButton uuid={counter.uuid} action="mute" active={counter.roles.includes('muted')} />
            </div>
          )}
        </div>
      )}

      {tab === 'stats' && (
        <div>
          {allStats && <AllStatsBand data={allStats} color={color} />}
          {hasContributions && (
            <ContributionGraph days={contributionDays} timeDays={timeDays} color={color} since={joinTs} />
          )}
          {((secondsCoverage && secondsCoverage.covered > 0) ||
            (endingsCoverage && endingsCoverage.covered > 0)) && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))',
                gap: '20px 28px',
                alignItems: 'stretch',
                marginBottom: 28,
              }}
            >
              {secondsCoverage && secondsCoverage.covered > 0 && (
                <ClockCoverage coverage={secondsCoverage} color={color} />
              )}
              {endingsCoverage && endingsCoverage.covered > 0 && (
                <EndingsGraph coverage={endingsCoverage} color={color} />
              )}
            </div>
          )}
          <BingoStats uuid={counter.uuid} color={color} />
          {sortedStats.length === 0 ? (
            <div style={{ color: 'var(--ink-5)', padding: 16 }}>No thread stats yet.</div>
          ) : (
            <ThreadStatsList stats={sortedStats} color={color} meUuid={counter.uuid} />
          )}
        </div>
      )}

      {tab === 'achievements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--ink-3)' }}>
            Unlocked: <span style={{ color: 'var(--ink-1)', fontWeight: 600 }}>{earnedPublic.length}</span>
            <span style={{ color: 'var(--ink-3)' }}> / {earnedPublic.length + unearnedPublic.length}</span>
            {secret.length > 0 && <span style={{ color: 'var(--ink-3)' }}> + {secret.length} secret</span>}
          </div>

          {earnedPublic.length > 0 && (
            <AchievementGrid title="Unlocked" achievements={earnedPublic} locked={false} />
          )}
          {secret.length > 0 && (
            <AchievementGrid title="Secret" achievements={secret} locked={false} />
          )}
          {unearnedPublic.length > 0 && (
            <AchievementGrid title="Locked" achievements={unearnedPublic} locked={true} />
          )}
          {earnedPublic.length === 0 && unearnedPublic.length === 0 && (
            <div style={{ color: 'var(--ink-3)' }}>No achievements loaded.</div>
          )}
        </div>
      )}

      {tab === 'rank' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!rankProfile ? (
            <div style={{ color: 'var(--ink-5)' }}>No rank data available.</div>
          ) : (
            <>
              {sitewideRank && (
                <div style={{
                  padding: '16px 20px',
                  background: `${RANK_COLORS[sitewideRank.rank]}12`,
                  border: `1px solid ${RANK_COLORS[sitewideRank.rank]}30`,
                  borderRadius: 10,
                }}>
                  <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: 'rgb(var(--ink-rgb) / 0.52)', marginBottom: 10 }}>SITEWIDE RANK</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <RankBadge rank={sitewideRank.rank} division={sitewideRank.division} size="lg" />
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <ProgressBar
                        value={(() => {
                          const fl = divFloor(sitewideRank.rank, sitewideRank.division)
                          const cl = divCeil(sitewideRank.rank, sitewideRank.division)
                          return isFinite(cl) && cl > fl ? Math.min(100, Math.round(((sitewideRank.gg - fl) / (cl - fl)) * 100)) : 100
                        })()}
                        color={RANK_COLORS[sitewideRank.rank]}
                        height={8}
                      />
                      <div style={{ fontSize: '0.7rem', color: 'var(--ink-5)', marginTop: 4, fontFamily: 'monospace' }}>
                        {sitewideRank.gg.toLocaleString()} GG this div · {sitewideRank.ggTotal.toLocaleString()} total
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {threadRanks.length > 0 && (
                <div style={{ padding: '14px 16px', background: 'rgb(var(--ink-rgb) / 0.02)', border: '1px solid rgb(var(--ink-rgb) / 0.07)', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: 'rgb(var(--ink-rgb) / 0.48)', marginBottom: 12 }}>THREAD RANKS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {threadRanks.map(r => <CompactRankRow key={r.id} row={r} />)}
                  </div>
                </div>
              )}

              {rankProfile.ranks.length === 0 && (
                <div style={{ color: 'var(--ink-5)' }}>No rank data yet for this counter.</div>
              )}
            </>
          )}
        </div>
      )}

      {showEdit && (
        <EditProfileModal
          bio={bio}
          socialLinks={socialLinks}
          onClose={() => setShowEdit(false)}
          onSaved={(newBio, newLinks) => { setBio(newBio); setSocialLinks(newLinks) }}
        />
      )}
    </div>
  )
}

function AchievementGrid({ title, achievements, locked }: { title: string; achievements: any[]; locked: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-3)', marginBottom: 8, letterSpacing: '0.1em' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6 }}>
        {achievements.map((a: any) => (
          <Link key={a.id} href={`/achievements/${a.id}`} style={{
            display: 'block', textDecoration: 'none', color: 'inherit',
            padding: '10px 12px',
            background: locked ? 'rgb(var(--ink-rgb) / 0.02)' : 'rgb(var(--ink-rgb) / 0.04)',
            border: `1px solid ${locked ? 'rgb(var(--ink-rgb) / 0.05)' : 'rgb(var(--ink-rgb) / 0.1)'}`,
            borderRadius: 8, opacity: locked ? 0.5 : 1,
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: locked ? '#555' : 'var(--ink-1)', marginBottom: 3 }}>
              {a.title ?? a.name ?? 'Achievement'}
            </div>
            {a.description && (
              <div style={{ fontSize: '0.7rem', color: 'var(--ink-4)' }}>{a.description}</div>
            )}
            {!locked && a.countersEarned != null && (
              <div style={{ fontSize: '0.65rem', color: 'var(--ink-5)', marginTop: 4 }}>
                {a.countersEarned.toLocaleString()} earned
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

function ModButton({ uuid, action, active }: { uuid: string; action: 'ban' | 'mute'; active: boolean }) {
  const [loading, setLoading] = useState(false)
  const [state, setState] = useState(active)

  const handle = async () => {
    if (!confirm(`${state ? 'Un' : ''}${action} this user?`)) return
    setLoading(true)
    try {
      const endpoint = action === 'ban' ? '/api/counter/modToggleBan' : '/api/counter/modToggleMute'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid }),
        credentials: 'include',
      })
      if (res.ok) setState(s => !s)
    } finally {
      setLoading(false)
    }
  }

  const label = state ? `Un${action}` : `${action.charAt(0).toUpperCase()}${action.slice(1)}`
  return (
    <button onClick={handle} disabled={loading} style={{
      padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)',
      background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', fontSize: '0.75rem',
      cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1, fontWeight: 600,
    }}>
      {loading ? '…' : label}
    </button>
  )
}

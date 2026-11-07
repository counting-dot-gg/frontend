'use client'

import { useEffect, useState } from 'react'
import { API } from '@/lib/apiBase'
import { buildCounterMap, medal, type CounterInfo } from '@/lib/counterUtils'
import { formatDurationCompact, formatDurationFull } from '@/lib/duration'
import { CounterCell, Empty, ErrorBox, Spinner, th, describeNetworkFailure } from './StatsUI'

type Row = { rank: number; counter: string; value: number }
type RankList = { metric: string; total: number; rows: Row[]; counters: CounterInfo[] }

const PAGE_SIZE = 50

type RangeTime = {
  time: Record<string, number>
  counters: Map<string, CounterInfo>
  loading: boolean
  hasCounts: boolean
}

export default function TimeLeaderboard({ threadName, range }: { threadName: string; range?: RangeTime }) {
  if (range) return <RangeTimeBoard range={range} />
  return <AllTimeBoard threadName={threadName} />
}

function RangeTimeBoard({ range }: { range: RangeTime }) {
  const [page, setPage] = useState(1)
  const [shownFor, setShownFor] = useState(range.time)
  if (shownFor !== range.time) {
    setShownFor(range.time)
    setPage(1)
  }

  if (range.loading && Object.keys(range.time).length === 0) return <Spinner />
  const sorted = Object.entries(range.time)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  if (sorted.length === 0) {
    return (
      <Empty>
        {range.hasCounts
          ? 'Time per day was not being recorded yet for these days. Pick a later range, or clear the dates for all-time.'
          : 'No time recorded in this range.'}
      </Empty>
    )
  }

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const rows: Row[] = sorted
    .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    .map(([counter, value], i) => ({ rank: (page - 1) * PAGE_SIZE + i + 1, counter, value }))

  return (
    <Board
      rows={rows}
      counters={range.counters}
      page={page}
      pages={pages}
      setPage={setPage}
    />
  )
}

function AllTimeBoard({ threadName }: { threadName: string }) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<RankList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => setPage(1), [threadName])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`${API}/api/thread/stats/threadRankList`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ thread: threadName, metric: 'time', offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (!cancelled) { setData(json); setError(null) }
      } catch (err) {
        if (!cancelled) setError(describeNetworkFailure(err, 'time leaderboard'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [threadName, page])

  if (loading && !data) return <Spinner />
  if (error && !data) return <ErrorBox message={error} />
  if (!data || data.total === 0) return <Empty>No time recorded for this thread yet.</Empty>

  return (
    <Board
      rows={data.rows}
      counters={buildCounterMap(data.counters)}
      page={page}
      pages={Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
      setPage={setPage}
    />
  )
}

function Board({ rows, counters, page, pages, setPage }: {
  rows: Row[]
  counters: Map<string, CounterInfo>
  page: number
  pages: number
  setPage: React.Dispatch<React.SetStateAction<number>>
}) {
  return (
    <div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
        <table style={{ width: '100%', minWidth: 280, borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 44 }} />
            <col />
            <col style={{ width: 110 }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: '1px solid rgb(var(--ink-rgb) / 0.08)' }}>
              <th style={th}>#</th>
              <th style={{ ...th, textAlign: 'left' }}>Counter</th>
              <th style={{ ...th, textAlign: 'right' }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const c = counters.get(r.counter)
              const m = medal(r.rank)
              return (
                <tr key={r.counter} style={{ borderBottom: '1px solid rgb(var(--ink-rgb) / 0.04)' }}>
                  <td style={{
                    padding: '5px 8px', textAlign: 'center', background: m?.bg ?? 'transparent',
                    color: m?.color ?? 'var(--ink-3)', fontWeight: m ? 700 : 400, fontSize: 12,
                  }}>{r.rank}</td>
                  <td style={{ padding: '5px 8px', overflow: 'hidden' }}>{c ? <CounterCell counter={c} /> : r.counter}</td>
                  <td
                    title={formatDurationFull(r.value)}
                    style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', color: 'var(--ink-2)' }}
                  >
                    {formatDurationCompact(r.value)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 12, fontSize: 13 }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={pageBtn(page <= 1)}>← Prev</button>
          <span style={{ color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>Page {page} of {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} style={pageBtn(page >= pages)}>Next →</button>
        </div>
      )}
    </div>
  )
}

function pageBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: disabled ? 'default' : 'pointer',
    border: '1px solid rgb(var(--ink-rgb) / 0.15)', background: 'transparent',
    color: disabled ? 'var(--ink-3)' : 'var(--ink-1)', opacity: disabled ? 0.5 : 1,
  }
}

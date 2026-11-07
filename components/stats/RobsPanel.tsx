'use client'

import { useCallback, useEffect, useState } from 'react'
import { API } from '@/lib/apiBase'
import { buildCounterMap, medal, type CounterInfo } from '@/lib/counterUtils'
import { CounterCell, Empty, ErrorBox, Spinner, th, describeNetworkFailure } from './StatsUI'

type LeaderRow = { counterUUID: string; robs: number; total: number; biggest: number; lastAt: number }
type HistoryRow = { id: number; counterUUID: string; moneyRobbed: number; timestamp: number; postUUID: string }
type RobStats = {
  leaderboard: LeaderRow[]
  entries: HistoryRow[]
  total: number
  page: number
  pageSize: number
  counters: CounterInfo[]
}

const PAGE_SIZE = 25
const REFRESH_MS = 30_000

const money = (n: number) => `$${n.toLocaleString()}`
const when = (ms: number) =>
  ms ? new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-'

const cell: React.CSSProperties = { padding: '5px 8px' }
const num: React.CSSProperties = {
  ...cell, textAlign: 'right', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', color: 'var(--ink-2)',
}

export default function RobsPanel({ startDate, endDate }: { startDate?: string; endDate?: string }) {
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [startDate, endDate])
  const [data, setData] = useState<RobStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (p: number, quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const res = await fetch(`${API}/api/thread/stats/robs`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: p,
          pageSize: PAGE_SIZE,
          ...(startDate ? { startDateStr: startDate } : {}),
          ...(endDate ? { endDateStr: endDate } : {}),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setError(null)
    } catch (err) {
      if (!quiet) setError(describeNetworkFailure(err, 'rob history'))
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    void load(page)
    const t = setInterval(() => void load(page, true), REFRESH_MS)
    return () => clearInterval(t)
  }, [page, load])

  if (loading && !data) return <Spinner />
  if (error && !data) return <ErrorBox message={error} onRetry={() => void load(page)} />
  if (!data || data.total === 0) {
    return <Empty>{startDate || endDate ? 'No robs in this range.' : 'Nobody has robbed the bank yet.'}</Empty>
  }

  const counters = buildCounterMap(data.counters)
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>Top robbers</h3>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
          <table style={{ width: '100%', minWidth: 460, borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 36 }} />
              <col />
              <col style={{ width: 60 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 150 }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid rgb(var(--ink-rgb) / 0.08)' }}>
                <th style={th}>#</th>
                <th style={{ ...th, textAlign: 'left' }}>Counter</th>
                <th style={{ ...th, textAlign: 'right' }}>Robs</th>
                <th style={{ ...th, textAlign: 'right' }}>Total</th>
                <th style={{ ...th, textAlign: 'right' }}>Biggest</th>
                <th style={{ ...th, textAlign: 'right' }}>Last</th>
              </tr>
            </thead>
            <tbody>
              {data.leaderboard.map((r, i) => {
                const c = counters.get(r.counterUUID)
                const m = medal(i + 1)
                return (
                  <tr key={r.counterUUID} style={{ borderBottom: '1px solid rgb(var(--ink-rgb) / 0.04)' }}>
                    <td style={{
                      ...cell, textAlign: 'center', background: m?.bg ?? 'transparent',
                      color: m?.color ?? 'var(--ink-3)', fontWeight: m ? 700 : 400, fontSize: 12,
                    }}>{i + 1}</td>
                    <td style={{ ...cell, overflow: 'hidden' }}>{c ? <CounterCell counter={c} /> : r.counterUUID}</td>
                    <td style={num}>{r.robs.toLocaleString()}</td>
                    <td style={num}>{money(r.total)}</td>
                    <td style={num}>{money(r.biggest)}</td>
                    <td style={{ ...num, fontFamily: 'inherit', fontSize: 12 }}>{when(r.lastAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 0 8px' }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>Every rob</h3>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {data.total.toLocaleString()} {startDate || endDate ? 'in this range' : 'in all'}
          </span>
        </div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
          <table style={{ width: '100%', minWidth: 420, borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 170 }} />
              <col />
              <col style={{ width: 100 }} />
              <col style={{ width: 70 }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: '1px solid rgb(var(--ink-rgb) / 0.08)' }}>
                <th style={{ ...th, textAlign: 'left' }}>When</th>
                <th style={{ ...th, textAlign: 'left' }}>Robber</th>
                <th style={{ ...th, textAlign: 'right' }}>Took</th>
                <th style={{ ...th, textAlign: 'right' }} />
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => {
                const c = counters.get(e.counterUUID)
                return (
                  <tr key={e.id} style={{ borderBottom: '1px solid rgb(var(--ink-rgb) / 0.04)' }}>
                    <td style={{ ...cell, fontSize: 12, color: 'var(--ink-2)' }}>{when(e.timestamp)}</td>
                    <td style={{ ...cell, overflow: 'hidden' }}>{c ? <CounterCell counter={c} /> : e.counterUUID}</td>
                    <td style={num}>{money(e.moneyRobbed)}</td>
                    <td style={{ ...cell, textAlign: 'right', fontSize: 12 }}>
                      <a href={`/thread/main?context=${encodeURIComponent(e.postUUID)}`} style={{ color: 'var(--ink-3)' }}>
                        context
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 12, fontSize: 13 }}>
          <PageBtn label="← Newer" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} />
          <span style={{ color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
            Page {page} of {pages}
          </span>
          <PageBtn label="Older →" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} />
        </div>
      </section>
    </div>
  )
}

function PageBtn({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: disabled ? 'default' : 'pointer',
        border: '1px solid rgb(var(--ink-rgb) / 0.15)', background: 'transparent',
        color: disabled ? 'var(--ink-3)' : 'var(--ink-1)', opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  )
}

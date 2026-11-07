'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { formatClockTime } from '@/lib/rankUtils'
import { avatarUrl } from '@/lib/counterUtils'

import { API } from '@/lib/apiBase'

export type ThresholdKind = 'split_under_ms' | 'get_under_ms' | 'daily_counts'

interface Counter {
  uuid: string
  username: string
  name: string
  color?: string
  discordId?: string
  avatar?: string
  roles?: string[]
}

type SpeedEntry = { uuid: string; value: number; attempts: number }
type DailyEntry = { uuid: string; bestDay: string; count: number; daysCount: number }

export default function ThresholdLeaderboard({ kind, threadName, onPickThreshold }: {
  kind: ThresholdKind
  threadName: string
  onPickThreshold?: (value: number) => void
}) {
  const isSpeed = kind === 'split_under_ms' || kind === 'get_under_ms'

  const [percentile, setPercentile] = useState(100)
  const [percentileInput, setPercentileInput] = useState('100')
  const [debouncedPercentile, setDebouncedPercentile] = useState(100)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPercentile(percentile), 400)
    return () => clearTimeout(t)
  }, [percentile])
  const backendPercentile = isSpeed ? 100 - debouncedPercentile : debouncedPercentile

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [minInput, setMinInput] = useState('')
  const [maxInput, setMaxInput] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [speedEntries, setSpeedEntries] = useState<SpeedEntry[]>([])
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([])
  const [counters, setCounters] = useState<Record<string, Counter>>({})

  useEffect(() => {
    if (!threadName) return
    let stale = false
    setLoading(true)
    setError(null)

    const url = isSpeed
      ? `${API}/api/thread/stats/threadStatsDetails`
      : `${API}/api/thread/stats/threadDailyCountLeaderboard`
    const body = isSpeed
      ? {
          thread: threadName,
          type: kind === 'split_under_ms' ? 'splitSpeed' : 'speed',
          offset: 0,
          limit: 1,
          customPercentile: backendPercentile,
          startDateStr: startDate || undefined,
          endDateStr: endDate || undefined,
        }
      : {
          thread: threadName,
          startDateStr: startDate || undefined,
          endDateStr: endDate || undefined,
          customPercentile: backendPercentile,
        }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(data => {
        if (stale) return
        const byUuid: Record<string, Counter> = {}
        for (const c of data.counters ?? []) byUuid[c.uuid] = c
        setCounters(byUuid)

        if (isSpeed) {
          const rows: SpeedEntry[] = (data.distributionStats ?? [])
            .filter((r: any) => typeof r.custom === 'number')
            .map((r: any) => ({ uuid: r.uuid, value: r.custom as number, attempts: r.attempts }))
            .sort((a: SpeedEntry, b: SpeedEntry) => a.value - b.value)
          setSpeedEntries(rows)
        } else {
          setDailyEntries(data.entries ?? [])
        }
      })
      .catch(() => {
        if (stale) return
        setError('Couldn’t load this leaderboard.')
        setSpeedEntries([])
        setDailyEntries([])
      })
      .finally(() => { if (!stale) setLoading(false) })

    return () => { stale = true }
  }, [threadName, kind, isSpeed, backendPercentile, startDate, endDate])

  const min = minInput !== '' && Number.isFinite(Number(minInput)) ? Number(minInput) : undefined
  const max = maxInput !== '' && Number.isFinite(Number(maxInput)) ? Number(maxInput) : undefined

  const visibleSpeed = useMemo(() => speedEntries.filter(e =>
    (min === undefined || e.attempts >= min) && (max === undefined || e.attempts <= max),
  ), [speedEntries, min, max])

  const visibleDaily = useMemo(() => dailyEntries.filter(e =>
    (min === undefined || e.daysCount >= min) && (max === undefined || e.daysCount <= max),
  ), [dailyEntries, min, max])

  const inputCls =
    'rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-primary transition-colors'
  const boundLabel = isSpeed ? 'attempts' : 'days'

  const counterCell = (uuid: string) => {
    const c = counters[uuid]
    if (!c) return <span className="font-mono text-xs text-muted-foreground">{uuid.slice(0, 8)}</span>
    if (c.roles?.includes('banned')) return <span className="text-muted-foreground">Banned user</span>
    return (
      <Link href={`/counter/${encodeURIComponent(c.username)}`} className="flex items-center gap-2 group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={c.discordId && c.avatar ? avatarUrl({ discordId: c.discordId, avatar: c.avatar }) : undefined}
          alt=""
          className="size-6 shrink-0 rounded-full bg-muted object-cover"
        />
        <span
          className="font-medium group-hover:underline underline-offset-4"
          style={{ color: c.color || undefined }}
        >
          {c.name || c.username}
        </span>
      </Link>
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="tl-pct" className="mb-1 block text-xs font-semibold">Percentile</label>
          <input
            id="tl-pct"
            type="number"
            min={0}
            max={100}
            step={1}
            value={percentileInput}
            onChange={e => {
              const raw = e.target.value
              setPercentileInput(raw)
              const parsed = Number(raw)
              if (raw !== '' && Number.isFinite(parsed)) {
                setPercentile(Math.min(100, Math.max(0, Math.round(parsed))))
              }
            }}
            onBlur={() => setPercentileInput(String(percentile))}
            className={inputCls + ' w-24'}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {percentile === 100 ? 'Best' : percentile === 0 ? 'Worst' : percentile === 50 ? 'Median' : ' '}
          </p>
        </div>

        <div>
          <label htmlFor="tl-min" className="mb-1 block text-xs font-semibold">Min {boundLabel}</label>
          <input id="tl-min" type="number" value={minInput} onChange={e => setMinInput(e.target.value)} className={inputCls + ' w-24'} />
        </div>
        <div>
          <label htmlFor="tl-max" className="mb-1 block text-xs font-semibold">Max {boundLabel}</label>
          <input id="tl-max" type="number" value={maxInput} onChange={e => setMaxInput(e.target.value)} className={inputCls + ' w-24'} />
        </div>

        <div>
          <label htmlFor="tl-from" className="mb-1 block text-xs font-semibold">From</label>
          <input id="tl-from" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="tl-to" className="mb-1 block text-xs font-semibold">To</label>
          <input id="tl-to" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
        </div>

        {(startDate || endDate || minInput || maxInput) && (
          <button
            onClick={() => { setStartDate(''); setEndDate(''); setMinInput(''); setMaxInput('') }}
            className="pb-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && !error && (
        isSpeed ? (
          visibleSpeed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No qualifying counters for these filters.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="w-10 px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Counter</th>
                    <th className="px-3 py-2 text-right font-semibold">Time</th>
                    <th className="px-3 py-2 text-right font-semibold">Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSpeed.map((e, i) => (
                    <tr
                      key={e.uuid}
                      onClick={onPickThreshold ? () => onPickThreshold(e.value) : undefined}
                      title={onPickThreshold ? 'Use this time as the threshold' : undefined}
                      className={'border-b border-border/60 last:border-b-0 hover:bg-muted/40 transition-colors'
                        + (onPickThreshold ? ' cursor-pointer' : '')}
                    >
                      <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-3 py-1.5">{counterCell(e.uuid)}</td>
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatClockTime(e.value)}</td>
                      <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">{e.attempts.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          visibleDaily.length === 0 ? (
            <p className="text-sm text-muted-foreground">No qualifying counters for these filters.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="w-10 px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Counter</th>
                    <th className="px-3 py-2 text-right font-semibold">Counts</th>
                    <th className="px-3 py-2 font-semibold">Best day</th>
                    <th className="px-3 py-2 text-right font-semibold">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDaily.map((e, i) => (
                    <tr
                      key={e.uuid}
                      onClick={onPickThreshold ? () => onPickThreshold(e.count) : undefined}
                      title={onPickThreshold ? 'Use this count as the target' : undefined}
                      className={'border-b border-border/60 last:border-b-0 hover:bg-muted/40 transition-colors'
                        + (onPickThreshold ? ' cursor-pointer' : '')}
                    >
                      <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-3 py-1.5">{counterCell(e.uuid)}</td>
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{e.count.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{e.bestDay}</td>
                      <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">{e.daysCount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )
      )}
    </div>
  )
}

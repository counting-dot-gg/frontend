'use client'

import { memo, useContext, useEffect, useMemo, useState } from 'react'
import { standardizeCountFormat } from '@/lib/postHelpers'
import { PrefsContext } from '@/components/thread/PrefsContext'
import { avatarUrl, displayName, type CounterInfo } from '@/lib/counterUtils'
import { CounterCell } from '@/components/stats/StatsUI'

import { API } from '@/lib/apiBase'

export interface SpeedRecord {
  uuid?: string
  start: string
  end: string
  startCount?: string
  endCount?: string
  startCountNumber?: number
  endCountNumber?: number
  time: number
  qualifiedCounters: string[]
  isFake?: boolean
  fakeMarkedBy?: string
}

interface DistributionStat {
  uuid: string
  attempts: number
  min: number
  q1: number
  median: number
  q3: number
  p99?: number
  max: number
  plotMax: number
  custom?: number
}

interface HallRow {
  counter: string
  obj: SpeedRecord
  rank: number
}

interface Props {
  speed: SpeedRecord[]
  threadName: string
  isSplitTable?: boolean
  canModerateSplits?: boolean
  canMarkOwnSplits?: boolean
  viewerUUID?: string
  onToggleSplitFake?: (split: { start: string; end: string; isFake: boolean }) => Promise<void>
  canLoadMore?: boolean
  isLoadingMore?: boolean
  onEnsurePageLoaded?: (page: number, selectedUserUUIDs: string[]) => void
  totalCount?: number
  onSelectedUsersChange?: (uuids: string[]) => void
  distributionStats?: DistributionStat[]
  hallOfSpeedRows?: HallRow[]
  percentile?: number
  counters: Map<string, CounterInfo>
  validationType?: string
  sortOrder?: 'fastest' | 'slowest' | 'newest' | 'oldest'
  onSortChange?: (order: 'fastest' | 'slowest' | 'newest' | 'oldest') => void
}

const ROWS_PER_PAGE = 50
const DIST_CUTOFF_MS = 6 * 60 * 1000

function normalizedTime(v: number) { return Number(v.toFixed(3)) }
function sameRank(a: number, b: number) { return normalizedTime(a) === normalizedTime(b) }

function formatClockTime(ms: number, decimals = 3): string {
  if (!Number.isFinite(ms)) return '∞'
  const totalSec = ms / 1000
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const secStr = decimals > 0 ? s.toFixed(decimals) : String(Math.floor(s))
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${secStr.padStart(decimals > 0 ? 6 + decimals : 2, '0')}`
  if (m > 0) return `${m}:${secStr.padStart(decimals > 0 ? 3 + decimals : 2, '0')}`
  return secStr
}

function boundaryLabel(raw: string | undefined, format: string, validationType?: string): string {
  if (raw == null || raw === '') return '—'
  return standardizeCountFormat(raw, format, validationType)
}

function getReplayHref(threadName: string, record: SpeedRecord): string {
  const s = Number(record.startCountNumber)
  const e = Number(record.endCountNumber)
  if (Number.isFinite(s) && Number.isFinite(e)) {
    return `/replay/${threadName}?startValidCountNumber=${s}&endValidCountNumber=${e}`
  }
  return `/replay/${threadName}?startRawCount=${encodeURIComponent(record.startCount ?? '')}&endRawCount=${encodeURIComponent(record.endCount ?? '')}`
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0
  const pos = (values.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  return values[base + 1] !== undefined ? values[base] + rest * (values[base + 1] - values[base]) : values[base]
}

function CounterFilter({
  counters,
  selectedUUIDs,
  onChange,
}: {
  counters: Map<string, CounterInfo>
  selectedUUIDs: string[]
  onChange: (uuids: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const all = useMemo(() =>
    Array.from(counters.values()).sort((a, b) => a.name.localeCompare(b.name)),
    [counters],
  )

  const filtered = query
    ? all.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.username.toLowerCase().includes(query.toLowerCase()))
    : all

  const selected = selectedUUIDs.map(id => counters.get(id)).filter(Boolean) as CounterInfo[]

  return (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 8px', minHeight: 36,
          border: '1px solid rgb(var(--ink-rgb) / 0.15)', borderRadius: 6,
          background: 'rgb(var(--ink-rgb) / 0.04)', cursor: 'text',
        }}
        onClick={() => setOpen(true)}
      >
        {selected.map(c => (
          <span key={c.uuid} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '1px 6px', borderRadius: 10, fontSize: 11,
            background: (c.color || '#888') + '33', color: c.color || '#ddd',
          }}>
            {c.name}
            <button
              onClick={e => { e.stopPropagation(); onChange(selectedUUIDs.filter(id => id !== c.uuid)) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, fontSize: 12 }}
            >×</button>
          </span>
        ))}
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? 'Filter by counter…' : ''}
          style={{ flex: 1, minWidth: 100, background: 'none', border: 'none', outline: 'none', color: 'var(--ink-1)', fontSize: 12 }}
        />
      </div>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => { setOpen(false); setQuery('') }} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 2,
            background: 'var(--surface-raised)', border: '1px solid rgb(var(--ink-rgb) / 0.15)', borderRadius: 6,
            maxHeight: 200, overflowY: 'auto',
          }}>
            {filtered.slice(0, 50).map(c => (
              <div
                key={c.uuid}
                onClick={() => {
                  onChange(selectedUUIDs.includes(c.uuid) ? selectedUUIDs.filter(id => id !== c.uuid) : [...selectedUUIDs, c.uuid])
                  setQuery('')
                }}
                style={{
                  padding: '6px 10px', fontSize: 12, cursor: 'pointer',
                  background: selectedUUIDs.includes(c.uuid) ? 'rgba(249,115,22,0.12)' : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
                onMouseEnter={e => { if (!selectedUUIDs.includes(c.uuid)) e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.05)' }}
                onMouseLeave={e => { e.currentTarget.style.background = selectedUUIDs.includes(c.uuid) ? 'rgba(249,115,22,0.12)' : 'transparent' }}
              >
                <CounterCell counter={c} />
              </div>
            ))}
            {filtered.length === 0 && <div style={{ padding: '8px 10px', fontSize: 12, color: '#555' }}>No matches</div>}
          </div>
        </>
      )}
    </div>
  )
}

function DistributionChart({ rows, counters, percentile }: { rows: DistributionStat[]; counters: Map<string, CounterInfo>; percentile?: number }) {
  if (rows.length === 0) return <div style={{ fontSize: 12, color: '#555' }}>Need at least 3 attempts per user.</div>

  const globalMin = Math.min(...rows.map(d => d.min))
  const slowestMedian = Math.max(...rows.map(d => d.median))
  const slowestP75 = Math.max(...rows.map(d => d.plotMax))
  const useExtended = globalMin > DIST_CUTOFF_MS
  const globalMax = useExtended ? slowestMedian * 2 : Math.min(DIST_CUTOFF_MS, slowestMedian * 2, slowestP75)
  const adjMin = useExtended ? globalMin : (globalMin >= globalMax ? Math.max(0, globalMax - 60000) : globalMin)
  const range = globalMax - adjMin || 1
  const pct = (v: number) => Math.max(2, Math.min(98, ((Math.min(v, globalMax) - adjMin) / range) * 100))
  const ticks = [0, 25, 50, 75, 100].map(p => ({ p, label: formatClockTime(adjMin + range * p / 100, 3) }))
  const ROW_H = 40

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, alignItems: 'start' }}>
        <div>
          {rows.map(d => {
            const c = counters.get(d.uuid)
            return (
              <div key={d.uuid} style={{ height: ROW_H, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: c?.color || '#ddd' }}>
                  {c ? displayName(c) : d.uuid.slice(0, 8)}
                </div>
                <div style={{ fontSize: 10, color: '#555', lineHeight: 1.2 }}>
                  med {formatClockTime(d.median, 3)} (n={d.attempts})
                  {typeof d.custom === 'number' && typeof percentile === 'number' && ` · p${percentile} ${formatClockTime(d.custom, 3)}`}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ position: 'relative', height: rows.length * ROW_H + 28, border: '1px solid rgb(var(--ink-rgb) / 0.08)', borderRadius: 6, overflow: 'hidden' }}>
          {ticks.map(t => (
            <div key={t.p} style={{ position: 'absolute', left: `${t.p}%`, top: 0, bottom: 22, width: 1, background: 'rgb(var(--ink-rgb) / 0.06)' }} />
          ))}
          {rows.map((d, idx) => {
            const c = counters.get(d.uuid)
            const color = c?.color || '#4f6d7a'
            const y = idx * ROW_H + 12
            const av = c ? avatarUrl(c) : undefined
            return (
              <div key={d.uuid}>
                <div style={{ position: 'absolute', left: `${pct(d.min)}%`, top: y + 1, width: `${Math.max(1, pct(d.plotMax) - pct(d.min))}%`, height: 2, background: color }} />
                <div title={`Min: ${formatClockTime(d.min)}`} style={{ position: 'absolute', left: `${pct(d.min)}%`, top: y - 6, width: 2, height: 14, background: color }} />
                <div title={`P75: ${formatClockTime(d.plotMax)}`} style={{ position: 'absolute', left: `${pct(d.plotMax)}%`, top: y - 6, width: 2, height: 14, background: color }} />
                <div style={{ position: 'absolute', left: `${pct(d.q1)}%`, top: y - 7, width: `${Math.max(1, pct(d.q3) - pct(d.q1))}%`, height: 16, border: `2px solid ${color}`, borderRadius: 2 }} />
                <div title={`Median: ${formatClockTime(d.median)}`} style={{ position: 'absolute', left: `${pct(d.median)}%`, top: y - 9, width: 3, height: 20, background: color }} />
                {typeof d.custom === 'number' && (
                  <div title={`P${percentile}: ${formatClockTime(d.custom)}`} style={{ position: 'absolute', left: `${pct(d.custom)}%`, top: y - 9, width: 3, height: 20, background: '#f97316' }} />
                )}
                {av && (
                  <img src={av} alt="" width={14} height={14} style={{ position: 'absolute', left: `calc(${pct(d.median)}% - 7px)`, top: y - 5, borderRadius: '50%', objectFit: 'cover' }} />
                )}
              </div>
            )
          })}
          {ticks.map(t => (
            <div key={`ax_${t.p}`} style={{ position: 'absolute', left: `${t.p}%`, bottom: 14 }}>
              <div style={{ width: 1, height: 4, background: 'rgb(var(--ink-rgb) / 0.3)' }} />
              <div style={{ transform: 'translateX(-50%)', fontSize: 9, color: '#555', whiteSpace: 'nowrap' }}>{t.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CountersCell({ uuids, counters }: { uuids: string[]; counters: Map<string, CounterInfo> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {uuids.map(uuid => {
        const c = counters.get(uuid)
        return c ? <CounterCell key={uuid} counter={c} /> : <span key={uuid} style={{ fontSize: 11, color: '#555' }}>{uuid.slice(0, 8)}</span>
      })}
    </div>
  )
}

export const SpeedTable = memo(function SpeedTable({
  speed,
  threadName,
  isSplitTable = false,
  canModerateSplits = false,
  canMarkOwnSplits = false,
  viewerUUID,
  onToggleSplitFake,
  canLoadMore = false,
  isLoadingMore = false,
  onEnsurePageLoaded,
  totalCount,
  onSelectedUsersChange,
  distributionStats,
  hallOfSpeedRows,
  percentile,
  counters,
  sortOrder = 'fastest',
  onSortChange,
  validationType,
}: Props) {
  const countFormat = useContext(PrefsContext)?.pref_standardize_format ?? 'Disabled'
  const [page, setPage] = useState(0)
  const [selectedFilterUUIDs, setSelectedFilterUUIDs] = useState<string[]>([])
  const [selectedDistUUIDs, setSelectedDistUUIDs] = useState<string[]>([])
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set())

  const prepared = useMemo(() => {
    if (!Array.isArray(speed)) return []
    return speed
      .filter(r => r && Object.keys(r).length > 0)
      .map(r => ({
        ...r,
        time: Number.isFinite(r.time) ? r.time : Infinity,
        qualifiedCounters: Array.isArray(r.qualifiedCounters) ? r.qualifiedCounters : [],
        isFake: Boolean(r.isFake),
      }))
  }, [speed])

  const ranked = useMemo(() => {
    const byTime = [...prepared].sort((a, b) => a.time - b.time)
    let prevTime: number | null = null
    let prevRank = 0
    const rankMap = new Map<string, number>()
    byTime.forEach((entry, i) => {
      const rank = prevTime !== null && sameRank(entry.time, prevTime) ? prevRank : i + 1
      prevTime = entry.time
      prevRank = rank
      rankMap.set(`${entry.start}_${entry.end}`, rank)
    })
    return rankMap
  }, [prepared])

  const displayRanked = useMemo(() =>
    prepared.map(entry => ({ ...entry, rank: ranked.get(`${entry.start}_${entry.end}`) ?? 0 })),
    [prepared, ranked])

  const pbLeaderboard = useMemo(() => {
    if (hallOfSpeedRows !== undefined) return hallOfSpeedRows
    const best: Record<string, SpeedRecord> = {}
    for (const r of prepared) {
      for (const uuid of r.qualifiedCounters) {
        if (!best[uuid] || r.time < best[uuid].time) best[uuid] = r
      }
    }
    const rows = Object.entries(best).map(([counter, obj]) => ({ counter, obj })).sort((a, b) => a.obj.time - b.obj.time)
    let prevTime: number | null = null
    let prevRank = 0
    return rows.map((row, i) => {
      const rank = prevTime !== null && sameRank(row.obj.time, prevTime) ? prevRank : i + 1
      prevTime = row.obj.time
      prevRank = rank
      return { ...row, rank }
    })
  }, [prepared, hallOfSpeedRows])

  const currentRows = useMemo(() => displayRanked.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE), [displayRanked, page])

  const distCandidates = useMemo(() => {
    if (distributionStats !== undefined) return distributionStats
    const timesByUser: Record<string, number[]> = {}
    for (const r of prepared) {
      if (!Number.isFinite(r.time)) continue
      for (const uuid of r.qualifiedCounters) {
        if (!timesByUser[uuid]) timesByUser[uuid] = []
        timesByUser[uuid].push(r.time)
      }
    }
    return Object.entries(timesByUser)
      .filter(([, times]) => times.length >= 3)
      .map(([uuid, times]) => {
        const s = [...times].sort((a, b) => a - b)
        return { uuid, attempts: s.length, min: s[0], q1: quantile(s, 0.25), median: quantile(s, 0.5), q3: quantile(s, 0.75), max: s[s.length - 1], plotMax: quantile(s, 0.75) }
      })
      .sort((a, b) => a.median - b.median)
  }, [prepared, distributionStats])

  useEffect(() => {
    setSelectedDistUUIDs(prev => {
      if (distCandidates.length === 0) return []
      const cset = new Set(distCandidates.map(d => d.uuid))
      const pruned = prev.filter(uuid => cset.has(uuid))
      if (pruned.length > 0) return pruned.length === prev.length ? prev : pruned
      return distCandidates.slice(0, 5).map(d => d.uuid)
    })
  }, [distCandidates])

  const shownDistRows = useMemo(() => {
    if (distCandidates.length === 0) return []
    const set = new Set(selectedDistUUIDs)
    const rows = distCandidates.filter(d => set.has(d.uuid))
    return rows.length > 0 ? rows : distCandidates.slice(0, 5)
  }, [selectedDistUUIDs, distCandidates])

  const handleFilterChange = (uuids: string[]) => {
    const next = [...uuids].sort()
    const prev = [...selectedFilterUUIDs].sort()
    if (next.length === prev.length && next.every((u, i) => u === prev[i])) return
    setSelectedFilterUUIDs(next)
    onSelectedUsersChange?.(next)
    setPage(0)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    onEnsurePageLoaded?.(newPage, selectedFilterUUIDs)
  }

  const canToggle = (rec: { isFake?: boolean; qualifiedCounters?: string[]; fakeMarkedBy?: string }) =>
    canModerateSplits ||
    (canMarkOwnSplits && !!viewerUUID && (rec.isFake
      ? rec.fakeMarkedBy === viewerUUID
      : (rec.qualifiedCounters ?? []).includes(viewerUUID)))

  const toggleFake = async (start: string, end: string, currentIsFake: boolean) => {
    if (!onToggleSplitFake) return
    const key = `${start}_${end}`
    if (pendingKeys.has(key)) return
    setPendingKeys(prev => new Set([...prev, key]))
    try { await onToggleSplitFake({ start, end, isFake: !currentIsFake }) }
    finally { setPendingKeys(prev => { const n = new Set(prev); n.delete(key); return n }) }
  }

  const totalRows = totalCount ?? displayRanked.length
  const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE)

  const tdStyle: React.CSSProperties = { padding: '5px 8px', fontSize: 12, borderBottom: '1px solid rgb(var(--ink-rgb) / 0.04)', verticalAlign: 'middle' }
  const thStyle: React.CSSProperties = { padding: '5px 8px', fontSize: 11, fontWeight: 600, color: '#666', textAlign: 'left', borderBottom: '1px solid rgb(var(--ink-rgb) / 0.08)', whiteSpace: 'nowrap' }

  return (
    <div>
      <div style={{ maxWidth: 480, marginBottom: 12 }}>
        <CounterFilter counters={counters} selectedUUIDs={selectedFilterUUIDs} onChange={handleFilterChange} />
      </div>

      {totalRows === 0 && (
        <div style={{ fontSize: 13, color: '#555', padding: '8px 0' }}>No records found for this selection.</div>
      )}

      {totalRows > 0 && (
        <>
          <div style={{ marginBottom: 16, padding: 12, background: 'rgb(var(--ink-rgb) / 0.02)', border: '1px solid rgb(var(--ink-rgb) / 0.07)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#aaa' }}>Distribution (P75 and better)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {distCandidates.slice(0, 20).map(d => {
                const c = counters.get(d.uuid)
                const sel = selectedDistUUIDs.includes(d.uuid)
                return (
                  <button
                    key={d.uuid}
                    onClick={() => setSelectedDistUUIDs(prev => sel ? prev.filter(id => id !== d.uuid) : [...prev, d.uuid])}
                    style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: 11, cursor: 'pointer',
                      border: `1px solid ${sel ? (c?.color || '#f97316') : 'rgb(var(--ink-rgb) / 0.12)'}`,
                      background: sel ? (c?.color || '#f97316') + '22' : 'transparent',
                      color: sel ? (c?.color || '#f97316') : '#666',
                    }}
                  >
                    {c ? displayName(c) : d.uuid.slice(0, 8)}
                  </button>
                )
              })}
            </div>
            <DistributionChart rows={shownDistRows} counters={counters} percentile={percentile} />
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: '#aaa', marginBottom: 6 }}>Hall of Speed</div>
          <div style={{ overflowX: 'auto', marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Rank</th>
                  <th style={thStyle}>Counter</th>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Replay</th>
                  <th style={thStyle}>Start</th>
                  <th style={thStyle}>End</th>
                  <th style={thStyle}>Partners</th>
                  {isSplitTable && <th style={thStyle}>Flag</th>}
                </tr>
              </thead>
              <tbody>
                {pbLeaderboard.map(row => {
                  const c = counters.get(row.counter)
                  const partners = row.obj.qualifiedCounters.filter(id => id !== row.counter)
                  const key = `${row.obj.start}_${row.obj.end}`
                  return (
                    <tr key={row.counter}>
                      <td style={tdStyle}>{row.rank}</td>
                      <td style={tdStyle}>{c ? <CounterCell counter={c} /> : row.counter.slice(0, 8)}</td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{formatClockTime(row.obj.time)}</td>
                      <td style={tdStyle}><a href={getReplayHref(threadName, row.obj)} style={{ color: '#f97316', fontSize: 12 }}>Replay</a></td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>
                        <a href={`/thread/${threadName}/${row.obj.start}`} style={{ color: '#aaa' }}>
                          {boundaryLabel(row.obj.startCount, countFormat, validationType)}
                        </a>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>
                        <a href={`/thread/${threadName}/${row.obj.end}`} style={{ color: '#aaa' }}>
                          {boundaryLabel(row.obj.endCount, countFormat, validationType)}
                        </a>
                      </td>
                      <td style={tdStyle}><CountersCell uuids={partners} counters={counters} /></td>
                      {isSplitTable && (
                        <td style={tdStyle}>
                          <span style={{ color: row.obj.isFake ? 'var(--danger)' : 'var(--success-ink)', fontSize: 11 }}>{row.obj.isFake ? 'Fake' : 'Real'}</span>
                          {canToggle(row.obj) && onToggleSplitFake && (
                            <button
                              disabled={pendingKeys.has(key)}
                              onClick={() => toggleFake(row.obj.start, row.obj.end, Boolean(row.obj.isFake))}
                              style={{ marginLeft: 6, padding: '1px 6px', fontSize: 10, borderRadius: 4, border: '1px solid rgb(var(--ink-rgb) / 0.15)', background: 'transparent', color: '#888', cursor: 'pointer' }}
                            >
                              {pendingKeys.has(key) ? '…' : row.obj.isFake ? 'Mark real' : 'Mark fake'}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#aaa' }}>
              Leaderboard: {totalRows.toLocaleString()} {isSplitTable ? 'splits' : 'threads'}
            </span>
            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
              {(['fastest', 'slowest', 'newest', 'oldest'] as const).map(s => (
                <button key={s} onClick={() => { onSortChange?.(s); setPage(0) }} style={{
                  padding: '2px 8px', borderRadius: 10, fontSize: 11, cursor: 'pointer',
                  border: `1px solid ${sortOrder === s ? '#f97316' : 'rgb(var(--ink-rgb) / 0.12)'}`,
                  background: sortOrder === s ? 'rgba(249,115,22,0.15)' : 'transparent',
                  color: sortOrder === s ? '#f97316' : '#666',
                }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div style={{ overflowX: 'auto', marginBottom: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Rank</th>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Replay</th>
                  <th style={thStyle}>Start</th>
                  <th style={thStyle}>End</th>
                  <th style={thStyle}>Counters</th>
                  {isSplitTable && <th style={thStyle}>Flag</th>}
                </tr>
              </thead>
              <tbody>
                {currentRows.map((row, idx) => {
                  const key = `${row.start}_${row.end}`
                  return (
                    <tr key={row.uuid ?? `${key}_${idx}`}>
                      <td style={tdStyle}>{row.rank}</td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{formatClockTime(row.time)}</td>
                      <td style={tdStyle}><a href={getReplayHref(threadName, row)} style={{ color: '#f97316', fontSize: 12 }}>Replay</a></td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>
                        <a href={`/thread/${threadName}/${row.start}`} style={{ color: '#aaa' }}>
                          {boundaryLabel(row.startCount, countFormat, validationType)}
                        </a>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>
                        <a href={`/thread/${threadName}/${row.end}`} style={{ color: '#aaa' }}>
                          {boundaryLabel(row.endCount, countFormat, validationType)}
                        </a>
                      </td>
                      <td style={tdStyle}><CountersCell uuids={row.qualifiedCounters} counters={counters} /></td>
                      {isSplitTable && (
                        <td style={tdStyle}>
                          <span style={{ color: row.isFake ? 'var(--danger)' : 'var(--success-ink)', fontSize: 11 }}>{row.isFake ? 'Fake' : 'Real'}</span>
                          {canToggle(row) && onToggleSplitFake && (
                            <button
                              disabled={pendingKeys.has(key)}
                              onClick={() => toggleFake(row.start, row.end, Boolean(row.isFake))}
                              style={{ marginLeft: 6, padding: '1px 6px', fontSize: 10, borderRadius: 4, border: '1px solid rgb(var(--ink-rgb) / 0.15)', background: 'transparent', color: '#888', cursor: 'pointer' }}
                            >
                              {pendingKeys.has(key) ? '…' : row.isFake ? 'Mark real' : 'Mark fake'}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666' }}>
              <button
                disabled={page === 0}
                onClick={() => handlePageChange(page - 1)}
                style={{ padding: '3px 10px', borderRadius: 4, border: '1px solid rgb(var(--ink-rgb) / 0.12)', background: 'transparent', color: page === 0 ? '#444' : '#aaa', cursor: page === 0 ? 'default' : 'pointer', fontSize: 12 }}
              >‹ Prev</button>
              <span>{page + 1} / {totalPages}</span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => handlePageChange(page + 1)}
                style={{ padding: '3px 10px', borderRadius: 4, border: '1px solid rgb(var(--ink-rgb) / 0.12)', background: 'transparent', color: page >= totalPages - 1 ? '#444' : '#aaa', cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontSize: 12 }}
              >Next ›</button>
              {isLoadingMore && <span style={{ color: '#555' }}>Loading…</span>}
            </div>
          )}
        </>
      )}
    </div>
  )
})

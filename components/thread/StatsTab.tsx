'use client'

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import type { CounterInfo } from '@/lib/counterUtils'
import { avatarUrl, medal, displayName } from '@/lib/counterUtils'
import { DateInput, LeaderboardTable, Spinner } from '@/components/stats/StatsUI'
import { SpeedTable, type SpeedRecord } from '@/components/stats/SpeedTable'
import type { LastCountInfo } from './ThreadView'
import { useThreadStats } from '@/lib/threadStatsStore'
import { PrefsContext } from './PrefsContext'
import { standardizeCountFormat } from '@/lib/postHelpers'

import { API } from '@/lib/apiBase'

interface Stats {
  leaderboard?: Record<string, number>
  gets?: Record<string, number>
  assists?: Record<string, number>
  palindromes?: Record<string, number>
  repdigits?: Record<string, number>
  speedCount?: number
  splitSpeedCount?: number
}

interface DailyEntry {
  counter?: CounterInfo
  counts: number
}

interface DistributionStat {
  uuid: string
  attempts: number
  min: number
  q1: number
  median: number
  q3: number
  max: number
  plotMax: number
  custom?: number
}

interface HallRow { counter: string; obj: SpeedRecord; rank: number }

interface SpeedData {
  records: SpeedRecord[]
  hasMore: boolean
  total: number
  distributionStats: DistributionStat[]
  distributionStatsRealOnly: DistributionStat[]
  distributionStatsFakeOnly: DistributionStat[]
  hallOfSpeed: HallRow[]
  hallOfSpeedRealOnly: HallRow[]
  hallOfSpeedFakeOnly: HallRow[]
}

const EMPTY_SPEED_DATA: SpeedData = {
  records: [], hasMore: false, total: 0,
  distributionStats: [], distributionStatsRealOnly: [], distributionStatsFakeOnly: [],
  hallOfSpeed: [], hallOfSpeedRealOnly: [], hallOfSpeedFakeOnly: [],
}

const ACCOLADE_KEYS = ['gets', 'assists', 'palindromes', 'repdigits'] as const
type AccoladeKey = typeof ACCOLADE_KEYS[number]
const ACCOLADE_LABELS: Record<AccoladeKey, string> = { gets: 'Gets', assists: 'Assists', palindromes: 'Palindromes', repdigits: 'Repdigits' }
type SubTab = 'leaderboard' | 'accolades' | 'daily' | 'speed' | 'splits'
type ViewMode = 'all' | 'real_only' | 'fake_only'

function LastCount({ info, validationType }: { info?: LastCountInfo | null; validationType?: string }) {
  const prefs = useContext(PrefsContext)
  const raw = info?.lastCount?.rawCount ?? info?.lastCount?.countContent ?? info?.lastCount?.rawText
  if (!raw) return null
  const text = standardizeCountFormat(raw, prefs?.pref_standardize_format ?? 'Disabled', validationType)
  const counter = info?.lastCounter
  const ts = Number(info?.lastCount?.timestamp)

  return (
    <div style={{
      marginBottom: 16, paddingBottom: 12,
      borderBottom: '1px solid var(--thread-line)',
    }}>
      <div style={{
        fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
        color: 'var(--thread-muted)', marginBottom: 4,
      }}>
        Last count
      </div>
      <div style={{
        fontSize: 22, fontWeight: 800, color: 'var(--thread-ink)',
        fontVariantNumeric: 'tabular-nums', wordBreak: 'break-all', lineHeight: 1.15,
      }}>
        {text}
      </div>
      {counter && (
        <div style={{ fontSize: 12, color: 'var(--thread-muted)', marginTop: 3 }}>
          by{' '}
          <a
            href={`/counter/${counter.username}`}
            style={{ color: counter.color || 'var(--thread-muted)', textDecoration: 'none' }}
          >
            {displayName(counter as CounterInfo)}
          </a>
          {Number.isFinite(ts) && ts > 0 && (
            <span> · {new Date(ts).toLocaleTimeString()}</span>
          )}
        </div>
      )}
    </div>
  )
}

function DailyHOC({ entries }: { entries: DailyEntry[] }) {
  const sorted = entries
    .filter((e): e is DailyEntry & { counter: CounterInfo } => !!e.counter)
    .sort((a, b) => b.counts - a.counts)
  const total = entries.reduce((s, e) => s + e.counts, 0)
  if (sorted.length === 0) return null

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{
          fontSize: 11, fontWeight: 800, color: 'var(--thread-muted)',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          Today&apos;s Leaderboard
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 2 }}>
          <span style={{
            fontSize: 34, fontWeight: 900, lineHeight: 1.05, color: 'var(--thread-accent)',
            fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em',
          }}>
            {total.toLocaleString()}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--thread-muted)',
            letterSpacing: '0.07em', textTransform: 'uppercase',
          }}>
            counts today
          </span>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <tbody>
          {sorted.map((row, i) => {
            const m = medal(i + 1)
            const av = avatarUrl(row.counter)
            const name = displayName(row.counter)
            return (
              <tr key={row.counter.uuid} style={{ borderBottom: '1px solid var(--thread-line)' }}>
                <td style={{
                  padding: '4px 6px', textAlign: 'center', width: 28,
                  background: m?.bg ?? 'transparent', color: m?.color ?? 'var(--thread-muted)', fontWeight: m ? 700 : 400, fontSize: 11,
                }}>{i + 1}</td>
                <td style={{ padding: '4px 6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                      {av
                        ? <img src={av} alt="" width={20} height={20} style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                        : <div style={{ width: 20, height: 20, borderRadius: '50%', background: row.counter.color ? row.counter.color + '33' : 'var(--thread-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: row.counter.color || 'var(--thread-muted)' }}>
                            {row.counter.username.slice(0, 2).toUpperCase()}
                          </div>
                      }
                    </div>
                    <a
                      href={`/counter/${row.counter.username}`}
                      style={{ color: row.counter.color || 'var(--thread-ink)', textDecoration: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                      onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                    >
                      {name}
                    </a>
                  </div>
                </td>
                <td style={{
                  padding: '4px 6px', textAlign: 'right',
                  fontSize: 14, fontWeight: 900, color: 'var(--thread-ink)',
                  fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
                }}>
                  {row.counts.toLocaleString()}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ViewModeSelect({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const opts: { value: ViewMode; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'real_only', label: 'Real only' },
    { value: 'fake_only', label: 'Fake only' },
  ]
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
      {opts.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            padding: '3px 10px', borderRadius: 10, fontSize: 11, cursor: 'pointer',
            border: `1px solid ${value === o.value ? 'var(--thread-accent)' : 'var(--thread-line)'}`,
            background: value === o.value ? 'var(--thread-accent-soft)' : 'transparent',
            color: value === o.value ? 'var(--thread-accent)' : 'var(--thread-muted)',
          }}
        >{o.label}</button>
      ))}
    </div>
  )
}

interface StatsTabProps {
  threadName: string
  socket: Socket | null
  userRoles?: string[]
  viewerUUID?: string
  validationType?: string
}

export default function StatsTab({ threadName, socket, userRoles = [], viewerUUID, validationType }: StatsTabProps) {
  const { lastCount, dailyHOC: liveDailyHOC } = useThreadStats()
  const dailyHOC = liveDailyHOC as unknown as DailyEntry[]
  const [stats, setStats] = useState<Stats | null>(null)
  const [counters, setCounters] = useState<Map<string, CounterInfo>>(new Map())
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [subTab, setSubTab] = useState<SubTab>('daily')
  const [accoladeKey, setAccoladeKey] = useState<AccoladeKey>('gets')

  const [speedData, setSpeedData] = useState<SpeedData>(EMPTY_SPEED_DATA)
  const [speedLoading, setSpeedLoading] = useState(false)
  const [speedLoaded, setSpeedLoaded] = useState(false)
  const [speedViewMode, setSpeedViewMode] = useState<ViewMode>('all')
  const [speedSelectedUUIDs, setSpeedSelectedUUIDs] = useState<string[]>([])

  const [splitData, setSplitData] = useState<SpeedData>(EMPTY_SPEED_DATA)
  const [splitLoading, setSplitLoading] = useState(false)
  const [splitLoaded, setSplitLoaded] = useState(false)
  const [splitViewMode, setSplitViewMode] = useState<ViewMode>('real_only')
  const [splitSelectedUUIDs, setSplitSelectedUUIDs] = useState<string[]>([])

  const fetchSeq = useRef(0)
  const speedSeq = useRef(0)
  const splitSeq = useRef(0)

  const canModerateSplits = userRoles.includes('speed_verifier') ||
    userRoles.includes('mod') || userRoles.includes('admin')
  const canMarkOwnSplits = !!viewerUUID && userRoles.includes('counter') &&
    !userRoles.includes('banned') && !userRoles.includes('muted')

  const hasSpeedStats = (stats?.speedCount ?? 0) > 0
  const hasSplitStats = (stats?.splitSpeedCount ?? 0) > 0

  const fetchStats = useCallback(async (start: string, end: string) => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const body: any = { thread: threadName, includeDetails: false }
      if (start) body.startDateStr = start
      if (end) body.endDateStr = end
      const res = await fetch(`${API}/api/thread/stats/threadStats`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok || seq !== fetchSeq.current) return
      const data = await res.json()
      const cMap = new Map<string, CounterInfo>()
      for (const c of data.counters ?? []) cMap.set(c.uuid, c)
      setCounters(cMap)
      setStats(data.stats?.all ?? null)
    } catch {
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [threadName])

  useEffect(() => {
    fetchStats(startDate, endDate)
    setSpeedData(EMPTY_SPEED_DATA); setSpeedLoaded(false)
    setSplitData(EMPTY_SPEED_DATA); setSplitLoaded(false)
    setSpeedSelectedUUIDs([]); setSplitSelectedUUIDs([])
  }, [fetchStats, startDate, endDate])

  const fetchSpeedDetails = useCallback(async (type: 'speed' | 'splitSpeed', offset: number, limit: number, selectedUUIDs: string[]) => {
    const isSpeed = type === 'speed'
    const seq = isSpeed ? ++speedSeq.current : ++splitSeq.current
    if (isSpeed) setSpeedLoading(true); else setSplitLoading(true)
    try {
      const body: any = { thread: threadName, type, offset, limit, selectedUserUUIDs: selectedUUIDs }
      if (startDate) body.startDateStr = startDate
      if (endDate) body.endDateStr = endDate
      const res = await fetch(`${API}/api/thread/stats/threadStatsDetails`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) return
      if (isSpeed && seq !== speedSeq.current) return
      if (!isSpeed && seq !== splitSeq.current) return
      const data = await res.json()
      const cMap = new Map(counters)
      for (const c of data.counters ?? []) cMap.set(c.uuid, c)
      setCounters(cMap)
      const result: SpeedData = {
        records: data.records ?? [],
        hasMore: data.hasMore ?? false,
        total: data.total ?? 0,
        distributionStats: data.distributionStats ?? [],
        distributionStatsRealOnly: data.distributionStatsRealOnly ?? [],
        distributionStatsFakeOnly: data.distributionStatsFakeOnly ?? [],
        hallOfSpeed: data.hallOfSpeed ?? [],
        hallOfSpeedRealOnly: data.hallOfSpeedRealOnly ?? [],
        hallOfSpeedFakeOnly: data.hallOfSpeedFakeOnly ?? [],
      }
      if (isSpeed) { setSpeedData(result); setSpeedLoaded(true) }
      else { setSplitData(result); setSplitLoaded(true) }
    } catch {
    } finally {
      if (isSpeed) setSpeedLoading(false); else setSplitLoading(false)
    }
  }, [threadName, startDate, endDate, counters])

  useEffect(() => {
    if (subTab === 'speed' && hasSpeedStats && !speedLoaded && !speedLoading) {
      fetchSpeedDetails('speed', 0, 50, speedSelectedUUIDs)
    }
    if (subTab === 'splits' && hasSplitStats && !splitLoaded && !splitLoading) {
      fetchSpeedDetails('splitSpeed', 0, 50, splitSelectedUUIDs)
    }
  }, [subTab, hasSpeedStats, hasSplitStats, speedLoaded, splitLoaded])

  const handleSpeedUserChange = (uuids: string[]) => {
    setSpeedSelectedUUIDs(uuids)
    setSpeedData(EMPTY_SPEED_DATA); setSpeedLoaded(false)
  }
  const handleSplitUserChange = (uuids: string[]) => {
    setSplitSelectedUUIDs(uuids)
    setSplitData(EMPTY_SPEED_DATA); setSplitLoaded(false)
  }

  const handleEnsureSpeedPage = (page: number, uuids: string[]) => {
    const offset = page * 50
    if (offset < speedData.records.length) return
    fetchSpeedDetails('speed', offset, 50, uuids)
  }
  const handleEnsureSplitPage = (page: number, uuids: string[]) => {
    const offset = page * 50
    if (offset < splitData.records.length) return
    fetchSpeedDetails('splitSpeed', offset, 50, uuids)
  }

  const handleSplitFakeToggle = async ({ start, end, isFake }: { start: string; end: string; isFake: boolean }) => {
    await fetch(`${API}/api/thread/stats/markSplitFake`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ thread: threadName, start, end, isFake }),
    })
    setSplitData(prev => ({
      ...prev,
      records: prev.records.map(r => r.start === start && r.end === end ? { ...r, isFake } : r),
    }))
  }

  const availableAccolades = ACCOLADE_KEYS.filter(k => stats?.[k] && Object.keys(stats[k]!).length > 0)

  useEffect(() => {
    if (availableAccolades.length > 0 && !availableAccolades.includes(accoladeKey)) {
      setAccoladeKey(availableAccolades[0])
    }
  }, [availableAccolades.join(',')])

  const speedRecordsFiltered = useMemo(() => {
    if (speedViewMode === 'all') return speedData.records
    if (speedViewMode === 'fake_only') return speedData.records.filter(r => r.isFake)
    return speedData.records.filter(r => !r.isFake)
  }, [speedData.records, speedViewMode])

  const splitRecordsFiltered = useMemo(() => {
    if (splitViewMode === 'all') return splitData.records
    if (splitViewMode === 'fake_only') return splitData.records.filter(r => r.isFake)
    return splitData.records.filter(r => !r.isFake)
  }, [splitData.records, splitViewMode])

  const speedDist = speedViewMode === 'all' ? speedData.distributionStats : speedViewMode === 'fake_only' ? speedData.distributionStatsFakeOnly : speedData.distributionStatsRealOnly
  const speedHall = speedViewMode === 'all' ? speedData.hallOfSpeed : speedViewMode === 'fake_only' ? speedData.hallOfSpeedFakeOnly : speedData.hallOfSpeedRealOnly
  const splitDist = splitViewMode === 'all' ? splitData.distributionStats : splitViewMode === 'fake_only' ? splitData.distributionStatsFakeOnly : splitData.distributionStatsRealOnly
  const splitHall = splitViewMode === 'all' ? splitData.hallOfSpeed : splitViewMode === 'fake_only' ? splitData.hallOfSpeedFakeOnly : splitData.hallOfSpeedRealOnly

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'daily', label: 'Daily' },
    { key: 'leaderboard', label: 'Leaderboard' },
    ...(availableAccolades.length > 0 ? [{ key: 'accolades' as SubTab, label: 'Accolades' }] : []),
    ...(hasSpeedStats ? [{ key: 'speed' as SubTab, label: 'Speed' }] : []),
    ...(hasSplitStats ? [{ key: 'splits' as SubTab, label: 'Splits' }] : []),
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>

      <LastCount info={lastCount} validationType={validationType} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <DateInput label="Start date" value={startDate} onChange={setStartDate} />
        <DateInput label="End date" value={endDate} onChange={setEndDate} />
        {(startDate || endDate) && (
          <button
            onClick={() => { setStartDate(''); setEndDate('') }}
            style={{ alignSelf: 'flex-end', padding: '5px 10px', fontSize: 11, borderRadius: 6, border: '1px solid var(--thread-line)', background: 'transparent', color: 'var(--thread-muted)', cursor: 'pointer' }}
          >
            Clear
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--thread-line)', marginBottom: 12, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            style={{
              padding: '5px 12px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: subTab === t.key ? 700 : 400,
              color: subTab === t.key ? 'var(--thread-accent)' : 'var(--ink-3)',
              borderBottom: subTab === t.key ? '2px solid #f97316' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'leaderboard' && (
        loading ? <Spinner /> : stats?.leaderboard
          ? <LeaderboardTable lb={stats.leaderboard} counters={counters} label="Counts" />
          : <div style={{ fontSize: 12, color: 'var(--thread-muted)' }}>No leaderboard data.</div>
      )}

      {subTab === 'accolades' && (
        loading ? <Spinner /> : availableAccolades.length === 0
          ? <div style={{ fontSize: 12, color: 'var(--thread-muted)' }}>No accolade data for this range.</div>
          : <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {availableAccolades.map(k => (
                  <button
                    key={k}
                    onClick={() => setAccoladeKey(k)}
                    style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: 11,
                      border: `1px solid ${accoladeKey === k ? 'var(--thread-accent)' : 'var(--thread-line)'}`,
                      background: accoladeKey === k ? 'var(--thread-accent-soft)' : 'transparent',
                      color: accoladeKey === k ? 'var(--thread-accent)' : 'var(--thread-muted)', cursor: 'pointer',
                    }}
                  >
                    {ACCOLADE_LABELS[k]}
                  </button>
                ))}
              </div>
              {stats?.[accoladeKey]
                ? <LeaderboardTable lb={stats[accoladeKey]!} counters={counters} label={ACCOLADE_LABELS[accoladeKey]} />
                : <div style={{ fontSize: 12, color: 'var(--thread-muted)' }}>No data.</div>
              }
            </>
      )}

      {subTab === 'daily' && (
        dailyHOC.length === 0
          ? <div style={{ fontSize: 12, color: 'var(--thread-muted)' }}>No daily data yet</div>
          : <DailyHOC entries={dailyHOC} />
      )}

      {subTab === 'speed' && (
        speedLoading && !speedLoaded ? <Spinner /> : <>
          <ViewModeSelect value={speedViewMode} onChange={setSpeedViewMode} />
          <SpeedTable
            speed={speedRecordsFiltered}
            threadName={threadName}
            validationType={validationType}
            counters={counters}
            canLoadMore={speedData.hasMore}
            isLoadingMore={speedLoading}
            onEnsurePageLoaded={handleEnsureSpeedPage}
            onSelectedUsersChange={handleSpeedUserChange}
            totalCount={speedData.total}
            distributionStats={speedDist}
            hallOfSpeedRows={speedHall}
          />
        </>
      )}

      {subTab === 'splits' && (
        splitLoading && !splitLoaded ? <Spinner /> : <>
          <ViewModeSelect value={splitViewMode} onChange={setSplitViewMode} />
          <SpeedTable
            speed={splitRecordsFiltered}
            threadName={threadName}
            validationType={validationType}
            isSplitTable
            canModerateSplits={canModerateSplits}
            canMarkOwnSplits={canMarkOwnSplits}
            viewerUUID={viewerUUID}
            onToggleSplitFake={canModerateSplits || canMarkOwnSplits ? handleSplitFakeToggle : undefined}
            counters={counters}
            canLoadMore={splitData.hasMore}
            isLoadingMore={splitLoading}
            onEnsurePageLoaded={handleEnsureSplitPage}
            onSelectedUsersChange={handleSplitUserChange}
            totalCount={splitData.total}
            distributionStats={splitDist}
            hallOfSpeedRows={splitHall}
          />
        </>
      )}
    </div>
  )
}

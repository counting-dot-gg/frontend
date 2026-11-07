'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { CounterInfo } from '@/lib/counterUtils'
import { avatarUrl, displayName, medal } from '@/lib/counterUtils'
import { AccuracyTable, CounterCell, DateInput, Empty, ErrorBox, LeaderboardTable, NumInput, Spinner, describeHttpFailure, describeNetworkFailure, th, type AccuracyRow } from '@/components/stats/StatsUI'
import { SpeedTable, type SpeedRecord } from '@/components/stats/SpeedTable'
import dynamic from 'next/dynamic'
import type { GraphPoint, GraphMode } from './GraphsPanel'

const GraphsPanel = dynamic(() => import('./GraphsPanel'), { ssr: false })

import { API } from '@/lib/apiBase'
import RobsPanel from '@/components/stats/RobsPanel'
import TimeLeaderboard from '@/components/stats/TimeLeaderboard'

interface ThreadItem {
  uuid: string
  name: string
  title: string
  allowDoublePosts: boolean
  resetOnMistakes: boolean
  validationType?: string
}

interface Stats {
  leaderboard?: Record<string, number>
  gets?: Record<string, number>
  assists?: Record<string, number>
  palindromes?: Record<string, number>
  repdigits?: Record<string, number>
  accuracy?: AccuracyRow[]
  time?: Record<string, number>
  speedCount?: number
  splitSpeedCount?: number
  last_updated_uuid?: string
}

const NO_TIME: Record<string, number> = {}

interface DailyEntry {
  uuid: string
  bestDay: string
  count: number
  daysCount: number
}

const ACCOLADE_KEYS = ['gets', 'assists', 'palindromes', 'repdigits'] as const
type AccoladeKey = typeof ACCOLADE_KEYS[number]
const ACCOLADE_LABELS: Record<AccoladeKey, string> = { gets: 'Gets', assists: 'Assists', palindromes: 'Palindromes', repdigits: 'Repdigits' }
type SubTab = 'leaderboard' | 'graphs' | 'accolades' | 'daily_counts' | 'speed' | 'accuracy' | 'time' | 'robs'
type SpeedSubTab = 'gets' | 'splits'

interface SpeedEntry {
  counter: string
  obj: SpeedRecord
  rank: number
}

interface SpeedDataState {
  records: SpeedRecord[]
  hallOfSpeed: SpeedEntry[]
  distributionStats: any[]
  hallOfSpeedRealOnly: SpeedEntry[]
  distributionStatsRealOnly: any[]
  hasMore: boolean
  total: number
  loadedPages: Set<number>
  isLoadingMore: boolean
}

function makeEmptySpeedData(): SpeedDataState {
  return {
    records: [], hallOfSpeed: [], distributionStats: [],
    hallOfSpeedRealOnly: [], distributionStatsRealOnly: [],
    hasMore: false, total: 0, loadedPages: new Set(), isLoadingMore: false,
  }
}


const STACK_TOP_N = 10

const CATEGORY_ORDER = ['Double Counting', 'Traditional', 'No Mistakes']

function threadCategory(t: ThreadItem): string {
  if (t.allowDoublePosts && !t.resetOnMistakes) return 'Double Counting'
  if (t.resetOnMistakes) return 'No Mistakes'
  return 'Traditional'
}

function DailyCountsTable({ entries, counters }: { entries: DailyEntry[]; counters: Map<string, CounterInfo> }) {
  const [minDays, setMinDays] = useState('')
  const [maxDays, setMaxDays] = useState('')
  const minD = minDays !== '' && Number.isFinite(+minDays) ? +minDays : undefined
  const maxD = maxDays !== '' && Number.isFinite(+maxDays) ? +maxDays : undefined
  const filtered = entries.filter(e =>
    (minD === undefined || e.daysCount >= minD) && (maxD === undefined || e.daysCount <= maxD)
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <NumInput label="Min Days" value={minDays} onChange={setMinDays} />
        <NumInput label="Max Days" value={maxDays} onChange={setMaxDays} />
      </div>
      {filtered.length === 0
        ? <Empty>No data for this range.</Empty>
        : <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
          <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgb(var(--ink-rgb) / 0.08)' }}>
                <th style={th}>#</th>
                <th style={{ ...th, textAlign: 'left' }}>Counter</th>
                <th style={{ ...th, textAlign: 'right' }}>Counts</th>
                <th style={{ ...th, textAlign: 'right' }}>Days</th>
                <th style={{ ...th, textAlign: 'right' }}>Best Day</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => {
                const counter = counters.get(e.uuid)
                const m = medal(i + 1)
                return (
                  <tr key={e.uuid} style={{ borderBottom: '1px solid rgb(var(--ink-rgb) / 0.04)' }}>
                    <td style={{
                      padding: '5px 8px', textAlign: 'center', width: 36,
                      background: m?.bg ?? 'transparent', color: m?.color ?? '#666',
                      fontWeight: m ? 700 : 400, fontSize: 12,
                    }}>{i + 1}</td>
                    <td style={{ padding: '5px 8px' }}>
                      {counter
                        ? <CounterCell counter={counter} />
                        : <span style={{ color: '#555', fontSize: 12 }}>{e.uuid.slice(0, 8)}</span>
                      }
                    </td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#aaa' }}>{e.count.toLocaleString()}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', color: '#666', fontSize: 12 }}>{e.daysCount.toLocaleString()}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', color: '#666', fontSize: 12 }}>{e.bestDay}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
      }
    </div>
  )
}

const ALL_THREADS: { uuid: string; title: string; cat: string } = {
  uuid: 'all', title: 'All Threads', cat: '',
}

function ThreadSelect({ threads, selectedUUID, onChange }: { threads: ThreadItem[]; selectedUUID: string; onChange: (uuid: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const selectedTitle = selectedUUID === 'all'
    ? ALL_THREADS.title
    : threads.find(t => t.uuid === selectedUUID)?.title ?? ''

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hit = (t: { title: string; name?: string }) =>
      !q || t.title.toLowerCase().includes(q) || (t.name ?? '').toLowerCase().includes(q)

    const out: { uuid: string; title: string; cat: string }[] = []
    if (hit(ALL_THREADS)) out.push(ALL_THREADS)
    for (const cat of CATEGORY_ORDER) {
      for (const t of threads) {
        if (threadCategory(t) === cat && hit(t)) out.push({ uuid: t.uuid, title: t.title, cat })
      }
    }
    return out
  }, [threads, query])

  useEffect(() => { setActive(0) }, [query])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const choose = (uuid: string) => {
    onChange(uuid)
    setOpen(false)
    setQuery('')
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, matches.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const m = matches[active]; if (m) choose(m.uuid) }
    else if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  let lastCat = ''

  return (
    <div ref={boxRef} style={{ position: 'relative', minWidth: 220 }}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls="thread-options"
        aria-autocomplete="list"
        placeholder="Search threads…"
        value={open ? query : selectedTitle}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        style={{
          width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6,
          background: 'rgb(var(--ink-rgb) / 0.06)',
          border: `1px solid ${open ? 'rgb(var(--ink-rgb) / 0.35)' : 'rgb(var(--ink-rgb) / 0.15)'}`,
          color: 'var(--ink-1)', outline: 'none', cursor: 'text',
        }}
      />
      {open && (
        <div
          id="thread-options"
          role="listbox"
          ref={listRef}
          style={{
            position: 'absolute', zIndex: 40, top: 'calc(100% + 4px)', left: 0, right: 0,
            maxHeight: 320, overflowY: 'auto',
            background: 'var(--surface-raised)',
            border: '1px solid rgb(var(--ink-rgb) / 0.18)',
            borderRadius: 8, boxShadow: '0 8px 24px rgb(var(--shadow-rgb) / 0.35)',
          }}
        >
          {matches.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'rgb(var(--ink-rgb) / 0.55)' }}>
              No thread matches “{query}”.
            </div>
          )}
          {matches.map((m, i) => {
            const heading = m.cat && m.cat !== lastCat ? m.cat : null
            lastCat = m.cat
            return (
              <div key={m.uuid}>
                {heading && (
                  <div style={{
                    padding: '6px 10px 3px', fontSize: 10, letterSpacing: '0.16em',
                    color: 'rgb(var(--ink-rgb) / 0.42)', textTransform: 'uppercase',
                  }}>
                    {heading}
                  </div>
                )}
                <div
                  role="option"
                  aria-selected={m.uuid === selectedUUID}
                  data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={e => { e.preventDefault(); choose(m.uuid) }}
                  style={{
                    padding: '6px 12px', fontSize: 13, cursor: 'pointer',
                    background: i === active ? 'rgb(var(--ink-rgb) / 0.10)' : 'transparent',
                    color: m.uuid === selectedUUID ? 'var(--ink-1)' : 'var(--ink-2)',
                    fontWeight: m.uuid === selectedUUID ? 700 : 400,
                  }}
                >
                  {m.title}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px', background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 13, fontWeight: active ? 700 : 400,
        color: active ? '#f97316' : '#777',
        borderBottom: active ? '2px solid #f97316' : '2px solid transparent',
        marginBottom: -1, whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

export default function StatsClient({ initialThreads = [] }: { initialThreads?: ThreadItem[] }) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [threads, setThreads] = useState<ThreadItem[]>(initialThreads)
  const [threadsLoading, setThreadsLoading] = useState(initialThreads.length === 0)
  const [selectedThreadUUID, setSelectedThreadUUID] = useState(searchParams.get('thread') ?? 'all')
  const [startDate, setStartDate] = useState(searchParams.get('start') ?? '')
  const [endDate, setEndDate] = useState(searchParams.get('end') ?? '')
  const [subTab, setSubTab] = useState<SubTab>((searchParams.get('tab') as SubTab) ?? 'leaderboard')
  const [speedSubTab, setSpeedSubTab] = useState<SpeedSubTab>('gets')
  useEffect(() => {
    if (subTab === 'robs' && selectedThreadUUID !== 'all') setSubTab('leaderboard')
  }, [subTab, selectedThreadUUID])
  const [hideFakeSplits, setHideFakeSplits] = useState(true)
  const [accoladeKey, setAccoladeKey] = useState<AccoladeKey>('gets')

  const [stats, setStats] = useState<Stats | null>(null)
  const [counters, setCounters] = useState<Map<string, CounterInfo>>(new Map())
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([])
  const [dailyCounters, setDailyCounters] = useState<Map<string, CounterInfo>>(new Map())
  const [dailyLoading, setDailyLoading] = useState(false)
  const [dailyError, setDailyError] = useState<string | null>(null)

  const [getsData, setGetsData] = useState<SpeedDataState>(makeEmptySpeedData())
  const [splitsData, setSplitsData] = useState<SpeedDataState>(makeEmptySpeedData())
  const [speedCounters, setSpeedCounters] = useState<Map<string, CounterInfo>>(new Map())
  const [speedLoading, setSpeedLoading] = useState(false)
  const [speedError, setSpeedError] = useState<string | null>(null)
  const [getsSortOrder, setGetsSortOrder] = useState<'fastest' | 'slowest' | 'newest' | 'oldest'>('fastest')
  const [splitsSortOrder, setSplitsSortOrder] = useState<'fastest' | 'slowest' | 'newest' | 'oldest'>('fastest')

  const [graphPoints, setGraphPoints] = useState<GraphPoint[]>([])
  const [graphAllLb, setGraphAllLb] = useState<Record<string, number>>({})
  const [graphTopUUIDs, setGraphTopUUIDs] = useState<string[]>([])
  const [graphCounters, setGraphCounters] = useState<Map<string, CounterInfo>>(new Map())
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphError, setGraphError] = useState<string | null>(null)
  const [graphMode, setGraphMode] = useState<GraphMode>('cumulative-total')
  const [graphSelectedUUIDs, setGraphSelectedUUIDs] = useState<string[]>([])

  const statsSeq = useRef(0)
  const dailySeq = useRef(0)
  const speedSeq = useRef(0)
  const graphSeq = useRef(0)

  const selectedThread = useMemo(
    () => threads.find(t => t.uuid === selectedThreadUUID) ?? null,
    [threads, selectedThreadUUID],
  )
  const threadName = selectedThread?.name ?? 'all'

  useEffect(() => {
    const p = new URLSearchParams()
    p.set('thread', selectedThreadUUID)
    p.set('tab', subTab)
    if (startDate) p.set('start', startDate)
    if (endDate) p.set('end', endDate)
    router.replace(`/stats?${p.toString()}`, { scroll: false })
  }, [selectedThreadUUID, subTab, startDate, endDate])

  useEffect(() => {
    fetch(`${API}/api/thread/all`, { credentials: 'include' })
      .then(r => r.json())
      .then((data: ThreadItem[]) => { if (Array.isArray(data) && data.length > 0) setThreads(data) })
      .catch(() => {})
      .finally(() => setThreadsLoading(false))
  }, [])

  const buildCounterMap = useCallback((list: CounterInfo[]): Map<string, CounterInfo> => {
    const cMap = new Map<string, CounterInfo>()
    for (const c of list) {
      if (!c.roles?.includes('banned')) cMap.set(c.uuid, c)
    }
    return cMap
  }, [])

  const fetchStats = useCallback(async () => {
    const seq = ++statsSeq.current
    setStatsLoading(true)
    try {
      const body: any = { thread: threadName, includeDetails: false }
      if (startDate) body.startDateStr = startDate
      if (endDate) body.endDateStr = endDate
      const res = await fetch(`${API}/api/thread/stats/threadStats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (seq !== statsSeq.current) return
      if (!res.ok) {
        setStatsError(await describeHttpFailure(res, 'stats'))
        setStats(null)
        return
      }
      const data = await res.json()
      setStatsError(null)
      setCounters(buildCounterMap(data.counters ?? []))
      setStats(data.stats?.all ?? null)
    } catch (err) {
      if (seq === statsSeq.current) setStatsError(describeNetworkFailure(err, 'stats'))
    } finally {
      if (seq === statsSeq.current) setStatsLoading(false)
    }
  }, [threadName, startDate, endDate, buildCounterMap])

  useEffect(() => { fetchStats() }, [fetchStats])

  const fetchDaily = useCallback(async () => {
    const seq = ++dailySeq.current
    setDailyLoading(true)
    try {
      const body: any = { thread: threadName }
      if (startDate) body.startDateStr = startDate
      if (endDate) body.endDateStr = endDate
      const res = await fetch(`${API}/api/thread/stats/threadDailyCountLeaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (seq !== dailySeq.current) return
      if (!res.ok) {
        setDailyError(await describeHttpFailure(res, 'daily counts'))
        setDailyEntries([])
        return
      }
      const data = await res.json()
      setDailyError(null)
      setDailyCounters(buildCounterMap(data.counters ?? []))
      setDailyEntries(data.entries ?? [])
    } catch (err) {
      if (seq === dailySeq.current) setDailyError(describeNetworkFailure(err, 'daily counts'))
    } finally {
      if (seq === dailySeq.current) setDailyLoading(false)
    }
  }, [threadName, startDate, endDate, buildCounterMap])

  useEffect(() => {
    if (subTab === 'daily_counts') fetchDaily()
  }, [subTab, fetchDaily])

  const SPEED_PAGE_SIZE = 50

  const fetchSpeedPage = useCallback(async (
    type: 'speed' | 'splitSpeed',
    page: number,
    selectedUserUUIDs: string[],
    isInitial: boolean,
    sortOrder: 'fastest' | 'slowest' | 'newest' | 'oldest' = 'fastest',
  ) => {
    const seq = speedSeq.current
    const setter = type === 'speed' ? setGetsData : setSplitsData

    setter(prev => ({ ...prev, isLoadingMore: true }))
    try {
      const body: any = {
        thread: threadName,
        type,
        offset: page * SPEED_PAGE_SIZE,
        limit: SPEED_PAGE_SIZE,
        sortOrder,
      }
      if (startDate) body.startDateStr = startDate
      if (endDate) body.endDateStr = endDate
      if (selectedUserUUIDs.length > 0) body.selectedUserUUIDs = selectedUserUUIDs
      const res = await fetch(`${API}/api/thread/stats/threadStatsDetails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (seq !== speedSeq.current) return
      if (!res.ok) {
        setSpeedError(await describeHttpFailure(res, 'speed records'))
        return
      }
      const data = await res.json()
      setSpeedError(null)

      setSpeedCounters(prev => {
        const next = new Map(prev)
        for (const c of data.counters ?? []) {
          if (!c.roles?.includes('banned')) next.set(c.uuid, c)
        }
        return next
      })

      setter(prev => {
        const merged = isInitial ? (data.records ?? []) : [...prev.records, ...(data.records ?? [])]
        const loadedPages = new Set(prev.loadedPages)
        loadedPages.add(page)
        return {
          records: merged,
          hallOfSpeed: isInitial ? (data.hallOfSpeed ?? []) : prev.hallOfSpeed,
          distributionStats: isInitial ? (data.distributionStats ?? []) : prev.distributionStats,
          hallOfSpeedRealOnly: isInitial ? (data.hallOfSpeedRealOnly ?? data.hallOfSpeed ?? []) : prev.hallOfSpeedRealOnly,
          distributionStatsRealOnly: isInitial ? (data.distributionStatsRealOnly ?? data.distributionStats ?? []) : prev.distributionStatsRealOnly,
          hasMore: data.hasMore ?? false,
          total: data.total ?? merged.length,
          loadedPages,
          isLoadingMore: false,
        }
      })
    } catch {
      setter(prev => ({ ...prev, isLoadingMore: false }))
    }
  }, [threadName, startDate, endDate])

  const fetchSpeed = useCallback(async (
    getsSO: 'fastest' | 'slowest' | 'newest' | 'oldest' = 'fastest',
    splitsSO: 'fastest' | 'slowest' | 'newest' | 'oldest' = 'fastest',
  ) => {
    const seq = ++speedSeq.current
    setSpeedLoading(true)
    setGetsData(makeEmptySpeedData())
    setSplitsData(makeEmptySpeedData())
    setSpeedCounters(new Map())
    try {
      await Promise.all([
        fetchSpeedPage('speed', 0, [], true, getsSO),
        fetchSpeedPage('splitSpeed', 0, [], true, splitsSO),
      ])
    } finally {
      if (seq === speedSeq.current) setSpeedLoading(false)
    }
  }, [fetchSpeedPage])

  useEffect(() => {
    if (subTab === 'speed') fetchSpeed()
  }, [subTab, fetchSpeed])

  const needsTopN = graphMode === 'cumulative-stacked'

  const fetchGraph = useCallback(async () => {
    const seq = ++graphSeq.current
    setGraphLoading(true)
    try {
      const body: any = { thread: threadName }
      if (startDate) body.startDateStr = startDate
      if (endDate) body.endDateStr = endDate
      if (graphSelectedUUIDs.length > 0) body.selectedUserUUIDs = graphSelectedUUIDs
      if (needsTopN) body.topN = STACK_TOP_N
      const res = await fetch(`${API}/api/thread/stats/threadGraph`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (seq !== graphSeq.current) return
      if (!res.ok) {
        setGraphError(await describeHttpFailure(res, 'graph data'))
        setGraphPoints([])
        return
      }
      const data = await res.json()
      setGraphError(null)
      setGraphPoints(data.points ?? [])
      setGraphAllLb(data.allLeaderboard ?? {})
      setGraphTopUUIDs(data.topUUIDs ?? [])
    } catch (err) {
      if (seq === graphSeq.current) setGraphError(describeNetworkFailure(err, 'graph data'))
    } finally {
      if (seq === graphSeq.current) setGraphLoading(false)
    }
  }, [threadName, startDate, endDate, graphSelectedUUIDs, needsTopN])

  useEffect(() => {
    if (subTab === 'graphs') fetchGraph()
  }, [subTab, fetchGraph])

  useEffect(() => {
    setGraphCounters(counters)
  }, [counters])

  const availableAccolades = ACCOLADE_KEYS.filter(k => stats?.[k] && Object.keys(stats[k]!).length > 0)

  useEffect(() => {
    if (availableAccolades.length > 0 && !availableAccolades.includes(accoladeKey)) {
      setAccoladeKey(availableAccolades[0])
    }
  }, [availableAccolades.join(',')])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 20px' }}>Stats</h1>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 24, padding: '16px', background: 'rgb(var(--ink-rgb) / 0.03)', borderRadius: 10, border: '1px solid rgb(var(--ink-rgb) / 0.07)' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: '#888' }}>
          Thread
          {threadsLoading
            ? <div style={{ height: 32, width: 220, borderRadius: 6, background: 'rgb(var(--ink-rgb) / 0.06)' }} />
            : <ThreadSelect threads={threads} selectedUUID={selectedThreadUUID} onChange={setSelectedThreadUUID} />
          }
        </label>
        <DateInput label="Start date" value={startDate} onChange={setStartDate} />
        <DateInput label="End date" value={endDate} onChange={setEndDate} />
        {(startDate || endDate) && (
          <button
            onClick={() => { setStartDate(''); setEndDate('') }}
            style={{ alignSelf: 'flex-end', padding: '6px 12px', fontSize: 12, borderRadius: 6, border: '1px solid rgb(var(--ink-rgb) / 0.15)', background: 'transparent', color: '#888', cursor: 'pointer' }}
          >
            Clear dates
          </button>
        )}
        <button
          onClick={() => navigator.clipboard.writeText(window.location.href)}
          style={{ alignSelf: 'flex-end', padding: '6px 12px', fontSize: 12, borderRadius: 6, border: '1px solid rgb(var(--ink-rgb) / 0.15)', background: 'transparent', color: '#888', cursor: 'pointer' }}
        >
          Copy link
        </button>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgb(var(--ink-rgb) / 0.08)', marginBottom: 20, flexWrap: 'wrap' }}>
        <TabBtn label="Leaderboard" active={subTab === 'leaderboard'} onClick={() => setSubTab('leaderboard')} />
        <TabBtn label="Graphs" active={subTab === 'graphs'} onClick={() => setSubTab('graphs')} />
        {!!stats && availableAccolades.length > 0 && (
          <TabBtn label="Accolades" active={subTab === 'accolades'} onClick={() => setSubTab('accolades')} />
        )}
        {!!stats?.accuracy?.length && (
          <TabBtn label="Accuracy" active={subTab === 'accuracy'} onClick={() => setSubTab('accuracy')} />
        )}
        <TabBtn label="Daily Counts" active={subTab === 'daily_counts'} onClick={() => setSubTab('daily_counts')} />
        <TabBtn label="Speed" active={subTab === 'speed'} onClick={() => setSubTab('speed')} />
        <TabBtn label="Time" active={subTab === 'time'} onClick={() => setSubTab('time')} />
        {selectedThreadUUID === 'all' && (
          <TabBtn label="Robs" active={subTab === 'robs'} onClick={() => setSubTab('robs')} />
        )}
      </div>

      <div style={{ background: 'rgb(var(--ink-rgb) / 0.02)', borderRadius: 10, border: '1px solid rgb(var(--ink-rgb) / 0.07)', padding: '16px 20px', minHeight: 200 }}>
        {subTab === 'leaderboard' && (
          statsLoading ? <Spinner />
            : statsError ? <ErrorBox message={statsError} onRetry={fetchStats} />
            : stats?.leaderboard && Object.keys(stats.leaderboard).length > 0
              ? <LeaderboardTable lb={stats.leaderboard} counters={counters} label="Counts" />
              : <Empty>No leaderboard data for this range.</Empty>
        )}

        {subTab === 'robs' && selectedThreadUUID === 'all' && (
          <RobsPanel startDate={startDate || undefined} endDate={endDate || undefined} />
        )}

        {subTab === 'time' && (
          <TimeLeaderboard
            threadName={threadName}
            range={startDate || endDate ? { time: stats?.time ?? NO_TIME, counters, loading: statsLoading, hasCounts: Object.keys(stats?.leaderboard ?? {}).length > 0 } : undefined}
          />
        )}

        {subTab === 'accuracy' && (
          statsLoading ? <Spinner />
            : statsError ? <ErrorBox message={statsError} onRetry={fetchStats} />
            : !stats?.accuracy?.length
              ? <Empty>No accuracy data for this range.</Empty>
              : <AccuracyTable rows={stats.accuracy} counters={counters} />
        )}

        {subTab === 'accolades' && (
          statsLoading ? <Spinner />
            : statsError ? <ErrorBox message={statsError} onRetry={fetchStats} />
            : availableAccolades.length === 0
            ? <Empty>No accolade data for this range.</Empty>
            : <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  {availableAccolades.map(k => (
                    <button
                      key={k}
                      onClick={() => setAccoladeKey(k)}
                      style={{
                        padding: '4px 12px', borderRadius: 12, fontSize: 12,
                        border: `1px solid ${accoladeKey === k ? '#f97316' : 'rgb(var(--ink-rgb) / 0.15)'}`,
                        background: accoladeKey === k ? 'rgba(249,115,22,0.15)' : 'transparent',
                        color: accoladeKey === k ? '#f97316' : '#888', cursor: 'pointer',
                      }}
                    >
                      {ACCOLADE_LABELS[k]}
                    </button>
                  ))}
                </div>
                {stats?.[accoladeKey]
                  ? <LeaderboardTable lb={stats[accoladeKey]!} counters={counters} label={ACCOLADE_LABELS[accoladeKey]} />
                  : <Empty>No data.</Empty>
                }
              </>
        )}

        {subTab === 'daily_counts' && (
          dailyLoading ? <Spinner />
            : dailyError ? <ErrorBox message={dailyError} onRetry={fetchDaily} />
            : <DailyCountsTable entries={dailyEntries} counters={dailyCounters} />
        )}

        {subTab === 'graphs' && (
          graphLoading ? <Spinner />
            : graphError ? <ErrorBox message={graphError} onRetry={fetchGraph} />
            : (
            <GraphsPanel
              points={graphPoints}
              allLb={graphAllLb}
              counters={graphCounters}
              topUUIDs={graphTopUUIDs}
              mode={graphMode}
              onModeChange={setGraphMode}
              selectedUUIDs={graphSelectedUUIDs}
              onSelectedUUIDsChange={uuids => { setGraphSelectedUUIDs(uuids); }}
            />
          )
        )}

        {subTab === 'speed' && (
          speedLoading ? <Spinner />
            : speedError ? <ErrorBox message={speedError} /> : (() => {
            const active = speedSubTab === 'gets' ? getsData : splitsData
            const visibleRecords = hideFakeSplits ? active.records.filter(r => !r.isFake) : active.records
            const hiddenCount = active.records.length - visibleRecords.length
            return (
              <div>
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgb(var(--ink-rgb) / 0.08)', marginBottom: 16 }}>
                  <TabBtn label="Gets" active={speedSubTab === 'gets'} onClick={() => setSpeedSubTab('gets')} />
                  <TabBtn label="Splits" active={speedSubTab === 'splits'} onClick={() => setSpeedSubTab('splits')} />
                </div>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12,
                  fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer', userSelect: 'none',
                }}>
                  <input
                    type="checkbox"
                    checked={hideFakeSplits}
                    onChange={e => setHideFakeSplits(e.target.checked)}
                    style={{ accentColor: 'var(--primary)', width: 14, height: 14 }}
                  />
                  Hide fake {speedSubTab === 'splits' ? 'splits' : 'gets'}
                  {hiddenCount > 0 && (
                    <span style={{ color: '#5c6377' }}>
                      · {hiddenCount} hidden on this page
                    </span>
                  )}
                </label>
                <SpeedTable
                  key={speedSubTab}
                  speed={visibleRecords}
                  threadName={threadName}
                  isSplitTable={speedSubTab === 'splits'}
                  validationType={selectedThread?.validationType}
                  hallOfSpeedRows={hideFakeSplits ? active.hallOfSpeedRealOnly : active.hallOfSpeed}
                  distributionStats={hideFakeSplits ? active.distributionStatsRealOnly : active.distributionStats}
                  totalCount={active.total}
                  canLoadMore={active.hasMore}
                  isLoadingMore={active.isLoadingMore}
                  counters={speedCounters}
                  sortOrder={speedSubTab === 'gets' ? getsSortOrder : splitsSortOrder}
                  onSortChange={(order) => {
                    const type = speedSubTab === 'gets' ? 'speed' : 'splitSpeed'
                    const setter = speedSubTab === 'gets' ? setGetsData : setSplitsData
                    if (speedSubTab === 'gets') setGetsSortOrder(order)
                    else setSplitsSortOrder(order)
                    setter(makeEmptySpeedData())
                    fetchSpeedPage(type, 0, [], true, order)
                  }}
                  onEnsurePageLoaded={(page, selectedUserUUIDs) => {
                    if (!active.loadedPages.has(page)) {
                      const so = speedSubTab === 'gets' ? getsSortOrder : splitsSortOrder
                      fetchSpeedPage(
                        speedSubTab === 'gets' ? 'speed' : 'splitSpeed',
                        page,
                        selectedUserUUIDs,
                        false,
                        so,
                      )
                    }
                  }}
                  onSelectedUsersChange={(uuids) => {
                    const type = speedSubTab === 'gets' ? 'speed' : 'splitSpeed'
                    const setter = speedSubTab === 'gets' ? setGetsData : setSplitsData
                    const so = speedSubTab === 'gets' ? getsSortOrder : splitsSortOrder
                    setter(makeEmptySpeedData())
                    fetchSpeedPage(type, 0, uuids, true, so)
                  }}
                />
              </div>
            )
          })()
        )}
      </div>

      {stats?.last_updated_uuid && (
        <div style={{ fontSize: 11, color: '#444', marginTop: 10 }}>
          Stats last updated: {stats.last_updated_uuid}
        </div>
      )}
    </div>
  )
}

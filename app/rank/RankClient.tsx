'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RANK_COLORS, RANK_LABELS, getChallengeTitle } from '@/lib/rankUtils'
import type { RankName, CounterRankProfileResponse } from '@/lib/rankUtils'
import { RankIconBadge } from '@/components/rank/RankIconBadge'
import { avatarUrl } from '@/lib/counterUtils'

import { API } from '@/lib/apiBase'

type RankSeason = { id: number; name: string; endedAt: string | null }

type LeaderboardEntry = {
  counterUuid: string
  username: string
  name: string
  avatar: string
  discordId: string
  color: string
  rank: RankName
  division: 1 | 2 | 3
  totalGg: number
}

type SitewideLeaderboardResponse = {
  season: RankSeason | null
  total: number
  entries: LeaderboardEntry[]
}

type RankChallenge = {
  id: string
  type: string
  rank: RankName
  target: number
  params: Record<string, any> | null
  ggReward: number
  threadUuid: string | null
  completionCount?: number
  sequence?: number
  topCompleters?: { counterUuid: string; username: string; name: string; completedAt: string; ggAwarded: number }[]
}

type GgProjection = { dailyGgAvg: number; targetRank: RankName | null; daysToTarget: number | null }

type Thread = { uuid: string; name: string; title: string }

const CHALLENGE_TYPES = [
  'thread_counts', 'split_under_ms', 'get_under_ms', 'bars_within_ms',
  'roll', 'lrwoed_score', 'number_shuffle_win', 'accuracy_rate',
  'counts_in_day', 'count_attempts', 'time_counting',
]

const THREAD_REQUIRED_TYPES = new Set([
  'split_under_ms', 'get_under_ms', 'bars_within_ms', 'count_attempts',
  'roll', 'lrwoed_score', 'number_shuffle_win',
])

const PSEUDO_THREAD_LABELS: Record<string, string> = {
  '00000000-0000-0000-0000-000000000001': 'lrwoed',
  '00000000-0000-0000-0000-000000000002': 'Number Shuffle',
}

const RANK_OPTIONS: RankName[] = [
  'bronze', 'silver', 'gold', 'platinum', 'emerald',
  'diamond', 'countmeister', 'grandcounter', 'peak',
]

function getPrettyTypeName(type: string): string {
  const names: Record<string, string> = {
    thread_counts: 'Thread Counts', split_under_ms: 'Split Speed', get_under_ms: 'Get Speed',
    bars_within_ms: 'Bars Speed', roll: 'Dice Roll', lrwoed_score: 'lrwoed Score',
    number_shuffle_win: 'Number Shuffle', accuracy_rate: 'Accuracy Rate',
    counts_in_day: 'Daily Counts', count_attempts: 'Count Attempts',
    time_counting: 'Time Counting',
  }
  return names[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

const card: React.CSSProperties = {
  background: 'rgb(var(--ink-rgb) / 0.05)',
  border: '1px solid rgb(var(--ink-rgb) / 0.1)',
  borderRadius: 8,
}

const btn = (active = false): React.CSSProperties => ({
  background: active ? 'rgba(255,215,0,0.2)' : 'rgb(var(--ink-rgb) / 0.08)',
  border: `1px solid ${active ? 'rgba(255,215,0,0.5)' : 'rgb(var(--ink-rgb) / 0.15)'}`,
  borderRadius: 6, color: active ? 'var(--gold)' : 'rgb(var(--ink-rgb) / 0.7)',
  cursor: 'pointer', fontSize: '0.8rem', padding: '5px 12px', fontWeight: active ? 700 : 400,
})

function ChallengeCard({ challenge, threadName }: { challenge: RankChallenge; threadName: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const completers = challenge.topCompleters ?? []
  const count = challenge.completionCount ?? 0
  const rankColor = RANK_COLORS[challenge.rank] ?? 'rgb(var(--ink-rgb) / 0.15)'
  const POSITION_COLORS = ['var(--gold)', '#c0c0c0', '#cd7f32']

  return (
    <div style={{ ...card, border: `1px solid ${rankColor}22`, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <RankIconBadge rank={challenge.rank} division={1} size="mini" />
          <span style={{ fontWeight: 700, color: 'var(--ink-1)', fontSize: '0.9rem' }}>{getChallengeTitle(challenge)}</span>
          {threadName && (
            <span style={{ fontSize: '0.65rem', background: 'rgb(var(--ink-rgb) / 0.1)', color: 'rgb(var(--ink-rgb) / 0.6)', padding: '2px 6px', borderRadius: 4 }}>
              {threadName}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: rankColor, fontWeight: 700, fontSize: '0.8rem' }}>+{challenge.ggReward} GG</span>
          <span style={{ fontSize: '0.65rem', background: 'rgb(var(--ink-rgb) / 0.08)', color: 'rgb(var(--ink-rgb) / 0.5)', padding: '2px 6px', borderRadius: 4 }}>
            {count} {count === 1 ? 'completion' : 'completions'}
          </span>
        </div>
      </div>
      <div style={{ marginTop: 6, fontSize: '0.75rem', color: 'rgb(var(--ink-rgb) / 0.35)' }}>
        Target: {challenge.target.toLocaleString()}
        {challenge.params && ` · ${Object.entries(challenge.params).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')}`}
      </div>
      {completers.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setExpanded(v => !v)} style={{ background: 'none', border: 'none', color: 'rgb(var(--ink-rgb) / 0.4)', fontSize: '0.7rem', cursor: 'pointer', padding: 0 }}>
            {expanded ? '▲' : '▼'} {expanded ? 'Hide' : 'Show'} first {completers.length} completer{completers.length !== 1 ? 's' : ''}
          </button>
          {expanded && (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {completers.map((c, i) => (
                <a key={c.counterUuid} href={`/counter/${c.username}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                  <span style={{ color: POSITION_COLORS[i] ?? 'rgb(var(--ink-rgb) / 0.3)', fontWeight: 700, minWidth: 20, fontSize: '0.75rem' }}>#{i + 1}</span>
                  <span style={{ color: 'rgb(var(--ink-rgb) / 0.8)', fontSize: '0.75rem' }}>{c.name || c.username}</span>
                  <span style={{ color: 'rgb(var(--ink-rgb) / 0.35)', fontSize: '0.7rem', marginLeft: 'auto' }}>{new Date(c.completedAt).toLocaleDateString()}</span>
                  <span style={{ color: rankColor, fontSize: '0.7rem' }}>+{c.ggAwarded} GG</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type Props = { username: string | null; isAdmin: boolean; threads: Thread[] }

type RankTabKey = 'leaderboard' | 'challenges' | 'my-progress'

export default function RankClient({ username, isAdmin, threads }: Props) {
  const [tab, setTab] = useState<RankTabKey>('leaderboard')

  const [leaderboard, setLeaderboard] = useState<SitewideLeaderboardResponse | null>(null)
  const [leaderboardPage, setLeaderboardPage] = useState(0)
  const [seasons, setSeasons] = useState<RankSeason[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | undefined>(undefined)
  const [lbLoading, setLbLoading] = useState(true)
  const [leaderboardSearch, setLeaderboardSearch] = useState('')
  const myRowRef = useRef<HTMLTableRowElement>(null)
  const PAGE_SIZE = 25

  const [challengeType, setChallengeType] = useState('')
  const [typeMatrixChallenges, setTypeMatrixChallenges] = useState<RankChallenge[]>([])
  const [typeMatrixLoading, setTypeMatrixLoading] = useState(false)
  const [selectedCell, setSelectedCell] = useState<{ threadUuid: string | null; rank: RankName } | null>(null)
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [challenges, setChallenges] = useState<RankChallenge[]>([])
  const [challengesTotal, setChallengesTotal] = useState(0)
  const [challengesOffset, setChallengesOffset] = useState(0)
  const [challengesLoading, setChallengesLoading] = useState(false)
  const [challengesLoadingMore, setChallengesLoadingMore] = useState(false)
  const CELL_PAGE_SIZE = 20

  const [myProfile, setMyProfile] = useState<CounterRankProfileResponse | null>(null)
  const [myProjection, setMyProjection] = useState<GgProjection | null>(null)
  const [myProgressLoading, setMyProgressLoading] = useState(false)
  const [myProgressLoaded, setMyProgressLoaded] = useState(false)

  const threadNameMap = new Map(threads.map(t => [t.uuid, t.title || t.name]))
  const activeSeason = leaderboard?.season

  useEffect(() => {
    apiFetch<RankSeason[]>(`${API}/api/rank/seasons`).then(data => {
      setSeasons(data)
      const active = data.find(s => s.endedAt == null)
      setSelectedSeasonId(active?.id ?? data[0]?.id)
    }).catch(() => {})
  }, [])

  useEffect(() => { setLeaderboardPage(0) }, [selectedSeasonId])

  useEffect(() => {
    setLbLoading(true)
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(leaderboardPage * PAGE_SIZE) })
    if (selectedSeasonId != null) params.set('seasonId', String(selectedSeasonId))
    apiFetch<SitewideLeaderboardResponse>(`${API}/api/rank/sitewide?${params}`)
      .then(data => { setLeaderboard(data); setLbLoading(false) })
      .catch(() => setLbLoading(false))
  }, [selectedSeasonId, leaderboardPage])

  useEffect(() => {
    setSelectedCell(null)
    setSelectedThread(null)
    setChallenges([])
    if (tab !== 'challenges' || !challengeType) { setTypeMatrixChallenges([]); return }
    setTypeMatrixLoading(true)
    apiFetch<{ total: number; items: RankChallenge[] }>(`${API}/api/rank/challenges?type=${challengeType}&limit=1000`)
      .then(data => { setTypeMatrixChallenges(data.items); setTypeMatrixLoading(false) })
      .catch(() => setTypeMatrixLoading(false))
  }, [tab, challengeType])

  const loadChallenges = useCallback((cell: { threadUuid: string | null; rank: RankName }, type: string, offset: number, append: boolean) => {
    if (!append) setChallengesLoading(true)
    else setChallengesLoadingMore(true)
    const q = new URLSearchParams({ type, rank: cell.rank, context: 'true', limit: String(CELL_PAGE_SIZE), offset: String(offset) })
    if (cell.threadUuid !== null) q.set('threadUuid', cell.threadUuid)
    else q.set('sitewideOnly', 'true')
    apiFetch<{ total: number; items: RankChallenge[] }>(`${API}/api/rank/challenges?${q}`)
      .then(data => {
        setChallenges(prev => append ? [...prev, ...data.items] : data.items)
        setChallengesTotal(data.total)
        setChallengesOffset(offset + data.items.length)
        setChallengesLoading(false)
        setChallengesLoadingMore(false)
      })
      .catch(() => { setChallengesLoading(false); setChallengesLoadingMore(false) })
  }, [])

  useEffect(() => {
    if (!selectedCell || !challengeType) return
    setChallengesOffset(0)
    loadChallenges(selectedCell, challengeType, 0, false)
  }, [selectedCell, challengeType, loadChallenges])

  const myProgressKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (tab !== 'my-progress' || myProgressLoaded || !username) return
    const key = `${username}|${selectedSeasonId ?? ''}`
    if (myProgressKeyRef.current === key) return
    myProgressKeyRef.current = key
    setMyProgressLoading(true)
    const pParams = selectedSeasonId != null ? `?seasonId=${selectedSeasonId}` : ''
    Promise.all([
      apiFetch<CounterRankProfileResponse>(`${API}/api/rank/counter/${username}${pParams}`),
      apiFetch<GgProjection | null>(`${API}/api/rank/stats/projection?username=${username}${selectedSeasonId != null ? `&seasonId=${selectedSeasonId}` : ''}`),
    ]).then(([profile, projection]) => {
      setMyProfile(profile)
      setMyProjection(projection)
      setMyProgressLoaded(true)
      setMyProgressLoading(false)
    }).catch(() => {
      myProgressKeyRef.current = null
      setMyProgressLoading(false)
    })
  }, [tab, username, myProgressLoaded, selectedSeasonId])

  const matrixThreadRequired = THREAD_REQUIRED_TYPES.has(challengeType)
  const matrixThreadUuids = Array.from(new Set(typeMatrixChallenges.map(c => c.threadUuid).filter(Boolean) as string[]))
  const matrixRows = [
    ...(matrixThreadRequired ? [] : [{ key: 'sitewide', label: 'Sitewide', threadUuid: null }]),
    ...matrixThreadUuids.map(uuid => ({
      key: uuid,
      label: PSEUDO_THREAD_LABELS[uuid] ?? threadNameMap.get(uuid) ?? uuid.slice(0, 8),
      threadUuid: uuid,
    })),
  ]
  const countFor = (threadUuid: string | null, rank: RankName) =>
    typeMatrixChallenges.filter(c => (c.threadUuid ?? null) === threadUuid && c.rank === rank).length

  const threadViewChallenges = selectedThread
    ? typeMatrixChallenges
        .filter(c => selectedThread === '__sitewide__' ? (c.threadUuid ?? null) === null : (c.threadUuid ?? null) === selectedThread)
        .sort((a, b) => {
          const ri = RANK_OPTIONS.indexOf(a.rank) - RANK_OPTIONS.indexOf(b.rank)
          return ri !== 0 ? ri : (a.sequence ?? 0) - (b.sequence ?? 0)
        })
    : []

  const hasMore = challenges.length < challengesTotal

  const thStyle: React.CSSProperties = {
    padding: '6px 8px', color: 'rgb(var(--ink-rgb) / 0.45)', fontWeight: 600,
    fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid rgb(var(--ink-rgb) / 0.1)', textAlign: 'left',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 32 }}>🏆</span>
              <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: 'var(--ink-1)' }}>Sitewide Rank</h1>
            </div>
            {activeSeason && (
              <p style={{ margin: '2px 0 0 44px', fontSize: '0.85rem', color: 'rgb(var(--ink-rgb) / 0.5)' }}>
                {activeSeason.name}{activeSeason.endedAt == null ? ' · Active' : ` · Ended ${new Date(Number(activeSeason.endedAt)).toLocaleDateString()}`}
              </p>
            )}
          </div>
          {isAdmin && (
            <a href="/rank/admin" style={{ ...btn(), textDecoration: 'none', padding: '6px 14px' }}>Admin</a>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgb(var(--ink-rgb) / 0.1)', paddingBottom: 4 }}>
          {((username
            ? ['leaderboard', 'challenges', 'my-progress']
            : ['leaderboard', 'challenges']) as RankTabKey[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '6px 14px',
              color: tab === t ? 'var(--ink-1)' : 'var(--ink-3)',
              fontWeight: tab === t ? 700 : 400, fontSize: '0.9rem',
              borderBottom: tab === t ? '2px solid var(--gold)' : '2px solid transparent',
              marginBottom: -5,
            }}>
              {t === 'leaderboard' ? 'Leaderboard' : t === 'challenges' ? 'Challenges' : 'My Progress'}
            </button>
          ))}
        </div>

        {tab === 'leaderboard' && (
          <>
            {seasons.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {seasons.map(s => (
                  <button key={s.id} onClick={() => setSelectedSeasonId(s.id)} style={{
                    ...btn(selectedSeasonId === s.id),
                    background: selectedSeasonId === s.id ? 'var(--gold)' : 'rgb(var(--ink-rgb) / 0.08)',
                    color: selectedSeasonId === s.id ? '#000' : 'rgb(var(--ink-rgb) / 0.6)',
                    border: selectedSeasonId === s.id ? 'none' : '1px solid rgb(var(--ink-rgb) / 0.25)',
                  }}>
                    {s.endedAt == null ? `${s.name} (active)` : s.name}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search by name or username…"
                value={leaderboardSearch}
                onChange={e => setLeaderboardSearch(e.target.value)}
                style={{
                  flex: '1 1 240px', background: 'rgb(var(--ink-rgb) / 0.07)', border: '1px solid rgb(var(--ink-rgb) / 0.2)',
                  borderRadius: 6, color: 'var(--ink-1)', fontSize: '0.85rem', padding: '7px 12px',
                }}
              />
              {username && (
                <button onClick={() => { setLeaderboardSearch(''); setTimeout(() => myRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0) }}
                  style={{ ...btn(), borderColor: 'rgba(255,215,0,0.5)', color: 'var(--gold)' }}>
                  Jump to me
                </button>
              )}
            </div>

            {lbLoading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'rgb(var(--ink-rgb) / 0.5)' }}>Loading…</div>
            ) : !leaderboard || leaderboard.entries.length === 0 ? (
              <div style={{ ...card, padding: 24, textAlign: 'center', color: 'rgb(var(--ink-rgb) / 0.5)' }}>No ranking data for this season yet.</div>
            ) : (
              <div style={{ ...card, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: 48 }}>#</th>
                      <th style={thStyle}>Counter</th>
                      <th style={thStyle}>Rank</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Total GG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.entries
                      .map((entry, i) => ({ entry, i }))
                      .filter(({ entry }) => {
                        if (!leaderboardSearch.trim()) return true
                        const q = leaderboardSearch.trim().toLowerCase()
                        return entry.username.toLowerCase().includes(q) || (entry.name ?? '').toLowerCase().includes(q)
                      })
                      .map(({ entry, i }) => {
                        const position = leaderboardPage * PAGE_SIZE + i
                        const posColor = ['var(--gold)', '#c0c0c0', '#cd7f32'][position] ?? null
                        const rankColor = RANK_COLORS[entry.rank] ?? 'rgb(var(--ink-rgb) / 0.15)'
                        const isMe = username === entry.username
                        const imgSrc = avatarUrl({ discordId: entry.discordId, avatar: entry.avatar })
                        return (
                          <tr key={entry.counterUuid} ref={isMe ? myRowRef : undefined}
                            onClick={() => window.location.href = `/counter/${entry.username}`}
                            style={{
                              cursor: 'pointer',
                              background: isMe ? 'rgba(255,215,0,0.08)' : position === 0 ? 'rgba(255,215,0,0.04)' : position === 1 ? 'rgba(192,192,192,0.03)' : position === 2 ? 'rgba(205,127,50,0.03)' : 'transparent',
                              borderLeft: `3px solid ${isMe ? 'var(--gold)' : posColor ?? 'transparent'}`,
                              outline: isMe ? '1px solid rgba(255,215,0,0.4)' : undefined,
                            }}>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid rgb(var(--ink-rgb) / 0.06)' }}>
                              <span style={{ color: posColor ?? 'rgb(var(--ink-rgb) / 0.35)', fontWeight: 700, fontSize: position < 3 ? '1rem' : '0.85rem' }}>
                                {position + 1}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid rgb(var(--ink-rgb) / 0.06)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${rankColor}`, flexShrink: 0 }}>
                                  {imgSrc
                                    ? <img src={imgSrc} alt="" width={32} height={32} style={{ display: 'block', objectFit: 'cover' }} />
                                    : <div style={{ width: 32, height: 32, background: rankColor + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: rankColor }}>{(entry.name || entry.username)[0]?.toUpperCase()}</div>
                                  }
                                </div>
                                <span style={{ color: entry.color ? `color-mix(in oklch, ${entry.color} 60%, var(--foreground))` : 'var(--ink-1)', fontWeight: 600, fontSize: '0.9rem' }}>{entry.name || entry.username}</span>
                              </div>
                            </td>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid rgb(var(--ink-rgb) / 0.06)' }}>
                              <RankIconBadge rank={entry.rank} division={entry.division} size="mini" />
                            </td>
                            <td style={{ padding: '8px 10px', borderBottom: '1px solid rgb(var(--ink-rgb) / 0.06)', textAlign: 'right' }}>
                              <span style={{ color: rankColor, fontWeight: 700, fontSize: '0.85rem' }}>{entry.totalGg.toLocaleString()} GG</span>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {leaderboard && leaderboard.total > PAGE_SIZE && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
                <button disabled={leaderboardPage === 0} onClick={() => setLeaderboardPage(p => Math.max(0, p - 1))}
                  style={{ ...btn(), opacity: leaderboardPage === 0 ? 0.4 : 1 }}>◀</button>
                <span style={{ color: 'rgb(var(--ink-rgb) / 0.6)', fontSize: '0.85rem' }}>
                  Page {leaderboardPage + 1} of {Math.ceil(leaderboard.total / PAGE_SIZE)}
                </span>
                <button disabled={(leaderboardPage + 1) * PAGE_SIZE >= leaderboard.total}
                  onClick={() => setLeaderboardPage(p => p + 1)}
                  style={{ ...btn(), opacity: (leaderboardPage + 1) * PAGE_SIZE >= leaderboard.total ? 0.4 : 1 }}>▶</button>
              </div>
            )}
          </>
        )}

        {tab === 'challenges' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <select value={challengeType} onChange={e => setChallengeType(e.target.value)}
                style={{ background: 'rgb(var(--ink-rgb) / 0.07)', border: '1px solid rgb(var(--ink-rgb) / 0.2)', borderRadius: 6, color: 'var(--ink-1)', fontSize: '0.85rem', padding: '7px 12px', minWidth: 240 }}>
                <option value="">Select a type…</option>
                {CHALLENGE_TYPES.map(t => <option key={t} value={t}>{getPrettyTypeName(t)}</option>)}
              </select>
            </div>

            {!challengeType ? (
              <div style={{ ...card, padding: 24, textAlign: 'center', color: 'rgb(var(--ink-rgb) / 0.5)' }}>Pick a challenge type to see coverage.</div>
            ) : typeMatrixLoading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'rgb(var(--ink-rgb) / 0.5)' }}>Loading…</div>
            ) : (
              <>
                <div style={{ ...card, marginBottom: 16, overflow: 'auto', maxHeight: 420 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, background: 'var(--background)', position: 'sticky', top: 0 }}>Thread</th>
                        {RANK_OPTIONS.map(r => (
                          <th key={r} style={{ ...thStyle, background: 'var(--background)', position: 'sticky', top: 0, textAlign: 'center', fontSize: '0.65rem', whiteSpace: 'nowrap', padding: '6px 8px' }}>
                            {RANK_LABELS[r]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrixRows.length === 0 ? (
                        <tr><td colSpan={RANK_OPTIONS.length + 1} style={{ padding: 16, color: 'rgb(var(--ink-rgb) / 0.5)', fontSize: '0.85rem' }}>No challenges of this type yet.</td></tr>
                      ) : matrixRows.map(row => {
                        const rowKey = row.threadUuid ?? '__sitewide__'
                        const isThreadSelected = selectedThread === rowKey
                        const rowTotal = RANK_OPTIONS.reduce((sum, r) => sum + countFor(row.threadUuid, r), 0)
                        return (
                          <tr key={row.key}>
                            <td
                              onClick={() => { if (rowTotal === 0) return; setSelectedCell(null); setSelectedThread(isThreadSelected ? null : rowKey) }}
                              style={{
                                padding: '6px 10px', borderBottom: '1px solid rgb(var(--ink-rgb) / 0.06)',
                                color: isThreadSelected ? 'var(--gold)' : 'var(--ink-1)',
                                cursor: rowTotal > 0 ? 'pointer' : 'default',
                                fontWeight: isThreadSelected ? 700 : 400,
                                background: isThreadSelected ? 'rgba(255,215,0,0.08)' : undefined,
                                fontSize: '0.8rem', userSelect: 'none',
                              }}>
                              {row.label}
                            </td>
                            {RANK_OPTIONS.map(r => {
                              const cnt = countFor(row.threadUuid, r)
                              const isSelected = selectedCell?.threadUuid === row.threadUuid && selectedCell?.rank === r
                              return (
                                <td key={r} align="center"
                                  onClick={() => { if (cnt === 0) return; setSelectedThread(null); setSelectedCell({ threadUuid: row.threadUuid, rank: r }) }}
                                  style={{
                                    padding: '6px 4px', borderBottom: '1px solid rgb(var(--ink-rgb) / 0.06)',
                                    cursor: cnt > 0 ? 'pointer' : 'default', fontSize: '0.8rem', fontWeight: 600,
                                    background: isSelected ? 'rgba(255,215,0,0.25)' : cnt === 0 ? 'rgba(244,67,54,0.1)' : 'rgba(76,175,80,0.1)',
                                    color: isSelected ? 'var(--gold)' : cnt === 0 ? 'var(--danger)' : 'var(--success-ink)',
                                  }}>
                                  {cnt === 0 ? '-' : cnt}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {selectedThread && (
                  <div style={{ marginBottom: 16 }}>
                    <h3 style={{ color: 'var(--gold)', margin: '0 0 10px', fontSize: '1rem' }}>
                      {selectedThread === '__sitewide__' ? 'Sitewide' : threadNameMap.get(selectedThread) ?? selectedThread.slice(0, 8)} · All ranks
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {threadViewChallenges.map(c => (
                        <ChallengeCard key={c.id} challenge={c} threadName={c.threadUuid ? threadNameMap.get(c.threadUuid) ?? null : null} />
                      ))}
                    </div>
                  </div>
                )}

                {selectedCell && (
                  <div>
                    <h3 style={{ color: RANK_COLORS[selectedCell.rank] ?? 'var(--ink-1)', margin: '0 0 10px', fontSize: '1rem', textTransform: 'capitalize' }}>
                      {selectedCell.threadUuid ? threadNameMap.get(selectedCell.threadUuid) ?? selectedCell.threadUuid.slice(0, 8) : 'Sitewide'} · {selectedCell.rank}
                    </h3>
                    {challengesLoading ? (
                      <div style={{ padding: 16, color: 'rgb(var(--ink-rgb) / 0.5)' }}>Loading…</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {challenges.map(c => (
                          <ChallengeCard key={c.id} challenge={c} threadName={c.threadUuid ? threadNameMap.get(c.threadUuid) ?? null : null} />
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16 }}>
                      <span style={{ color: 'rgb(var(--ink-rgb) / 0.35)', fontSize: '0.75rem' }}>Showing {challenges.length} of {challengesTotal}</span>
                      {hasMore && (
                        <button disabled={challengesLoadingMore} onClick={() => loadChallenges(selectedCell, challengeType, challengesOffset, true)}
                          style={{ ...btn(), opacity: challengesLoadingMore ? 0.5 : 1 }}>
                          {challengesLoadingMore ? 'Loading…' : 'Load more'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'my-progress' && username && (
          <>
            {myProgressLoading && !myProgressLoaded ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'rgb(var(--ink-rgb) / 0.5)' }}>Loading…</div>
            ) : myProfile ? (() => {
              const sitewideRow = myProfile.ranks.find(r => r.threadUuid == null) ?? null
              const threadRows = myProfile.ranks.filter(r => r.threadUuid != null).sort((a, b) => b.ggTotal - a.ggTotal)
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ ...card, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <RankIconBadge rank={sitewideRow?.rank ?? 'bronze'} division={sitewideRow?.division ?? 1} />
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'rgb(var(--ink-rgb) / 0.5)' }}>Sitewide total</div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--ink-1)' }}>{(sitewideRow?.ggTotal ?? 0).toLocaleString()} GG</div>
                        </div>
                      </div>
                      {myProjection && myProjection.dailyGgAvg > 0 && (
                        <div style={{ display: 'flex', gap: 24 }}>
                          <div>
                            <div style={{ fontSize: '0.7rem', color: 'rgb(var(--ink-rgb) / 0.5)' }}>7-day avg</div>
                            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ink-1)' }}>{myProjection.dailyGgAvg.toLocaleString()} GG/day</div>
                          </div>
                          {myProjection.targetRank && myProjection.daysToTarget != null && (
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'rgb(var(--ink-rgb) / 0.5)', textTransform: 'capitalize' }}>Next: {RANK_LABELS[myProjection.targetRank]}</div>
                              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gold)' }}>~{myProjection.daysToTarget}d</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'rgb(var(--ink-rgb) / 0.6)', fontWeight: 600 }}>By thread</div>
                  {threadRows.length === 0 ? (
                    <div style={{ color: 'rgb(var(--ink-rgb) / 0.5)', fontSize: '0.85rem' }}>No per-thread rank progress yet: start counting to get assigned challenges.</div>
                  ) : (
                    <div style={{ ...card, overflow: 'hidden' }}>
                      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={thStyle}>Thread</th>
                            <th style={thStyle}>Rank</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>GG (season total)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {threadRows.map(row => {
                            const threadInfo = threads.find(t => t.uuid === row.threadUuid)
                            return (
                              <tr key={row.id}
                                onClick={() => threadInfo && (window.location.href = `/thread/${threadInfo.name}`)}
                                style={{ cursor: threadInfo ? 'pointer' : 'default' }}>
                                <td style={{ padding: '8px 10px', borderBottom: '1px solid rgb(var(--ink-rgb) / 0.06)', color: 'var(--ink-1)', fontSize: '0.85rem' }}>
                                  {threadInfo?.title ?? row.threadUuid}
                                </td>
                                <td style={{ padding: '8px 10px', borderBottom: '1px solid rgb(var(--ink-rgb) / 0.06)' }}>
                                  <RankIconBadge rank={row.rank} division={row.division} size="mini" />
                                </td>
                                <td style={{ padding: '8px 10px', borderBottom: '1px solid rgb(var(--ink-rgb) / 0.06)', textAlign: 'right', color: 'var(--ink-1)', fontSize: '0.85rem' }}>
                                  {row.ggTotal.toLocaleString()}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })() : (
              <div style={{ color: 'rgb(var(--ink-rgb) / 0.5)', fontSize: '0.85rem' }}>No rank progress yet.</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

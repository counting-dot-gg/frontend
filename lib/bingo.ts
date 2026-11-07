import { formatOdds } from './rolls'
import { fmtNum } from './numberFormat'

export const BOARD_DIM = 5
export const BOARD_SIZE = BOARD_DIM * BOARD_DIM

export const MAX_TEAMS = 3

export type BingoStatus = 'lobby' | 'running' | 'finished'
export type BingoJoinMode = 'closed' | 'free' | 'code'

export interface BingoCounter {
  uuid: string
  id: number
  discordId: string
  name: string
  username: string
  color: string
  roles: string[]
  rainbow: number
  avatar: string
  emoji: string | null
  title: string
  xp: number
}

export interface BingoMember {
  counter: BingoCounter
  role: string
  status: string
  teamId: number
  teamName: string
  teamKey: string
  joinedAt?: number
  leftAt?: number
}

export interface BingoTeam {
  id: number
  key: string
  name: string
  locked: boolean
}

export interface BingoSquare {
  id: number
  index: number
  challengeType: string
  rank: string
  threadUuid: string | null
  threadName?: string | null
  threadTitle?: string | null
  target: number
  params: Record<string, unknown> | null
  scoreToBeat?: number
  progressValue: number
  isUnlocked: boolean
  mostRecentUnlockerUserUuid?: string
  mostRecentUnlockerTeamId?: number
  mostRecentUnlockAt?: number
}

export interface BingoGameInfo {
  id: number
  hostUserUuid: string
  status: BingoStatus
  mode: string
  rank: string
  allowJoin: boolean
  joinMode: BingoJoinMode
  joinCode: string | null
  timeLimitSeconds: number
  minTimeSeconds: number | null
  createdAt: number
  startedAt: number
  endsAt: number
  graceEndsAt: number
  finishedAt: number
  winnerUserUuid: string | null
  winnerTeamId: number | null
  winnerAt: number | null
  winnerTeamSize: number | null
  winnerUsername: string | null
  winningLines: Array<{ teamId: number; line: number[] }>
}

export interface BingoGameState {
  game: BingoGameInfo
  members: BingoMember[]
  teams: BingoTeam[]
  teamSwapMode: string
  squares: BingoSquare[]
}

export interface BingoLobbyGame {
  id: number
  host: string
  status: BingoStatus
  mode: string
  rank: string
  allowJoin: boolean
  joinMode: BingoJoinMode
  players: number
  startedAt: number
  finishedAt: number
  teamSwapMode?: string
  endsAt?: number
  graceEndsAt?: number
  winnerTeamId?: number | null
  winningLines?: Array<{ teamId: number; line: number[] }>
  members: BingoMember[]
  teams: BingoTeam[]
  squares: BingoSquare[]
}

export interface BingoLobbyData {
  activeGames: BingoLobbyGame[]
  stats: Record<string, unknown> | null
  myActiveGameId: number | null
  window?: { open: boolean; next: number | null }
}

export const TEAM_COLORS: Record<string, { fill: string; ink: string; soft: string; label: string }> = {
  wave:    { fill: '#1f8bff', ink: '#ffffff', soft: 'rgba(31,139,255,0.14)', label: 'Wave' },
  blaze:   { fill: '#f4511e', ink: '#ffffff', soft: 'rgba(244,81,30,0.14)',  label: 'Blaze' },
  radiant: { fill: '#f6b71e', ink: '#1a1206', soft: 'rgba(246,183,30,0.16)', label: 'Radiant' },
}

export const TEAM_FALLBACK_COLOR = '#aa4646'

export function teamColor(key?: string | null) {
  return TEAM_COLORS[(key || '').toLowerCase()] ?? {
    fill: TEAM_FALLBACK_COLOR, ink: '#ffffff', soft: 'rgba(170,70,70,0.14)', label: 'Team',
  }
}

export function teamColorById(teams: BingoTeam[], teamId?: number | null) {
  if (!teamId) return null
  const team = teams.find(t => t.id === teamId)
  return team ? teamColor(team.key) : null
}

export function bingoLines(): number[][] {
  const lines: number[][] = []
  for (let r = 0; r < BOARD_DIM; r++) {
    lines.push(Array.from({ length: BOARD_DIM }, (_, c) => r * BOARD_DIM + c))
  }
  for (let c = 0; c < BOARD_DIM; c++) {
    lines.push(Array.from({ length: BOARD_DIM }, (_, r) => r * BOARD_DIM + c))
  }
  lines.push(Array.from({ length: BOARD_DIM }, (_, i) => i * BOARD_DIM + i))
  lines.push(Array.from({ length: BOARD_DIM }, (_, i) => i * BOARD_DIM + (BOARD_DIM - 1 - i)))
  return lines
}

export function winningIndices(game: BingoGameInfo | null | undefined): Set<number> {
  const out = new Set<number>()
  for (const entry of game?.winningLines ?? []) {
    for (const idx of entry.line) out.add(idx)
  }
  return out
}

export function isLockout(game: { mode: string } | null | undefined): boolean {
  const mode = (game?.mode || '').toLowerCase()
  return mode === 'lockout' || mode === 'bingo-lockout'
}

export function teamScores(squares: BingoSquare[], teams: BingoTeam[], { ranked = false } = {}) {
  const counts = new Map<number, number>()
  for (const sq of squares) {
    if (!sq.isUnlocked || !sq.mostRecentUnlockerTeamId) continue
    counts.set(sq.mostRecentUnlockerTeamId, (counts.get(sq.mostRecentUnlockerTeamId) ?? 0) + 1)
  }
  const rows = teams.map(team => ({ team, score: counts.get(team.id) ?? 0, color: teamColor(team.key) }))
  return ranked ? rows.sort((a, b) => b.score - a.score) : rows
}

export function secondsLeft(game: BingoGameInfo | null | undefined, now: number): number | null {
  if (!game || game.status !== 'running') return null
  const endsAt = Number(game.endsAt)
  if (!Number.isFinite(endsAt) || endsAt <= 0) return null
  return Math.max(0, Math.round((endsAt - now) / 1000))
}

export type BoardDensity = 'mini' | 'compact' | 'large'

const SHORT_LABELS: Record<string, string> = {
  thread_counts: 'COUNTS',
  counts_in_day: 'DAILY',
  split_under_ms: 'SPLIT',
  get_under_ms: 'GET',
  gets_landed: 'GETS',
  bars_within_ms: 'BARS',
  lrwoed_score: 'lrwoed',
  number_shuffle_win: 'SHUFFLE',
  roll: 'ROLL',
  accuracy_rate: 'ACC',
  count_attempts: 'TRIES',
  thread_breadth: 'THREADS',
  bingo_complete_squares: 'SQUARES',
}

export function shortLabel(challengeType: string): string {
  return SHORT_LABELS[challengeType] ?? challengeType.replace(/_/g, ' ').slice(0, 8).toUpperCase()
}

function exact(n: number): string {
  return String(Number(n))
}

function secondsExact(raw: number): string {
  const ms = Math.round(raw)

  if (ms >= 60_000) {
    const totalMs = Math.round(ms)
    const m = Math.floor(totalMs / 60_000)
    const rest = totalMs - m * 60_000
    const secs = Math.floor(rest / 1000)
    const millis = rest % 1000
    return `${m}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
  }

  return (ms / 1000).toFixed(3)
}

const CUMULATIVE = new Set([
  'thread_counts', 'counts_in_day', 'count_attempts', 'bingo_complete_squares', 'gets_landed',
])

const TIMED = new Set(['split_under_ms', 'get_under_ms', 'bars_within_ms'])

export function squareDisplay(square: {
  challengeType: string
  target: number
  progressValue: number
  scoreToBeat?: number
  isUnlocked: boolean
  params: Record<string, any> | null
}): { big: string; threshold: string | null; label: string; exact?: string } {
  const p = square.params ?? {}
  const label = shortLabel(square.challengeType).toLowerCase()

  if (square.challengeType === 'thread_breadth') {
    const threads = Number(p.minThreads) || 1
    return {
      big: fmtNum(square.progressValue),
      threshold: square.isUnlocked ? null : `${fmtNum(square.target)}×${threads}`,
      label,
    }
  }

  if (CUMULATIVE.has(square.challengeType)) {
    return {
      big: fmtNum(square.progressValue),
      threshold: square.isUnlocked ? null : fmtNum(square.target),
      label,
    }
  }

  const hasBest = typeof square.scoreToBeat === 'number' && Number.isFinite(square.scoreToBeat)
  const best = square.scoreToBeat as number

  let big: string
  let threshold: string

  if (TIMED.has(square.challengeType)) {
    big = hasBest ? secondsExact(best) : '-'
    threshold = secondsExact(Number(p.maxMs) || 0)
  } else if (square.challengeType === 'roll') {
    const asOdds = (v: number) => formatOdds(p.direction === 'over' ? 1 - v : v)
    big = hasBest ? asOdds(best) : '-'
    threshold = asOdds(Number(p.threshold) || 0)
  } else if (square.challengeType === 'accuracy_rate') {
    const window = Number(p.windowSize) || 0

    if (hasBest && best >= 100) {
      big = window ? `100%×${window + Math.round(best - 100)}` : '100%'
    } else {
      big = hasBest ? `${exact(best)}%` : '-'
    }

    threshold = window
      ? `${exact(Number(p.minAccuracyPercent) || 0)}%×${window}`
      : `${exact(Number(p.minAccuracyPercent) || 0)}%`
  } else if (square.challengeType === 'lrwoed_score') {
    big = hasBest ? exact(best) : '-'
    threshold = exact(Number(p.maxScore) || 0)
  } else if (square.challengeType === 'number_shuffle_win') {
    big = hasBest ? exact(best) : '-'
    threshold = exact(Number(p.minSize) || 0)
  } else {
    return {
      big: fmtNum(square.progressValue),
      threshold: square.isUnlocked ? null : fmtNum(square.target),
      label,
    }
  }

  const exactHint = square.challengeType === 'roll'
    ? [
        hasBest ? `rolled ${exact(best)}` : null,
        `needs ${p.direction === 'over' ? '≥' : '≤'}${exact(Number(p.threshold) || 0)}`,
      ].filter(Boolean).join(', ')
    : undefined

  return { big, threshold: square.isUnlocked ? null : threshold, label, exact: exactHint }
}

export function squareFace(square: {
  challengeType: string
  target: number
  progressValue: number
  scoreToBeat?: number
  isUnlocked: boolean
  params: Record<string, any> | null
}): { big: string; sub: string; started: boolean } {
  const type = square.challengeType
  const p = square.params ?? {}
  const live = squareDisplay(square)
  const open = squareDisplay({ ...square, isUnlocked: false })
  const kind = type === 'accuracy_rate' ? 'ACCURACY'
    : type === 'gets_landed' && square.target === 1 ? 'GET'
    : shortLabel(type).toUpperCase()
  const started = square.isUnlocked || (live.big !== '-' && live.big !== '0')

  if (square.isUnlocked) return { big: live.big, sub: kind, started }

  let goal = open.threshold ?? fmtNum(square.target)
  if (TIMED.has(type)) goal = tidyTime(Number(p.maxMs) || 0)

  if (!started) {
    if (type === 'accuracy_rate') {
      const window = Number(p.windowSize) || 0
      return { big: `${exact(Number(p.minAccuracyPercent) || 0)}%`, sub: window ? `OF ${fmtNum(window)}` : kind, started }
    }
    if (type === 'thread_breadth') {
      return { big: fmtNum(square.target), sub: `IN ${Number(p.minThreads) || 1} THREADS`, started }
    }
    return { big: goal, sub: kind, started }
  }

  if (type === 'accuracy_rate') {
    const window = Number(p.windowSize) || 0
    const pct = `${exact(Number(p.minAccuracyPercent) || 0)}%`
    return { big: live.big, sub: window ? `${pct} × ${fmtNum(window)}` : pct, started }
  }
  const { mode } = squareThreshold(square)
  const lead = CUMULATIVE.has(type) || type === 'thread_breadth' ? 'OF' : mode === 'lower' ? 'UNDER' : 'NEED'
  return { big: live.big, sub: `${lead} ${goal.replace('×', ' ×')}`, started }
}

function tidyTime(ms: number): string {
  const v = Math.round(ms)
  if (v >= 60_000) {
    const m = Math.floor(v / 60_000)
    const rest = v - m * 60_000
    const secs = Math.floor(rest / 1000)
    const millis = rest % 1000
    const frac = millis ? `.${String(millis).padStart(3, '0').replace(/0+$/, '')}` : ''
    return `${m}:${String(secs).padStart(2, '0')}${frac}`
  }
  return `${(v / 1000).toFixed(3).replace(/\.?0+$/, '')}s`
}

export function squareThreshold(square: {
  challengeType: string
  target: number
  params: Record<string, any> | null
}): { value: number; mode: 'higher' | 'lower' } {
  const p = square.params ?? {}
  const stamped = p._scoreMode === 'higher' || p._scoreMode === 'lower' ? p._scoreMode : null

  switch (square.challengeType) {
    case 'split_under_ms':
    case 'get_under_ms':
    case 'bars_within_ms':
      return { value: Number(p.maxMs) || 0, mode: stamped ?? 'lower' }
    case 'lrwoed_score':
      return { value: Number(p.maxScore) || 0, mode: stamped ?? 'lower' }
    case 'accuracy_rate':
      return { value: Number(p.minAccuracyPercent) || 0, mode: stamped ?? 'higher' }
    case 'number_shuffle_win':
      return { value: Number(p.minSize) || 0, mode: stamped ?? 'higher' }
    case 'roll':
      return {
        value: Number(p.threshold) || 0,
        mode: stamped ?? (p.direction === 'over' ? 'higher' : 'lower'),
      }
    default:
      return { value: square.target, mode: stamped ?? 'higher' }
  }
}

export function teamProgress(
  square: {
    challengeType: string
    target: number
    params: Record<string, any> | null
    isUnlocked: boolean
    mostRecentUnlockerTeamId?: number
  },
  teams: BingoTeam[],
): Array<{ teamId: number; pct: number; score: number; color: ReturnType<typeof teamColor> }> {
  const raw = square.params?._teamScores
  if (!raw || typeof raw !== 'object') return []
  const { value: threshold, mode } = squareThreshold(square)
  if (!threshold) return []

  const best = Number(square.params?._scoreToBeat)
  const reference = square.isUnlocked && Number.isFinite(best) && best > 0 ? best : threshold

  const out: Array<{ teamId: number; pct: number; score: number; color: ReturnType<typeof teamColor> }> = []
  for (const team of teams) {
    const score = Number((raw as Record<string, unknown>)[String(team.id)])
    if (!Number.isFinite(score) || score <= 0) continue

    const ratio = mode === 'lower' ? reference / score : score / reference
    out.push({
      teamId: team.id,
      score,
      pct: Math.max(0, Math.min(100, ratio * 100)),
      color: teamColor(team.key),
    })
  }
  return out
}

export function asSeenBy<T extends { isUnlocked: boolean; progressValue: number; params: Record<string, any> | null }>(
  square: T,
  teamId: number | null,
): T {
  if (teamId == null || square.isUnlocked) return square
  const own = Number(square.params?._teamScores?.[String(teamId)])
  return { ...square, progressValue: Number.isFinite(own) && own > 0 ? own : 0 }
}

export function squareTally(square: { progressValue: number; target: number }): string {
  return `${fmtNum(Math.round(square.progressValue))}/${fmtNum(square.target)}`
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return h > 0
    ? `${h}:${mm}:${String(sec).padStart(2, '0')}`
    : `${mm}:${String(sec).padStart(2, '0')}`
}

export function squareName(index: number): string {
  return `${String.fromCharCode(65 + (index % BOARD_DIM))}${Math.floor(index / BOARD_DIM) + 1}`
}

export function squareGap(square: BingoSquare, game: { status: string; mode: string }, myTeamId: number | null): { text: string; lead: boolean } | null {
  if (game.status !== 'running' || myTeamId == null) return null
  const { value, mode } = squareThreshold(square)
  const scores = (square.params?._teamScores ?? {}) as Record<string, number>
  const mine = Number(scores[String(myTeamId)])
  const others = Object.entries(scores).filter(([k]) => Number(k) !== myTeamId).map(([, v]) => Number(v)).filter(Number.isFinite)
  const holderId = square.isUnlocked ? square.mostRecentUnlockerTeamId : null
  const timed = ['split_under_ms', 'get_under_ms', 'bars_within_ms'].includes(square.challengeType)
  const fmt = (n: number) => timed
    ? `${(n / 1000).toFixed(3)}s`
    : `${shortCount(n)}${square.challengeType === 'accuracy_rate' ? '%' : ''}`

  if (holderId === myTeamId) {
    if (game.mode === 'lockout' || !Number.isFinite(mine)) return null
    if (!others.length) return null
    const next = mode === 'higher' ? Math.max(...others) : Math.min(...others)
    const lead = mode === 'higher' ? mine - next : next - mine
    return lead > 0 ? { text: `+${fmt(lead)}`, lead: true } : null
  }
  if (holderId != null && game.mode === 'lockout') return null

  const mark = holderId != null ? Number(scores[String(holderId)]) : value
  if (mode === 'higher') {
    const need = Math.max(0, mark + (holderId != null ? 1 : 0) - (Number.isFinite(mine) ? mine : 0))
    return need > 0 ? { text: `−${fmt(need)}`, lead: false } : null
  }
  if (!Number.isFinite(mine)) return null
  const faster = mine - mark + (holderId != null ? 1 : 0)
  return faster > 0 ? { text: `−${fmt(faster)}`, lead: false } : null
}

export function shortCount(n: number): string {
  const r = Math.round(n)
  const unit = (v: number, suffix: string) => {
    const x = v < 10 ? Math.round(v * 10) / 10 : Math.round(v)
    return x >= 1000 ? null : `${x}${suffix}`
  }
  if (r < 1000) return String(r)
  return unit(r / 1000, 'k') ?? unit(r / 1e6, 'M') ?? `${Math.round(r / 1e9)}B`
}

import { fmtNum } from './numberFormat'

export type RankName = 'bronze' | 'silver' | 'gold' | 'platinum' | 'emerald' | 'diamond' | 'countmeister' | 'grandcounter' | 'peak'

export const CHALLENGE_BAR_COLOR = '#1976d2'

export const RANK_COLORS: Record<RankName, string> = {
  bronze: '#b06a3a',
  silver: '#c0c0c0',
  gold: '#d4af00',
  platinum: '#b9f2ff',
  emerald: '#5fe0a0',
  diamond: '#3a85c9',
  countmeister: '#dc143c',
  grandcounter: '#ff8c00',
  peak: '#ffb3d9',
}

export const RANK_NUMERAL_FONT =
  '"Futura", "Century Gothic", "URW Gothic", "Avenir Next", "Trebuchet MS", system-ui, sans-serif'

export const RANK_LABELS: Record<RankName, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  emerald: 'Emerald',
  diamond: 'Diamond',
  countmeister: 'Countmeister',
  grandcounter: 'Grandcounter',
  peak: 'Peak',
}

export const RANK_ORDER: RankName[] = [
  'bronze', 'silver', 'gold', 'platinum', 'emerald',
  'diamond', 'countmeister', 'grandcounter', 'peak',
]

export const RANK_GG: Record<string, number> = {
  bronze: 300, silver: 700, gold: 1400, platinum: 2500,
  emerald: 4000, diamond: 6500, countmeister: 10000, grandcounter: 16000, peak: Infinity,
}

export function divFloor(rank: string, div: 1 | 2 | 3): number {
  const t = RANK_GG[rank] ?? 300
  return isFinite(t) ? Math.floor((t / 3) * (div - 1)) : 0
}

export function divCeil(rank: string, div: 1 | 2 | 3): number {
  const t = RANK_GG[rank] ?? 300
  return isFinite(t) ? Math.floor((t / 3) * div) : Infinity
}

function cumulativeGgBeforeRank(rank: RankName): number {
  const idx = RANK_ORDER.indexOf(rank)
  let sum = 0
  for (let i = 0; i < idx; i++) sum += RANK_GG[RANK_ORDER[i]]
  return sum
}

export function cumulativeDivFloor(rank: RankName, div: 1 | 2 | 3): number {
  return cumulativeGgBeforeRank(rank) + divFloor(rank, div)
}

export const CHALLENGE_TYPE_ORDER = [
  'thread_counts', 'strict_counts', 'counts_in_day', 'time_counting', 'count_attempts',
  'gets_landed', 'assists_landed',
  'split_under_ms', 'get_under_ms', 'fast_gets', 'bars_within_ms',
  'accuracy_rate', 'thread_spread', 'roll',
  'lrwoed_days', 'lrwoed_score', 'daily_shuffle_wins', 'number_shuffle_win',
]

export function challengeTypeOrder(type: string | undefined): number {
  const i = type ? CHALLENGE_TYPE_ORDER.indexOf(type) : -1
  return i < 0 ? CHALLENGE_TYPE_ORDER.length : i
}

export type ChallengeLog = {
  id: number
  counterUuid: string
  challengeId: string
  seasonId: number | null
  context: 'rank' | 'bingo' | 'meta'
  progress: number
  target: number
  accuracyWindow: string | null
  completedAt: number | null
  ggAwarded: number
  createdAt: number
  updatedAt: number
  seenAt?: number | null
  entranceSeenAt?: number | null
  availableAt?: number | null
  type: string
  params: Record<string, any> | null
  threadUuid: string | null
  ggReward: number
  rank: RankName
  sequencePosition: number
  sequenceTotal: number
  baseReassignmentWaitMs?: number | null
  assignmentOrdinal?: number
}

export type ThreadRankRow = {
  id: number
  counterUuid: string
  threadUuid: string | null
  seasonId: number | null
  rank: RankName
  division: 1 | 2 | 3
  gg: number
  ggTotal: number
  username?: string
  name?: string
  avatar?: string
  discordId?: string
  color?: string
  threadName?: string | null
}

export type RankUpEvent = {
  id: number
  counterUuid: string
  threadUuid: string | null
  seasonId: number | null
  fromRank: RankName
  fromDivision: 1 | 2 | 3
  toRank: RankName
  toDivision: 1 | 2 | 3
  createdAt: number
  seenAt: number | null
}

export type RankUpdatedDelta = {
  threadUuid: string
  progress: ChallengeLog[]
  completions: ChallengeLog[]
  threadRank: ThreadRankRow | null
  sitewideRank: ThreadRankRow | null
  rankUpEvents: RankUpEvent[]
}

export type RankLeaderboardSocketEntry = {
  counterUuid: string
  username: string
  name: string
  avatar: string
  discordId: string
  color: string
  rank: RankName
  division: 1 | 2 | 3
  gg: number
  ggTotal: number
  threadUuid: string | null
}

export type RankLeaderboardInitialPayload = {
  threadUuid: string | null
  entries: RankLeaderboardSocketEntry[]
}

export type CounterRankProfileResponse = {
  counter: { uuid: string; username: string; name: string; avatar: string; discordId: string; color: string }
  ranks: ThreadRankRow[]
  challengeProgress: ChallengeLog[]
  recentCompletions: ChallengeLog[]
  recentCompletionsTotal: number
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

export function formatDurationPrecise(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h === 0 ? `${m}m ${pad(s)}s` : `${h}h ${pad(m)}m ${pad(s)}s`
}

export function formatClockTime(ms: number, decimals = 3): string {
  const totalSeconds = ms / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const secStr = seconds.toFixed(decimals).padStart(decimals > 0 ? 3 + decimals : 2, '0')
  return `${minutes}:${secStr}`
}

type TitleSource = { type: string; target: number; params: Record<string, any> | null }

const TITLE_FORMULAS: Partial<Record<string, (ch: TitleSource) => string>> = {
  thread_counts: (ch) => `${fmtNum(ch.target)} Counts`,
  counts_in_day: (ch) => `${fmtNum(ch.target)} Counts / Day`,
  time_counting: (ch) => `${formatDuration(ch.target)} Counting`,
  count_attempts: (ch) => `${fmtNum(ch.target)} Attempts`,
  get_under_ms: (ch) => `${formatClockTime(ch.params?.maxMs ?? 0)} Get`,
  gets_landed: (ch) => `${fmtNum(ch.target)} ${ch.target === 1 ? 'Get' : 'Gets'}`,
  split_under_ms: (ch) => `${formatClockTime(ch.params?.maxMs ?? 0)} Split`,
  bars_within_ms: (ch) => `Sub-${formatClockTime(ch.params?.maxMs ?? 0)} Bar`,
  accuracy_rate: (ch) => `${ch.params?.minAccuracyPercent ?? 0}% Accuracy`,
  roll: (ch) => ch.params?.direction === 'over' ? `Roll ≥ ${ch.params?.threshold ?? 0}` : `Roll ≤ ${ch.params?.threshold ?? 0}`,
  lrwoed_score: (ch) => `Score ≤ ${ch.params?.maxScore ?? 0}`,
  number_shuffle_win: () => 'Number Shuffle Win',
  bingo_win: () => 'Bingo!',
  bingo_complete_squares: (ch) => `${fmtNum(ch.target)} Squares`,
  strict_counts: (ch) => `${fmtNum(ch.target)} Non-Double Counts`,
  assists_landed: (ch) => `${fmtNum(ch.target)} Non-Double ${ch.target === 1 ? 'Assist' : 'Assists'}`,
  thread_spread: (ch) => `${fmtNum(ch.target)} Counts in ${ch.params?.minThreads ?? 1} Threads`,
  fast_gets: (ch) => ch.params?.distinctThreads
    ? `Speedruns in ${fmtNum(ch.target)} Threads (${ch.params?.minCountsPerSecond ?? 0} Counts/s)`
    : `${fmtNum(ch.target)} ${ch.target === 1 ? 'Speedrun' : 'Speedruns'} (${ch.params?.minCountsPerSecond ?? 0} Counts/s)`,
  lrwoed_days: (ch) => `${fmtNum(ch.target)} Daily lrwoed ${ch.target === 1 ? 'Completion' : 'Completions'}`,
  daily_shuffle_wins: (ch) => `${fmtNum(ch.target)} Daily Number Shuffle ${ch.target === 1 ? 'Win' : 'Wins'}`,
}

const TALLY_UNITS: Record<string, (ch: TitleSource) => string> = {
  strict_counts: () => 'Non-Double Counts',
  gets_landed: (ch) => (ch.target === 1 ? 'Get' : 'Gets'),
  assists_landed: (ch) => `Non-Double ${ch.target === 1 ? 'Assist' : 'Assists'}`,
  thread_spread: (ch) => `Counts in ${ch.params?.minThreads ?? 1} Threads`,
  fast_gets: (ch) => `${ch.params?.distinctThreads ? (ch.target === 1 ? 'Speedrun Thread' : 'Speedrun Threads') : (ch.target === 1 ? 'Speedrun' : 'Speedruns')} (${ch.params?.minCountsPerSecond ?? 0} Counts/s)`,
  lrwoed_days: (ch) => `Daily lrwoed ${ch.target === 1 ? 'Completion' : 'Completions'}`,
  daily_shuffle_wins: (ch) => `Daily Number Shuffle ${ch.target === 1 ? 'Win' : 'Wins'}`,
}

export function getChallengeTitle(ch: TitleSource): string {
  const formula = TITLE_FORMULAS[ch.type]
  return formula ? formula(ch) : `Target: ${fmtNum(ch.target)}`
}

const COUNT_STYLE_TYPES = new Set(['thread_counts', 'bingo_complete_squares', 'counts_in_day'])
const ATTEMPTS_STYLE_TYPES = new Set(['count_attempts'])
const SPEED_STYLE_TYPES = new Set(['split_under_ms', 'get_under_ms', 'bars_within_ms'])

export function getProgressLabel(ch: TitleSource, currentValue: number): string {
  if (ch.type === 'counts_in_day') {
    return `${fmtNum(Math.round(currentValue))} / ${fmtNum(ch.target)} Counts Today`
  }
  if (COUNT_STYLE_TYPES.has(ch.type)) {
    return `${fmtNum(Math.round(currentValue))} / ${fmtNum(ch.target)} Counts`
  }
  if (ATTEMPTS_STYLE_TYPES.has(ch.type)) {
    return `${fmtNum(Math.round(currentValue))} / ${fmtNum(ch.target)} Attempts`
  }
  const unit = TALLY_UNITS[ch.type]
  if (unit) {
    return `${fmtNum(Math.round(currentValue))} / ${fmtNum(ch.target)} ${unit(ch)}`
  }
  if (ch.type === 'time_counting') {
    return `${formatDurationPrecise(currentValue)} / ${formatDuration(ch.target)} Counting`
  }
  if (SPEED_STYLE_TYPES.has(ch.type)) {
    const verb = ch.type === 'get_under_ms' ? 'Get' : 'Split'
    const noun = ch.target > 1 ? `${verb}s` : verb
    return `${fmtNum(Math.round(currentValue))}/${fmtNum(ch.target)} ${formatClockTime(ch.params?.maxMs ?? 0)} ${noun}`
  }
  return getChallengeTitle(ch)
}

export function getCompletionSummary(ch: ChallengeLog): { main: string; sub?: string } {
  switch (ch.type) {
    case 'thread_counts': return { main: `${fmtNum(ch.target)} Counts` }
    case 'counts_in_day': return { main: `${fmtNum(ch.target)} Counts / Day` }
    case 'time_counting': return { main: `${formatDuration(ch.target)} Counting` }
    case 'get_under_ms': return { main: `${formatClockTime(ch.params?.maxMs ?? 0)} Get` }
    case 'gets_landed': return { main: `${fmtNum(ch.target)} ${ch.target === 1 ? 'Get' : 'Gets'}` }
    case 'split_under_ms': return { main: `${formatClockTime(ch.params?.maxMs ?? 0)} Split` }
    case 'bars_within_ms': return { main: `Sub-${formatClockTime(ch.params?.maxMs ?? 0)} Bar` }
    case 'roll': return { main: ch.params?.direction === 'over' ? `Roll ≥ ${ch.params?.threshold ?? 0}` : `Roll ≤ ${ch.params?.threshold ?? 0}` }
    case 'lrwoed_score': return { main: `Score ≤ ${ch.params?.maxScore ?? 0}` }
    case 'number_shuffle_win': return { main: 'Number Shuffle Win' }
    case 'thread_breadth': return { main: `${fmtNum(ch.target)} Counts in ${ch.params?.minThreads ?? 1} Threads` }
    case 'bingo_win': return { main: 'Bingo!' }
    case 'bingo_complete_squares': return { main: `${fmtNum(ch.target)} Squares` }
    case 'strict_counts':
    case 'assists_landed':
    case 'thread_spread':
    case 'fast_gets':
    case 'lrwoed_days':
    case 'daily_shuffle_wins':
      return { main: getChallengeTitle(ch) }
    case 'accuracy_rate': {
      const pct = ch.params?.minAccuracyPercent ?? 0
      return { main: `${pct}% Accuracy` }
    }
    default: return { main: `Target: ${fmtNum(ch.target)}` }
  }
}

function decodeWindow(window: string | null): { total: number; buf: Uint8Array } | null {
  if (!window) return null
  const colon = window.indexOf(':')
  if (colon === -1) return null
  const total = parseInt(window.slice(0, colon), 10)
  if (!Number.isFinite(total) || total <= 0) return null
  const b64 = window.slice(colon + 1)
  const binary = atob(b64)
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
  return { total, buf }
}

function bitAt(buf: Uint8Array, k: number): boolean {
  const byteIdx = buf.length - 1 - Math.floor(k / 8)
  const bitPos = k % 8
  return (buf[byteIdx] & (1 << bitPos)) !== 0
}

export function getAccuracyWindowStats(window: string | null, windowSize: number) {
  const decoded = decodeWindow(window)
  if (!decoded) return { total: 0, effective: 0, validCount: 0, pct: null as number | null }
  const { total, buf } = decoded
  const effective = Math.min(total, windowSize)
  let validCount = 0
  for (let k = total - effective; k < total; k++) {
    if (bitAt(buf, k)) validCount++
  }
  return {
    total, effective, validCount,
    pct: effective > 0 ? Math.round((validCount / effective) * 1000) / 10 : null as number | null,
  }
}

export function minValidForThreshold(windowSize: number, minAccuracyPercent: number): number {
  return Math.ceil((minAccuracyPercent / 100) * windowSize)
}

export type AccuracyBucket = { rangeStart: number; rangeEnd: number; valid: number; total: number }

export function getAccuracyBuckets(window: string | null, windowSize: number, maxBatches: number): AccuracyBucket[] {
  const decoded = decodeWindow(window)
  if (!decoded) return []
  const { total, buf } = decoded
  const effective = Math.min(total, windowSize)
  if (effective === 0) return []

  const batchCount = Math.min(maxBatches, effective)
  const buckets: AccuracyBucket[] = []
  for (let b = 0; b < batchCount; b++) {
    const start = Math.floor((b / batchCount) * effective)
    const end = Math.floor(((b + 1) / batchCount) * effective)
    const absoluteStart = total - effective + start
    const absoluteEnd = total - effective + end
    let valid = 0
    for (let k = absoluteStart; k < absoluteEnd; k++) {
      if (bitAt(buf, k)) valid++
    }
    buckets.push({ rangeStart: absoluteStart, rangeEnd: absoluteEnd, valid, total: end - start })
  }
  return buckets
}

export function drillAccuracyBucket(window: string | null, rangeStart: number, rangeEnd: number, maxBatches: number): AccuracyBucket[] {
  const decoded = decodeWindow(window)
  if (!decoded) return []
  const { buf } = decoded
  const span = rangeEnd - rangeStart
  if (span <= 1) return []
  const batchCount = Math.min(maxBatches, span)
  const buckets: AccuracyBucket[] = []
  for (let b = 0; b < batchCount; b++) {
    const start = Math.floor((b / batchCount) * span)
    const end = Math.floor(((b + 1) / batchCount) * span)
    let valid = 0
    for (let k = rangeStart + start; k < rangeStart + end; k++) {
      if (bitAt(buf, k)) valid++
    }
    buckets.push({ rangeStart: rangeStart + start, rangeEnd: rangeStart + end, valid, total: end - start })
  }
  return buckets
}

export function getBatchColorSignal(valid: number, total: number, minAccuracyPercent: number): { side: 'good' | 'bad'; opacity: number } {
  if (total === 0) return { side: 'bad', opacity: 0 }
  const pct = valid / total
  const threshold = minAccuracyPercent / 100
  const diff = Math.abs(pct - threshold)
  const opacity = Math.min(1, diff * 4)
  return { side: pct >= threshold ? 'good' : 'bad', opacity }
}

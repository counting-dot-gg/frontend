import type { RankChallenge } from './challengeTypes'
import { RANK_OPTIONS } from './challengeTypes'
import type { RankName } from './rankUtils'

export const DEFAULT_TIER_TARGET = 1
export const DEFAULT_TIER_GG = 20
export const BULK_SEQUENCES_PER_RANK = 3

export const MS_PER_HOUR = 3_600_000

export const MAXMS_TYPES = new Set(['split_under_ms', 'get_under_ms', 'bars_within_ms'])

export const DEFAULT_WAIT_HOURS_BY_TYPE: Record<string, string> = {
  split_under_ms: '24',
  get_under_ms: '24',
}

export interface ChallengeFormState {
  type: string
  rank: RankName | ''
  sequence: number
  target: number
  ggReward: number
  rewardType: 'gg' | 'auto_jump'
  threadUuid: string
  params: string
  baseReassignmentWaitHours: string
}

export const emptyForm = (): ChallengeFormState => ({
  type: '',
  rank: '',
  sequence: 0,
  target: DEFAULT_TIER_TARGET,
  ggReward: DEFAULT_TIER_GG,
  rewardType: 'gg',
  threadUuid: '',
  params: '',
  baseReassignmentWaitHours: '',
})

export const challengeToForm = (c: RankChallenge): ChallengeFormState => ({
  type: c.type ?? '',
  rank: c.rank ?? '',
  sequence: c.sequence ?? 0,
  target: c.target ?? 0,
  ggReward: c.ggReward ?? 0,
  rewardType: c.rewardType ?? 'gg',
  threadUuid: c.threadUuid ?? '',
  params: c.params ? JSON.stringify(c.params, null, 2) : '',
  baseReassignmentWaitHours:
    c.baseReassignmentWaitMs != null ? String(c.baseReassignmentWaitMs / MS_PER_HOUR) : '',
})

export interface BulkTierRow {
  existingId: string | null
  rank: RankName | ''
  sequence: number
  target: number
  ggReward: number
  params: string
}

export const defaultBulkRows = (seedParams = ''): BulkTierRow[] => {
  const rows: BulkTierRow[] = []
  for (const rank of RANK_OPTIONS) {
    for (let sequence = 0; sequence < BULK_SEQUENCES_PER_RANK; sequence++) {
      rows.push({
        existingId: null,
        rank,
        sequence,
        target: DEFAULT_TIER_TARGET,
        ggReward: DEFAULT_TIER_GG,
        params: seedParams,
      })
    }
  }
  return rows
}

export const reconcileBulkRows = (existing: RankChallenge[], seedParams = ''): BulkTierRow[] => {
  const rows = defaultBulkRows(seedParams)
  const matched = new Set<string>()

  for (const row of rows) {
    const match = existing.find(c => c.rank === row.rank && c.sequence === row.sequence)
    if (!match) continue
    row.existingId = match.id
    row.target = match.target
    row.ggReward = match.ggReward
    row.params = match.params ? JSON.stringify(match.params, null, 2) : ''
    matched.add(match.id)
  }

  const extras = existing
    .filter(c => !matched.has(c.id))
    .sort((a, b) => RANK_OPTIONS.indexOf(a.rank) - RANK_OPTIONS.indexOf(b.rank) || a.sequence - b.sequence)
    .map(c => ({
      existingId: c.id,
      rank: c.rank,
      sequence: c.sequence,
      target: c.target,
      ggReward: c.ggReward,
      params: c.params ? JSON.stringify(c.params, null, 2) : '',
    }))

  return [...rows, ...extras]
}

export type ParamFieldSchema = {
  key: string
  label: string
  kind: 'number' | 'text' | 'stringList' | 'select'
  defaultValue: number | string | string[]
  options?: string[]
}

export const PARAM_FIELD_SCHEMAS: Record<string, ParamFieldSchema[]> = {
  accuracy_rate: [
    { key: 'windowSize', label: 'Window Size (counts)', kind: 'number', defaultValue: 200 },
    { key: 'minAccuracyPercent', label: 'Min Accuracy %', kind: 'number', defaultValue: 95 },
  ],
  split_under_ms: [{ key: 'maxMs', label: 'Max Ms', kind: 'number', defaultValue: 5000 }],
  get_under_ms: [{ key: 'maxMs', label: 'Max Ms', kind: 'number', defaultValue: 5000 }],
  bars_within_ms: [{ key: 'maxMs', label: 'Max Ms (per bar)', kind: 'number', defaultValue: 500 }],
  lrwoed_score: [{ key: 'maxScore', label: 'Max Score (lower is better)', kind: 'number', defaultValue: 10 }],
  number_shuffle_win: [{ key: 'minSize', label: 'Min Size', kind: 'number', defaultValue: 5 }],
  roll: [
    { key: 'direction', label: 'Direction', kind: 'select', options: ['under', 'over'], defaultValue: 'under' },
    { key: 'threshold', label: 'Threshold', kind: 'number', defaultValue: 10 },
  ],
  thread_breadth: [{ key: 'minThreads', label: 'Min Threads', kind: 'number', defaultValue: 5 }],
}

export function chainKey(c: Pick<RankChallenge, 'type' | 'threadUuid' | 'params'>): string {
  switch (c.type) {
    case 'thread_counts':
    case 'counts_in_day':
    case 'count_attempts':
    case 'time_counting':
      return `${c.type}:${c.threadUuid ?? 'sitewide'}`
    case 'accuracy_rate':
    case 'split_under_ms':
    case 'get_under_ms':
    case 'bars_within_ms':
      return `${c.type}:${c.threadUuid ?? 'sitewide'}:${c.params?.validationType ?? ''}`
    case 'roll':
      return `${c.type}:${c.params?.direction ?? ''}:${c.params?.validationType ?? ''}`
    case 'lrwoed_score':
    case 'number_shuffle_win':
      return `${c.type}:${c.params?.validationType ?? ''}`
    default:
      return c.type
  }
}

export function sequenceIssues(sorted: RankChallenge[]): string[] {
  const issues: string[] = []
  const seqs = sorted.map(c => c.sequence ?? 0)

  const counts = new Map<number, number>()
  for (const s of seqs) counts.set(s, (counts.get(s) ?? 0) + 1)
  for (const [seq, n] of counts) {
    if (n > 1) issues.push(`sequence ${seq} is used by ${n} challenges`)
  }
  for (let i = 0; i < seqs.length - 1; i++) {
    if (seqs[i + 1] - seqs[i] > 1) issues.push(`gap between sequence ${seqs[i]} and ${seqs[i + 1]}`)
  }
  return issues
}

export function parseParams(raw: string): object | null | undefined {
  if (!raw.trim()) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function parseWaitMs(hours: string): number | null {
  const h = parseFloat(hours)
  if (!hours.trim() || isNaN(h) || h <= 0) return null
  return Math.round(h * MS_PER_HOUR)
}

const requiresMaxMs = (form: ChallengeFormState, params: object | undefined) =>
  MAXMS_TYPES.has(form.type) && !(params as { maxMs?: number } | undefined)?.maxMs

export function buildCreateDto(form: ChallengeFormState): object | null {
  const params = parseParams(form.params)
  if (params === null) return null
  if (requiresMaxMs(form, params)) return null
  return {
    type: form.type,
    rank: form.rank || undefined,
    sequence: form.sequence,
    target: form.target,
    ggReward: form.ggReward,
    rewardType: form.rewardType,
    threadUuid: form.threadUuid || undefined,
    params: params ?? undefined,
    baseReassignmentWaitMs: parseWaitMs(form.baseReassignmentWaitHours),
  }
}

export function buildUpdateDto(form: ChallengeFormState): object | null {
  const params = parseParams(form.params)
  if (params === null) return null
  if (requiresMaxMs(form, params)) return null
  return {
    rank: form.rank || undefined,
    sequence: form.sequence,
    target: form.target,
    ggReward: form.ggReward,
    rewardType: form.rewardType,
    threadUuid: form.threadUuid || undefined,
    params: params ?? undefined,
    baseReassignmentWaitMs: parseWaitMs(form.baseReassignmentWaitHours),
  }
}

export function dtoError(form: ChallengeFormState): string {
  return parseParams(form.params) === null
    ? 'Invalid JSON in params field'
    : 'maxMs is required for this challenge type'
}

import { CHALLENGE_TYPES, RANK_OPTIONS, SITEWIDE_ONLY_TYPES, THREAD_REQUIRED_TYPES, type RankChallenge } from './challengeTypes'
import { chainKey, MAXMS_TYPES } from './rankAdmin'
import type { RankName } from './rankUtils'

export const IMPORT_FORMAT = 'countgg-rank-challenges'
export const IMPORT_VERSION = 1

export interface ImportRow {
  type: string
  rank: RankName
  sequence: number
  ggReward: number
  target: number
  rewardType: 'gg' | 'auto_jump'
  threadUuid: string | null
  threadName?: string
  params?: Record<string, unknown>
  baseReassignmentWaitMs: number | null
}

export type PlanAction = 'create' | 'update' | 'unchanged'

export interface PlannedRow {
  row: ImportRow
  action: PlanAction
  existingId: string | null
  changes: string[]
  errors: string[]
}

export interface ImportPlan {
  rows: PlannedRow[]
  errors: string[]
  warnings: string[]
  orphans: RankChallenge[]
  counts: Record<PlanAction, number>
}

export interface ThreadRef {
  uuid: string
  name: string
}

type ParseResult = { rows: ImportRow[]; notes: string[] } | { error: string }

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const asNumber = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}

export function parseImport(raw: string): ParseResult {
  if (!raw.trim()) return { error: 'Nothing pasted yet.' }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    return { error: `Not valid JSON: ${err instanceof Error ? err.message : 'parse failed'}` }
  }

  let list: unknown
  const notes: string[] = []

  if (Array.isArray(parsed)) {
    list = parsed
  } else if (isObject(parsed)) {
    if (parsed.format !== undefined && parsed.format !== IMPORT_FORMAT) {
      return { error: `Unrecognised format "${String(parsed.format)}" — expected "${IMPORT_FORMAT}".` }
    }
    const version = asNumber(parsed.version)
    if (version != null && version > IMPORT_VERSION) {
      return { error: `This blob is version ${version}; this page understands up to ${IMPORT_VERSION}.` }
    }
    if (Array.isArray(parsed.notes)) {
      notes.push(...parsed.notes.filter((n): n is string => typeof n === 'string'))
    }
    list = parsed.challenges
  } else {
    return { error: 'Expected an object with a "challenges" array, or a bare array of challenges.' }
  }

  if (!Array.isArray(list)) return { error: 'No "challenges" array found.' }
  if (list.length === 0) return { error: 'The blob contains no challenges.' }

  const rows: ImportRow[] = []
  for (const raw of list) {
    if (!isObject(raw)) return { error: 'Every entry in "challenges" must be an object.' }
    rows.push({
      type: String(raw.type ?? ''),
      rank: String(raw.rank ?? '') as RankName,
      sequence: asNumber(raw.sequence) ?? 0,
      ggReward: asNumber(raw.ggReward) ?? 0,
      target: asNumber(raw.target) ?? 0,
      rewardType: raw.rewardType === 'auto_jump' ? 'auto_jump' : 'gg',
      threadUuid: typeof raw.threadUuid === 'string' && raw.threadUuid ? raw.threadUuid : null,
      threadName: typeof raw.thread === 'string' ? raw.thread : undefined,
      params: isObject(raw.params) ? raw.params : undefined,
      baseReassignmentWaitMs: asNumber(raw.baseReassignmentWaitMs),
    })
  }
  return { rows, notes }
}

const sortKeys = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(sortKeys)
  if (isObject(v)) {
    return Object.fromEntries(
      Object.keys(v).sort().map(k => [k, sortKeys((v as Record<string, unknown>)[k])]),
    )
  }
  return v
}

const sameParams = (a: unknown, b: unknown): boolean => {
  const norm = (v: unknown) => (v == null || (isObject(v) && Object.keys(v).length === 0) ? null : v)
  return JSON.stringify(sortKeys(norm(a))) === JSON.stringify(sortKeys(norm(b)))
}

function resolveThread(
  row: ImportRow,
  threads: ThreadRef[],
): { uuid: string | null; error?: string } {
  const byUuid = row.threadUuid ? threads.find(t => t.uuid === row.threadUuid) : undefined
  const byName = row.threadName ? threads.find(t => t.name === row.threadName) : undefined

  if (row.threadUuid) {
    if (!byUuid) return { uuid: null, error: `threadUuid ${row.threadUuid.slice(0, 8)}… is not a thread here` }
    if (row.threadName && byUuid.name !== row.threadName) {
      return {
        uuid: null,
        error: `threadUuid is "${byUuid.name}" but the blob calls it "${row.threadName}" — generated against a different database?`,
      }
    }
    return { uuid: byUuid.uuid }
  }

  if (row.threadName) {
    if (!byName) return { uuid: null, error: `no thread named "${row.threadName}"` }
    return { uuid: byName.uuid }
  }

  return { uuid: null }
}

function describeChange(field: string, from: unknown, to: unknown): string {
  const show = (v: unknown) =>
    v == null ? 'none' : typeof v === 'object' ? JSON.stringify(v) : String(v)
  return `${field} ${show(from)} → ${show(to)}`
}

function sequenceProblems(
  planned: PlannedRow[],
  existing: RankChallenge[],
): string[] {
  const replacedIds = new Set(planned.map(p => p.existingId).filter(Boolean) as string[])
  const combos = new Map<string, { seq: number; label: string }[]>()

  const add = (type: string, rank: string, key: string, seq: number, label: string) => {
    const k = `${type}|${rank}|${key}`
    const list = combos.get(k) ?? []
    list.push({ seq, label })
    combos.set(k, list)
  }

  for (const p of planned) {
    if (p.errors.length > 0) continue
    add(p.row.type, p.row.rank, chainKey({
      type: p.row.type,
      threadUuid: p.row.threadUuid,
      params: p.row.params ?? null,
    } as Pick<RankChallenge, 'type' | 'threadUuid' | 'params'>), p.row.sequence, 'import')
  }
  for (const c of existing) {
    if (replacedIds.has(c.id)) continue
    add(c.type, c.rank, chainKey(c), c.sequence, 'existing')
  }

  const problems: string[] = []
  for (const [key, entries] of combos) {
    const [type, rank] = key.split('|')
    const seqs = entries.map(e => e.seq).sort((a, b) => a - b)

    const seen = new Set<number>()
    for (const s of seqs) {
      if (seen.has(s)) {
        problems.push(`${type} / ${rank}: sequence ${s} is used twice — the API requires them unique within a chain`)
        break
      }
      seen.add(s)
    }
    for (let i = 0; i < seqs.length; i++) {
      if (seqs[i] !== i) {
        problems.push(
          `${type} / ${rank}: sequences must be contiguous from 0, but the result would be ${seqs.join(', ')}`,
        )
        break
      }
    }
  }
  return problems
}

export function planImport(
  rows: ImportRow[],
  existing: RankChallenge[],
  threads: ThreadRef[],
): ImportPlan {
  const planned: PlannedRow[] = []
  const warnings: string[] = []
  const matchedIds = new Set<string>()

  for (const raw of rows) {
    const errors: string[] = []

    if (!CHALLENGE_TYPES.includes(raw.type)) errors.push(`unknown type "${raw.type}"`)
    if (!RANK_OPTIONS.includes(raw.rank)) errors.push(`unknown rank "${raw.rank}"`)
    if (!Number.isInteger(raw.sequence) || raw.sequence < 0) errors.push('sequence must be a whole number ≥ 0')
    if (!Number.isInteger(raw.target) || raw.target < 1) errors.push('target must be a whole number ≥ 1')
    if (!Number.isInteger(raw.ggReward) || raw.ggReward < 0) errors.push('ggReward must be a whole number ≥ 0')

    const { uuid, error: threadError } = resolveThread(raw, threads)
    if (threadError) errors.push(threadError)
    if (!uuid && !threadError && THREAD_REQUIRED_TYPES.has(raw.type)) {
      errors.push(`${raw.type} cannot be sitewide — it needs a thread`)
    }

    if (MAXMS_TYPES.has(raw.type) && asNumber(raw.params?.maxMs) == null) {
      errors.push('maxMs is required in params for this type')
    }
    if (SITEWIDE_ONLY_TYPES.has(raw.type) && uuid) errors.push(`${raw.type} is sitewide — it cannot have a thread`)
    if (raw.type === 'thread_breadth' || raw.type === 'thread_spread') {
      const n = asNumber(raw.params?.minThreads)
      if (n == null || !Number.isInteger(n) || n < 1) errors.push('minThreads (a whole number ≥ 1) is required in params')
    }
    if (raw.type === 'fast_gets') {
      const r = asNumber(raw.params?.minCountsPerSecond)
      if (r == null || r <= 0) errors.push('minCountsPerSecond (a rate > 0) is required in params')
    }
    if (raw.type === 'accuracy_rate') {
      if (asNumber(raw.params?.windowSize) == null || asNumber(raw.params?.minAccuracyPercent) == null) {
        warnings.push(
          `accuracy_rate ${raw.rank} seq ${raw.sequence} has no windowSize/minAccuracyPercent; the backend will default to 20 attempts at 100%`,
        )
      }
    }

    const row: ImportRow = { ...raw, threadUuid: uuid }

    const match = existing.find(
      c =>
        !matchedIds.has(c.id) &&
        c.type === row.type &&
        c.rank === row.rank &&
        c.sequence === row.sequence &&
        (c.threadUuid ?? null) === row.threadUuid &&
        chainKey(c) ===
          chainKey({ type: row.type, threadUuid: row.threadUuid, params: row.params ?? null } as Pick<
            RankChallenge,
            'type' | 'threadUuid' | 'params'
          >),
    )

    const changes: string[] = []
    if (match) {
      matchedIds.add(match.id)
      if (match.target !== row.target) changes.push(describeChange('target', match.target, row.target))
      if (match.ggReward !== row.ggReward) changes.push(describeChange('gg', match.ggReward, row.ggReward))
      if (match.rewardType !== row.rewardType) {
        changes.push(describeChange('rewardType', match.rewardType, row.rewardType))
      }
      if (!sameParams(match.params, row.params)) {
        changes.push(describeChange('params', match.params, row.params ?? null))
      }
      const waitOf = (v: unknown): number | null => {
        if (v == null || v === '') return null
        const n = Number(v)
        return Number.isFinite(n) ? n : null
      }
      if (waitOf(match.baseReassignmentWaitMs) !== waitOf(row.baseReassignmentWaitMs)) {
        changes.push(describeChange('wait', match.baseReassignmentWaitMs, row.baseReassignmentWaitMs))
      }
    }

    planned.push({
      row,
      action: match ? (changes.length > 0 ? 'update' : 'unchanged') : 'create',
      existingId: match?.id ?? null,
      changes,
      errors,
    })
  }

  const errors = planned.flatMap(p =>
    p.errors.map(e => `${p.row.type} / ${p.row.rank} seq ${p.row.sequence}: ${e}`),
  )
  errors.push(...sequenceProblems(planned, existing))

  const orphans = existing.filter(c => !matchedIds.has(c.id))

  const counts: Record<PlanAction, number> = { create: 0, update: 0, unchanged: 0 }
  for (const p of planned) {
    if (p.errors.length === 0) counts[p.action]++
  }

  return { rows: planned, errors, warnings, orphans, counts }
}

export function toCreateDto(row: ImportRow): object {
  return {
    type: row.type,
    rank: row.rank,
    sequence: row.sequence,
    target: row.target,
    ggReward: row.ggReward,
    rewardType: row.rewardType,
    threadUuid: row.threadUuid ?? undefined,
    params: row.params,
    baseReassignmentWaitMs: row.baseReassignmentWaitMs,
  }
}

export function toUpdateDto(row: ImportRow): object {
  return {
    rank: row.rank,
    sequence: row.sequence,
    target: row.target,
    ggReward: row.ggReward,
    rewardType: row.rewardType,
    threadUuid: row.threadUuid ?? undefined,
    params: row.params ?? null,
    baseReassignmentWaitMs: row.baseReassignmentWaitMs,
  }
}

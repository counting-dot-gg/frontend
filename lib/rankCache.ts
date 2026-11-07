import { API } from '@/lib/apiBase'
import type { ChallengeLog, RankName } from '@/lib/rankUtils'

export type Template = {
  id: string
  type: string
  rank: RankName
  sequence: number
  target: number
  ggReward: number
  params: Record<string, any> | null
  threadUuid: string | null
}

export type RankUp = { toRank: RankName; toDivision: number; createdAt: number }
export type RankUps = { startedAt: number | null; events: RankUp[] }

function memo<T>() {
  const pending = new Map<string, Promise<T>>()
  const ready = new Map<string, T>()
  return {
    get(key: string, fetcher: () => Promise<T>, ttlMs?: number): Promise<T> {
      let p = pending.get(key)
      if (!p) {
        p = fetcher().then(v => { ready.set(key, v); return v })
        pending.set(key, p)
        if (ttlMs) setTimeout(() => { pending.delete(key); ready.delete(key) }, ttlMs)
      }
      return p
    },
    peek: (key: string) => ready.get(key),
  }
}

const json = (url: string) => fetch(url, { credentials: 'include' }).then(r => (r.ok ? r.json() : null)).catch(() => null)

const templates = memo<Template[]>()
const scopeKey = (scope: string | null, seasonId?: number | null) => `${seasonId ?? ''}|${scope ?? 'sitewide'}`

export function loadScope(scope: string | null, seasonId?: number | null): Promise<Template[]> {
  return templates.get(scopeKey(scope, seasonId), () => {
    const q = new URLSearchParams({ limit: '5000' })
    if (seasonId != null) q.set('seasonId', String(seasonId))
    if (scope) q.set('threadUuid', scope)
    else q.set('sitewideOnly', 'true')
    return json(`${API}/api/rank/challenges?${q}`).then(d => (d?.items ?? []) as Template[])
  })
}

export const peekScope = (scope: string | null, seasonId?: number | null) => templates.peek(scopeKey(scope, seasonId))

const rankUps = memo<RankUps>()
const upsKey = (username: string, scope: string | null, seasonId?: number | null) => `${username}|${seasonId ?? ''}|${scope ?? 'sitewide'}`

export function loadRankUps(username: string, scope: string | null, seasonId?: number | null): Promise<RankUps> {
  return rankUps.get(upsKey(username, scope, seasonId), () => {
    const q = new URLSearchParams({ scope: scope ?? 'sitewide' })
    if (seasonId != null) q.set('seasonId', String(seasonId))
    return json(`${API}/api/rank/rankups/${encodeURIComponent(username)}?${q}`)
      .then(d => ({ startedAt: d?.startedAt ?? null, events: Array.isArray(d?.events) ? d.events : [] }))
  }, 60_000)
}

export const peekRankUps = (username: string, scope: string | null, seasonId?: number | null) => rankUps.peek(upsKey(username, scope, seasonId))

const progress = memo<ChallengeLog[]>()

export function loadProgress(username: string): Promise<ChallengeLog[]> {
  return progress.get(username, () =>
    json(`${API}/api/rank/counter/${encodeURIComponent(username)}?completionsLimit=1`)
      .then(d => (d?.challengeProgress ?? []) as ChallengeLog[]), 30_000)
}

export const peekProgress = (username: string) => progress.peek(username)

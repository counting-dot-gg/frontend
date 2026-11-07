import type { RankChallenge, RankSeason } from './challengeTypes'

import { API } from '@/lib/apiBase'

const RANK_URL = `${API}/api/rank`

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${RANK_URL}${path}`, {
    credentials: 'include',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  })
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.message) message = Array.isArray(body.message) ? body.message.join(', ') : body.message
    } catch {
    }
    throw new Error(message)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export interface ChallengeQuery {
  rank?: string
  type?: string
  threadUuid?: string
  sitewideOnly?: boolean
  seasonId?: number
  context?: boolean
  limit?: number
  offset?: number
}

export function getRankChallenges(params: ChallengeQuery = {}) {
  const q = new URLSearchParams()
  if (params.rank) q.set('rank', params.rank)
  if (params.type) q.set('type', params.type)
  if (params.threadUuid) q.set('threadUuid', params.threadUuid)
  if (params.sitewideOnly) q.set('sitewideOnly', 'true')
  if (params.seasonId != null) q.set('seasonId', String(params.seasonId))
  if (params.context) q.set('context', 'true')
  if (params.limit != null) q.set('limit', String(params.limit))
  if (params.offset != null) q.set('offset', String(params.offset))
  const qs = q.toString()
  return request<{ total: number; items: RankChallenge[] }>(`/challenges${qs ? `?${qs}` : ''}`)
}

export const getRankSeasons = () => request<RankSeason[]>('/seasons')

export const adminCreateChallenge = (dto: object) =>
  request('/admin/challenges', { method: 'POST', body: JSON.stringify(dto) })

export const adminCreateChallengeBatch = (dtos: object[]) =>
  request('/admin/challenges/batch', { method: 'POST', body: JSON.stringify(dtos) })

export const adminUpdateChallengeBatch = (updates: { id: string; dto: object }[]) =>
  request('/admin/challenges/batch', { method: 'PATCH', body: JSON.stringify(updates) })

export const adminUpdateChallenge = (id: string, dto: object) =>
  request(`/admin/challenges/${id}`, { method: 'PATCH', body: JSON.stringify(dto) })

export const adminDeleteChallenge = (id: string) =>
  request(`/admin/challenges/${id}`, { method: 'DELETE' })

export const adminStartSeason = (name: string) =>
  request('/admin/season/start', { method: 'POST', body: JSON.stringify({ name }) })

export const adminEndSeason = () =>
  request('/admin/season/end', { method: 'POST', body: JSON.stringify({}) })

import { chainKey } from './rankAdmin'
import { RANK_GG, RANK_ORDER, type RankName } from './rankUtils'
import type { RankChallenge } from './challengeTypes'

export interface RankCoverage {
  rank: RankName
  challenges: RankChallenge[]
  chains: number
  ggOnePass: number
  ggToRankUp: number
  ggCoverage: number
  types: string[]
  longestChain: number
}

export function forThread(challenges: RankChallenge[], uuid: string | null): RankChallenge[] {
  return challenges.filter(c => (c.threadUuid ?? null) === uuid)
}

export function coverageByRank(challenges: RankChallenge[]): RankCoverage[] {
  return RANK_ORDER.map(rank => {
    const at = challenges
      .filter(c => c.rank === rank)
      .sort((a, b) => a.type.localeCompare(b.type) || a.sequence - b.sequence)

    const chains = new Map<string, number>()
    for (const c of at) {
      const k = `${c.type}|${chainKey(c)}`
      chains.set(k, (chains.get(k) ?? 0) + 1)
    }

    return {
      rank,
      challenges: at,
      chains: chains.size,
      ggOnePass: at.reduce((sum, c) => sum + (c.ggReward ?? 0), 0),
      ggToRankUp: RANK_GG[rank] ?? 0,
      ggCoverage: (() => {
        const cost = RANK_GG[rank] ?? 0
        return isFinite(cost) && cost > 0
          ? at.reduce((sum, c) => sum + (c.ggReward ?? 0), 0) / cost
          : 1
      })(),
      types: [...new Set(at.map(c => c.type))].sort(),
      longestChain: chains.size === 0 ? 0 : Math.max(...chains.values()),
    }
  })
}

export const UNDERFUNDED_RATIO = 0.6

export function underfundedRanks(rows: RankCoverage[]): RankCoverage[] {
  return rows.filter(
    r => r.challenges.length > 0
      && isFinite(r.ggToRankUp)
      && r.ggCoverage < UNDERFUNDED_RATIO,
  )
}

export function emptyRanks(rows: RankCoverage[]): RankCoverage[] {
  return rows.filter(r => r.challenges.length === 0 && r.rank !== 'peak')
}

export function busiestThread(challenges: RankChallenge[]): string | null {
  const counts = new Map<string | null, number>()
  for (const c of challenges) {
    const k = c.threadUuid ?? null
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  let best: string | null = null
  let bestN = 0
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k
      bestN = n
    }
  }
  return best
}

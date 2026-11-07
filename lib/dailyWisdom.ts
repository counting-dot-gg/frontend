import manifest from './dailyWisdomManifest.json'
import type { WisdomShape } from './dailyWisdomShared'

export interface DailyWisdom {
  file: string
  author: string | null
  permalink: string
  title: string
  nsfw: boolean
  w: number
  h: number
}

const WISDOMS = manifest as DailyWisdom[]

export const WISDOM_COUNT = WISDOMS.length

function dayNumber(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number)
  if (!y || !m || !d) return 0
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dealOrder(cycle: number): number[] {
  const order = WISDOMS.map((_, i) => i)
  const rand = mulberry32(cycle * 2654435761 + 12345)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

export function wisdomForDay(dayKey: string): DailyWisdom | null {
  if (WISDOMS.length === 0) return null
  const day = dayNumber(dayKey)
  const cycle = Math.floor(day / WISDOMS.length)
  const position = ((day % WISDOMS.length) + WISDOMS.length) % WISDOMS.length
  return WISDOMS[dealOrder(cycle)[position]]
}

export function wisdomCredit(f: DailyWisdom): string {
  return f.author ? `u/${f.author}` : 'r/lona_irl'
}

export type { WisdomShape }

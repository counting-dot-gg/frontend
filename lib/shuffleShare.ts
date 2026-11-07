export interface ShuffleResult {
  score: number
  size: number
  seed: string
}

export function encodeShuffleResult(r: ShuffleResult): string {
  return `${r.score}.${r.size}.${r.seed}`
}

export function decodeShuffleResult(raw: string | undefined | null): ShuffleResult | null {
  if (!raw) return null
  const first = raw.indexOf('.')
  const second = raw.indexOf('.', first + 1)
  if (first < 1 || second < 0) return null

  const score = Number(raw.slice(0, first))
  const size = Number(raw.slice(first + 1, second))
  const seed = raw.slice(second + 1)

  if (!Number.isInteger(score) || !Number.isInteger(size)) return null
  if (size < 1 || size > 500) return null
  if (score < 0 || score > size) return null
  if (!seed || seed.length > 64) return null

  return { score, size, seed }
}

export function isPerfect(r: ShuffleResult): boolean {
  return r.score === r.size
}

export function describeShuffleResult(r: ShuffleResult): string {
  return isPerfect(r)
    ? `Perfect game: all ${r.size} numbers placed.`
    : `Placed ${r.score} of ${r.size} numbers in order.`
}

export const safeProbability = (v: number) => (!Number.isFinite(v) || v <= 0 ? 0 : v)

export function formatOdds(probability: number): string {
  const p = safeProbability(probability)
  if (p <= 0) return '?'
  if (p >= 1) return '1 in 1'
  if (p > 0.5) {
    const num = Math.max(1, Math.round(p / (1 - p)))
    return `${num.toLocaleString()} in ${(num + 1).toLocaleString()}`
  }
  const oneIn = 1 / p
  if (!Number.isFinite(oneIn)) return '?'
  return `1 in ${Math.max(1, Math.round(oneIn)).toLocaleString()}`
}

export function rarity(probability: number): number {
  const p = safeProbability(probability)
  if (p <= 0) return 1
  if (p >= 0.5) return 0
  const decades = -Math.log10(p)
  return Math.max(0, Math.min(1, (decades - 0.3) / (9 - 0.3)))
}

export function rarityColor(probability: number): string {
  const r = rarity(probability)
  const stops: Array<[number, [number, number, number]]> = [
    [0.00, [100, 116, 139]],
    [0.35, [59, 130, 246]],
    [0.60, [139, 92, 246]],
    [0.80, [245, 158, 11]],
    [1.00, [239, 68, 68]],
  ]
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i]
    const [t1, c1] = stops[i + 1]
    if (r <= t1) {
      const t = t1 === t0 ? 0 : (r - t0) / (t1 - t0)
      const mix = c0.map((c, j) => Math.round(c + (c1[j] - c) * t))
      return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`
    }
  }
  return 'rgb(239, 68, 68)'
}

export const NOTABLE_ODDS = 100

export function formatRoll(value: number): string {
  if (!Number.isFinite(value)) return '?'
  if (value <= 0) return '0'
  if (value < 1e-9) return value.toExponential(3)
  return value.toFixed(10).replace(/0+$/, '').replace(/\.$/, '')
}

export function logPosition(probability: number, minDecade: number): number {
  const p = safeProbability(probability)
  if (p >= 1) return 1
  if (p <= 0) return 0
  const min = Math.min(-1, minDecade)
  return Math.max(0, Math.min(1, (Math.log10(p) - min) / (0 - min)))
}

export function rollTrackDecade(roll: number, chance: number): number {
  const rarest = Math.min(safeProbability(roll) || 1, safeProbability(chance) || 1)
  const decade = rarest > 0 ? Math.floor(Math.log10(rarest)) - 1 : -6
  return Math.max(-12, Math.min(-1, decade))
}

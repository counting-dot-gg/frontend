export type AchievementType = {
  id: number
  name: string
  icon?: string
  isPublic: boolean
  description: string
  countersEarned: number
  maxProgress: number
}

export type CounterAchievementType = {
  id: number
  counterUUID: string
  achievementId: number
  progress: number
  isComplete: boolean
  timestamp: string
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export function buildRarityFn(achievements: AchievementType[]): (countersEarned: number) => Rarity {
  if (achievements.length === 0) return () => 'legendary'
  const sorted = [...achievements].map(a => a.countersEarned).sort((a, b) => a - b)
  const pct = (p: number) => sorted[Math.max(0, Math.floor(sorted.length * p) - 1)]
  const t4 = pct(0.90)
  const t3 = pct(0.70)
  const t2 = pct(0.40)
  const t1 = pct(0.15)
  return (n: number): Rarity => {
    if (n >= t4) return 'common'
    if (n >= t3) return 'uncommon'
    if (n >= t2) return 'rare'
    if (n >= t1) return 'epic'
    return 'legendary'
  }
}

export const RARITY_CONFIG: Record<Rarity, { label: string; color: string; glow: string; bg: string; shimmer: boolean }> = {
  common:   { label: 'Common',    color: 'var(--success-ink)', glow: 'rgba(74,222,128,0.4)',   bg: 'rgba(74,222,128,0.08)',   shimmer: false },
  uncommon: { label: 'Uncommon',  color: '#60a5fa', glow: 'rgba(96,165,250,0.4)',   bg: 'rgba(96,165,250,0.08)',   shimmer: false },
  rare:     { label: 'Rare',      color: '#c084fc', glow: 'rgba(192,132,252,0.5)',  bg: 'rgba(192,132,252,0.1)',   shimmer: false },
  epic:     { label: 'Epic',      color: '#fb923c', glow: 'rgba(251,146,60,0.6)',   bg: 'rgba(251,146,60,0.12)',   shimmer: true  },
  legendary:{ label: 'Legendary', color: 'var(--warn)', glow: 'rgba(251,191,36,0.8)',   bg: 'rgba(251,191,36,0.15)',   shimmer: true  },
}

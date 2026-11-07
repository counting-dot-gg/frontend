export interface Level {
  level: string
  xpRequired: number
  minXP: number
}

export const levelThresholds: Level[] = [
  { level: '1', xpRequired: 100, minXP: 0 },
  { level: '2', xpRequired: 250, minXP: 100 },
  { level: '3', xpRequired: 500, minXP: 250 },
  { level: '4', xpRequired: 800, minXP: 500 },
  { level: '5', xpRequired: 1200, minXP: 800 },
  { level: '6', xpRequired: 1700, minXP: 1200 },
  { level: '7', xpRequired: 2500, minXP: 1700 },
  { level: '8', xpRequired: 3500, minXP: 2500 },
  { level: '9', xpRequired: 5000, minXP: 3500 },
  { level: '10', xpRequired: 6666, minXP: 5000 },
  { level: '11', xpRequired: 8333, minXP: 6666 },
  { level: '12', xpRequired: 10000, minXP: 8333 },
  { level: '13', xpRequired: 12345, minXP: 10000 },
  { level: '14', xpRequired: 15000, minXP: 12345 },
  { level: '15', xpRequired: 20000, minXP: 15000 },
  { level: '16', xpRequired: 26000, minXP: 20000 },
  { level: '17', xpRequired: 33000, minXP: 26000 },
  { level: '18', xpRequired: 42069, minXP: 33000 },
  { level: '19', xpRequired: 54321, minXP: 42069 },
  { level: '20', xpRequired: 69420, minXP: 54321 },
  { level: '21', xpRequired: 84999, minXP: 69420 },
  { level: '22', xpRequired: 100000, minXP: 84999 },
  { level: '23', xpRequired: 118000, minXP: 100000 },
  { level: '24', xpRequired: 138000, minXP: 118000 },
  { level: '25', xpRequired: 160000, minXP: 138000 },
  { level: '26', xpRequired: 183000, minXP: 160000 },
  { level: '27', xpRequired: 208000, minXP: 183000 },
  { level: '28', xpRequired: 235000, minXP: 208000 },
  { level: '29', xpRequired: 265000, minXP: 235000 },
  { level: '30', xpRequired: 300000, minXP: 265000 },
  { level: '31', xpRequired: 337000, minXP: 300000 },
  { level: '32', xpRequired: 377000, minXP: 337000 },
  { level: '33', xpRequired: 420069, minXP: 377000 },
  { level: '34', xpRequired: 465000, minXP: 420069 },
  { level: '35', xpRequired: 509000, minXP: 465000 },
  { level: '36', xpRequired: 555555, minXP: 509000 },
  { level: '37', xpRequired: 605000, minXP: 555555 },
  { level: '38', xpRequired: 666666, minXP: 605000 },
  { level: '39', xpRequired: 725000, minXP: 666666 },
  { level: '40', xpRequired: 800000, minXP: 725000 },
  { level: '41', xpRequired: 888888, minXP: 800000 },
  { level: '42', xpRequired: 1000000, minXP: 888888 },
  { level: '43', xpRequired: 1234567, minXP: 1000000 },
  { level: '44', xpRequired: 1500000, minXP: 1234567 },
  { level: '45', xpRequired: 1750000, minXP: 1500000 },
  { level: '46', xpRequired: 2020202, minXP: 1750000 },
  { level: '47', xpRequired: 2270000, minXP: 2020202 },
  { level: '48', xpRequired: 2600000, minXP: 2270000 },
  { level: '49', xpRequired: 3000000, minXP: 2600000 },
  { level: '50', xpRequired: 3500000, minXP: 3000000 },
  { level: '51', xpRequired: 4000000, minXP: 3500000 },
  { level: '52', xpRequired: 4500000, minXP: 4000000 },
  { level: '53', xpRequired: 5000000, minXP: 4500000 },
  { level: '54', xpRequired: 5500000, minXP: 5000000 },
  { level: '55', xpRequired: 6000000, minXP: 5500000 },
  { level: '56', xpRequired: 6500000, minXP: 6000000 },
  { level: '57', xpRequired: 7000000, minXP: 6500000 },
  { level: '58', xpRequired: 7500000, minXP: 7000000 },
  { level: '59', xpRequired: 8000000, minXP: 7500000 },
  { level: '60', xpRequired: 8500000, minXP: 8000000 },
  { level: '61', xpRequired: 9000000, minXP: 8500000 },
  { level: '62', xpRequired: 9500000, minXP: 9000000 },
  { level: '63', xpRequired: 10000000, minXP: 9500000 },
  { level: '64', xpRequired: 11111111, minXP: 10000000 },
  { level: '65', xpRequired: 11111111, minXP: 11111111 },
]

export const MAX_LEVEL = levelThresholds[levelThresholds.length - 1]

export function minXPForLevel(level: number | string): number {
  const l = levelThresholds.find((t) => t.level === String(level))
  return l ? l.minXP : MAX_LEVEL.minXP
}

export function calculateLevel(totalXP: number): Level {
  let level: Level = levelThresholds[0]
  for (let i = levelThresholds.length - 1; i >= 0; i--) {
    if (totalXP >= levelThresholds[i].minXP) {
      level = levelThresholds[i]
      break
    }
  }
  return level
}

export function levelProgressPct(totalXP: number, lvl: Level = calculateLevel(totalXP)): number {
  const span = lvl.xpRequired - lvl.minXP
  if (span <= 0) return 100
  return Math.max(0, Math.min(100, ((totalXP - lvl.minXP) / span) * 100))
}

export function isMaxLevel(lvl: Level): boolean {
  return lvl.level === MAX_LEVEL.level
}

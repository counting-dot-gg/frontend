export type DayPhase = 'night' | 'dawn' | 'morning' | 'day' | 'sunset' | 'dusk'

export function easternHour(at: number | Date = Date.now()): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false,
  }).format(at)
  return Number(hour) % 24
}

export function easternHourFraction(at: number | Date = Date.now()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(at)

  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0)
  return (get('hour') % 24) + get('minute') / 60
}

export function easternDayKey(at: number | Date = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(at)
}

export function phaseFor(hour: number): DayPhase {
  if (hour < 5) return 'night'
  if (hour < 7) return 'dawn'
  if (hour < 11) return 'morning'
  if (hour < 16) return 'day'
  if (hour < 19) return 'sunset'
  if (hour < 21) return 'dusk'
  return 'night'
}

export function currentPhase(at: number | Date = Date.now()): DayPhase {
  return phaseFor(easternHour(at))
}

export interface PhaseTheme {
  sky: string
  dark: boolean
  ink: string
  inkSoft: string
  rule: string
  label: string
}

export const PHASE_THEMES: Record<DayPhase, PhaseTheme> = {
  dawn: {
    sky: 'linear-gradient(180deg, #2f4a72 0%, #7f6f9d 34%, #e8a06d 62%, #f0b784 70%, #6b8f5a 70%, #3f6238 100%)',
    dark: true,
    ink: 'rgba(255,255,255,0.92)',
    inkSoft: 'rgba(255,255,255,0.55)',
    rule: 'rgba(255,255,255,0.28)',
    label: 'Dawn',
  },
  morning: {
    sky: 'linear-gradient(180deg, #4a86c8 0%, #7bb0e0 40%, #c4dcef 68%, #d8e8f4 70%, #8fbd6e 70%, #5f8f4c 100%)',
    dark: false,
    ink: 'rgba(0,0,0,0.62)',
    inkSoft: 'rgba(0,0,0,0.42)',
    rule: 'rgba(0,0,0,0.28)',
    label: 'Morning',
  },
  day: {
    sky: 'linear-gradient(180deg, #3f7fc4 0%, #74a8db 44%, #bcd8ec 68%, #cfe4f2 70%, #86b26a 70%, #5f8f4c 100%)',
    dark: false,
    ink: 'rgba(0,0,0,0.62)',
    inkSoft: 'rgba(0,0,0,0.42)',
    rule: 'rgba(0,0,0,0.28)',
    label: 'Afternoon',
  },
  sunset: {
    sky: 'linear-gradient(180deg, #3a5a8c 0%, #b5749a 38%, #ef9a5c 62%, #f6b874 70%, #75955c 70%, #47673d 100%)',
    dark: true,
    ink: 'rgba(255,255,255,0.92)',
    inkSoft: 'rgba(255,255,255,0.58)',
    rule: 'rgba(255,255,255,0.3)',
    label: 'Sunset',
  },
  dusk: {
    sky: 'linear-gradient(180deg, #1e2a4d 0%, #3d4470 38%, #7c5f83 64%, #96707f 70%, #4c6944 70%, #2c4530 100%)',
    dark: true,
    ink: 'rgba(255,255,255,0.9)',
    inkSoft: 'rgba(255,255,255,0.52)',
    rule: 'rgba(255,255,255,0.26)',
    label: 'Dusk',
  },
  night: {
    sky: 'linear-gradient(180deg, #080d1e 0%, #101a35 42%, #1c2b4c 66%, #24344f 70%, #22402c 70%, #16281d 100%)',
    dark: true,
    ink: 'rgba(255,255,255,0.88)',
    inkSoft: 'rgba(255,255,255,0.48)',
    rule: 'rgba(255,255,255,0.22)',
    label: 'Night',
  },
}

export function themeFor(phase: DayPhase): PhaseTheme {
  return PHASE_THEMES[phase]
}

type SkyKey = { hour: number; colors: string[]; darkness: number }

const SKY_KEYS: SkyKey[] = [
  { hour: 0,  colors: ['#080d1e', '#101a35', '#1c2b4c', '#24344f', '#22402c', '#16281d'], darkness: 1 },
  { hour: 4.5, colors: ['#0d1630', '#1b2649', '#3a3560', '#4a3f63', '#2b4733', '#1b2f22'], darkness: 0.95 },
  { hour: 6,  colors: ['#2f4a72', '#7f6f9d', '#e8a06d', '#f0b784', '#6b8f5a', '#3f6238'], darkness: 0.7 },
  { hour: 8,  colors: ['#4a86c8', '#7bb0e0', '#c4dcef', '#d8e8f4', '#8fbd6e', '#5f8f4c'], darkness: 0.05 },
  { hour: 13, colors: ['#3f7fc4', '#74a8db', '#bcd8ec', '#cfe4f2', '#86b26a', '#5f8f4c'], darkness: 0 },
  { hour: 17, colors: ['#4272b4', '#8f8fc2', '#e0a882', '#eec49a', '#7fa663', '#557f45'], darkness: 0.3 },
  { hour: 19, colors: ['#3a5a8c', '#b5749a', '#ef9a5c', '#f6b874', '#75955c', '#47673d'], darkness: 0.7 },
  { hour: 20.5, colors: ['#1e2a4d', '#3d4470', '#7c5f83', '#96707f', '#4c6944', '#2c4530'], darkness: 0.9 },
  { hour: 22, colors: ['#0d1428', '#16203c', '#2a3357', '#333f58', '#2a4a33', '#1a2f22'], darkness: 1 },
  { hour: 24, colors: ['#080d1e', '#101a35', '#1c2b4c', '#24344f', '#22402c', '#16281d'], darkness: 1 },
]

const STOP_POSITIONS = ['0%', '42%', '66%', '70%', '70%', '100%']

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return `rgb(${Math.round(lerp(r1, r2, t))}, ${Math.round(lerp(g1, g2, t))}, ${Math.round(lerp(b1, b2, t))})`
}

export interface Sky {
  gradient: string
  darkness: number
}

export function skyAt(hour: number): Sky {
  const h = ((hour % 24) + 24) % 24

  let lo = SKY_KEYS[0]
  let hi = SKY_KEYS[SKY_KEYS.length - 1]
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (h >= SKY_KEYS[i].hour && h <= SKY_KEYS[i + 1].hour) {
      lo = SKY_KEYS[i]
      hi = SKY_KEYS[i + 1]
      break
    }
  }

  const span = hi.hour - lo.hour
  const raw = span === 0 ? 0 : (h - lo.hour) / span
  const t = raw * raw * (3 - 2 * raw)

  const stops = lo.colors
    .map((c, i) => `${mixHex(c, hi.colors[i], t)} ${STOP_POSITIONS[i]}`)
    .join(', ')

  return {
    gradient: `linear-gradient(180deg, ${stops})`,
    darkness: lerp(lo.darkness, hi.darkness, t),
  }
}

export interface LightDirection {
  x: number
  elevation: number
  strength: number
}

export function ambientFilter(hour: number): string {
  const h = ((hour % 24) + 24) % 24
  const d = skyAt(h).darkness

  const brightness = 1 - d * 0.5
  const saturate = 1 - d * 0.4
  const hueNight = d * 6

  const warmth = Math.max(0, 1 - Math.min(Math.abs(h - 6.5), Math.abs(h - 18.5)) / 2.2)
  const sepia = warmth * 0.34

  return `brightness(${brightness.toFixed(3)}) saturate(${saturate.toFixed(3)}) ` +
    `sepia(${sepia.toFixed(3)}) hue-rotate(${(hueNight - warmth * 12).toFixed(2)}deg)`
}

export function lightAt(hour: number): LightDirection {
  const sunTheta = 2 * Math.PI * ((hour - 6) / 24)
  const moonTheta = sunTheta + Math.PI

  const pick = (theta: number) => ({ x: -Math.cos(theta), elevation: Math.sin(theta) })
  const sun = pick(sunTheta)
  const moon = pick(moonTheta)

  const lit = sun.elevation >= moon.elevation ? sun : moon
  if (lit.elevation <= 0) return { x: 0, elevation: 0, strength: 0 }

  return {
    x: lit.x,
    elevation: lit.elevation,
    strength: (sun.elevation >= moon.elevation ? 1 : 0.45) * Math.min(1, lit.elevation * 2.2),
  }
}

import { isDecimalValidationType } from './validationTypes'

const DARK_COLORS: Record<string, string> = {
  replyGold: '#727200',
  reply0:    '#4d0000',
  reply100:  '#980000',
  reply200:  '#654700',
  reply300:  '#216e00',
  reply400:  '#003b0b',
  reply500:  '#006b53',
  reply600:  '#004183',
  reply700:  '#14006c',
  reply800:  '#460060',
  reply900:  '#6e0064',
  reply1000: '#2a2a2a',
}

const LIGHT_COLORS: Record<string, string> = {
  replyGold: '#f2ee0e',
  reply0:    '#ef7070',
  reply100:  '#ffaeae',
  reply200:  '#ffebba',
  reply300:  '#cfffba',
  reply400:  '#a2e8af',
  reply500:  '#adffed',
  reply600:  '#add6ff',
  reply700:  '#bcadff',
  reply800:  '#e9adff',
  reply900:  '#ffadf8',
  reply1000: '#ededed',
}

export const REPLY_BADGE_INK = 'light-dark(#1c2333, #ffffff)'

const COLOR_NAMES = [
  'replyGold','reply0','reply100','reply200','reply300',
  'reply400','reply500','reply600','reply700','reply800','reply900','reply1000',
]

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

function interpolateIn(palette: Record<string, string>, ms: number, per: number): string {
  const clamped = Math.max(0, Math.round(typeof ms === 'string' ? parseFloat(ms) : ms))
  if (clamped < 1) return palette[COLOR_NAMES[0]]
  const last = COLOR_NAMES.length - 1
  const bucket = Math.floor(clamped / per)
  const cur = palette[COLOR_NAMES[Math.min(bucket + 1, last)]]
  const nxt = palette[COLOR_NAMES[Math.min(bucket + 2, last)]]
  const w = (clamped % per) / per
  const [r1,g1,b1] = hexToRgb(cur)
  const [r2,g2,b2] = hexToRgb(nxt)
  return rgbToHex(
    Math.round(r1 + w * (r2 - r1)),
    Math.round(g1 + w * (g2 - g1)),
    Math.round(b1 + w * (b2 - b1)),
  )
}

export function getInterpolatedReplyColor(ms: number, per = 100): string {
  if (typeof ms === 'string') ms = parseFloat(ms)
  return `light-dark(${interpolateIn(LIGHT_COLORS, ms, per)}, ${interpolateIn(DARK_COLORS, ms, per)})`
}

export function formatTimeSince(ms: number): { h: number; m: number; s: number; ms: number; paddedMs: string } {
  const rounded = Math.round(ms)
  const h = Math.floor(rounded / 3600000)
  const m = Math.floor(rounded / 60000) % 60
  const s = Math.floor(rounded / 1000) % 60
  const millis = rounded % 1000
  return { h, m, s, ms: millis, paddedMs: millis.toString().padStart(3, '0') }
}

const formatters = new Map<string, Intl.DateTimeFormat>()
function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options)
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat([], options)
    formatters.set(key, f)
  }
  return f
}

export function formatTimestamp(ts: string | number, mode: string = 'Milliseconds'): string {
  if (mode === 'Hidden') return ''
  const d = new Date(typeof ts === 'string' ? parseInt(ts) : ts)

  if (!isToday(d)) {
    const sameYear = d.getFullYear() === new Date().getFullYear()
    const date = formatter({
      month: 'numeric',
      day: 'numeric',
      ...(sameYear ? {} : { year: '2-digit' as const }),
    }).format(d)
    const time = formatter({ hour: 'numeric', minute: '2-digit' }).format(d)
    return `${date} ${time}`
  }

  return formatter({
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    ...(mode === 'Seconds' ? {} : { fractionalSecondDigits: 3 as const }),
  }).format(d)
}

function isToday(d: Date): boolean {
  const now = new Date()
  return d.getDate() === now.getDate()
    && d.getMonth() === now.getMonth()
    && d.getFullYear() === now.getFullYear()
}

export function timestampShowsDate(ts: string | number, mode: string = 'Milliseconds'): boolean {
  if (mode === 'Hidden') return false
  return !isToday(new Date(typeof ts === 'string' ? parseInt(ts) : ts))
}

export function formatFullTimestamp(ts: string | number, mode: string = 'Milliseconds'): string {
  if (mode === 'Hidden') return ''
  const d = new Date(typeof ts === 'string' ? parseInt(ts) : ts)
  if (isNaN(d.getTime())) return ''
  return formatter({
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    ...(mode === 'Seconds' ? {} : { fractionalSecondDigits: 3 as const }),
  }).format(d)
}

export function standardizeCountFormat(
  countContent: string,
  mode: string,
  validationType?: string | null,
): string {
  if (mode === 'Disabled' || !countContent) return countContent

  const knownDecimal = isDecimalValidationType(validationType)
  if (!knownDecimal) return countContent

  const digits = countContent.replace(/[,\s.]/g, '')
  if (!/^-?\d+$/.test(digits)) return countContent

  if (mode === 'No Separator') return digits

  const separator = mode === 'Commas' ? ',' : mode === 'Periods' ? '.' : mode === 'Spaces' ? ' ' : null
  if (!separator) return countContent

  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
}

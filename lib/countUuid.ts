import { validate } from 'uuid'
import { format } from 'date-fns'

const SKIP_AT = new Set([8, 13, 14, 18, 19, 23])

export function convertToTimestamp(uuid: string): number | null {
  if (!validate(uuid)) return null
  let digits = ''
  for (let i = 0; digits.length < 16 && i < uuid.length; i++) {
    if (SKIP_AT.has(i)) continue
    digits += uuid[i]
  }
  if (!/^\d{16}$/.test(digits)) return null
  return Number(digits) / 1000
}

export function formatDateExact(timestamp: number): string {
  const base = format(timestamp, 'yyyy-MM-dd HH:mm:ss.SSS')
  const sub = String(timestamp).split('.')[1]
  return sub ? base + sub : base
}

export function formatDate(timestamp: number, dontSayToday = false): string {
  const date = new Date(timestamp)
  const now = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === now.toDateString()) {
    return `${dontSayToday ? '' : 'Today at '}${date.toLocaleTimeString()}`
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${date.toLocaleTimeString()}`
  }
  return `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`
}

const YEAR = 31536000000
const DAY = 86400000
const HOUR = 3600000
const MINUTE = 60000
const SECOND = 1000

export function formatTimeDiff(time1: number, time2: number, mini = false): string {
  const diff = Math.abs(time2 - time1)

  const years = Math.floor(diff / YEAR)
  const days = Math.floor((diff % YEAR) / DAY)
  const hours = Math.floor((diff % DAY) / HOUR)
  const minutes = Math.floor((diff % HOUR) / MINUTE)
  const seconds = Math.floor((diff % MINUTE) / SECOND)
  const milliseconds = parseFloat((diff % SECOND).toFixed(3))

  const labels = mini
    ? ['y', 'd', 'h', 'm', 's', 'ms']
    : [
        ` year${years > 1 ? 's' : ''}`,
        ` day${days > 1 ? 's' : ''}`,
        ` hour${hours > 1 ? 's' : ''}`,
        ` minute${minutes > 1 ? 's' : ''}`,
        ` second${seconds > 1 ? 's' : ''}`,
        ` millisecond${milliseconds !== 1 ? 's' : ''}`,
      ]

  const parts: string[] = []
  const values = [years, days, hours, minutes, seconds, milliseconds]
  values.forEach((v, i) => { if (v) parts.push(`${v}${labels[i]}`) })

  return parts.length ? parts.join(mini ? ' ' : ', ') : mini ? '0ms' : '0 milliseconds'
}

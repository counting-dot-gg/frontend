export function formatDurationShort(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  if (h > 0) return `${h}h`
  const m = Math.floor(total / 60)
  if (m > 0) return `${m}m`
  return `${total}s`
}

export function formatDurationFull(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  if (total === 0) return '0 seconds'

  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60

  const parts: string[] = []
  const push = (n: number, unit: string) => {
    if (n > 0) parts.push(`${n.toLocaleString()} ${unit}${n === 1 ? '' : 's'}`)
  }
  push(h, 'hour')
  push(m, 'minute')
  push(s, 'second')
  return parts.join(', ')
}

export function formatDurationCompact(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h.toLocaleString()}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

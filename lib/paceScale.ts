export const SCALE_KNEE = 300
export const SCALE_ABOVE = 6

export function scaleY(ms: number): number {
  if (ms <= SCALE_KNEE) return ms
  return SCALE_KNEE + Math.sqrt(ms - SCALE_KNEE) * SCALE_ABOVE
}

export const Y_TICKS = [0, 50, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 3000]

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || isNaN(ms)) return '-'
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  const total = ms / 1000
  const m = Math.floor(total / 60)
  const rest = total - m * 60
  return m > 0 ? `${m}:${rest.toFixed(3).padStart(6, '0')}` : `${rest.toFixed(3)}s`
}

export function formatClock(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '-'
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}

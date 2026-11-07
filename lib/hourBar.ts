export function toBarMs(ts: string | number | null | undefined): number | null {
  if (ts == null || ts === '') return null
  if (typeof ts === 'number') return isNaN(ts) ? null : ts
  const n = parseInt(ts)
  const ms = new Date(isNaN(n) ? ts : n).getTime()
  return isNaN(ms) ? null : ms
}

export function hourBarKey(ts: string | number | null | undefined): string {
  const ms = toBarMs(ts)
  if (ms == null) return ''
  const d = new Date(ms)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`
}

export function hourBarLabel(ts: string | number | null | undefined, now: number = Date.now()): string {
  const ms = toBarMs(ts)
  if (ms == null) return ''
  const floored = new Date(ms)
  floored.setMinutes(0, 0, 0)
  const timeStr = floored.toLocaleTimeString([], { hour: 'numeric', minute: 'numeric' })
  const today = new Date(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (floored.toLocaleDateString() === today.toLocaleDateString()) return `Today at ${timeStr}`
  if (floored.toLocaleDateString() === yesterday.toLocaleDateString()) return `Yesterday at ${timeStr}`
  return `${floored.toLocaleDateString()} at ${timeStr}`
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function nextLocalMidnight(ms: number): number {
  const d = new Date(ms)
  d.setHours(24, 0, 0, 0)
  return d.getTime()
}

type Listener = () => void

const listeners = new Set<Listener>()
let timer: ReturnType<typeof setTimeout> | null = null
let armedDay = 0

function notify() {
  for (const listener of [...listeners]) listener()
}

function arm() {
  if (timer) clearTimeout(timer)
  const now = Date.now()
  armedDay = startOfLocalDay(now)
  const delay = Math.max(1000, nextLocalMidnight(now) + 1000 - now)
  timer = setTimeout(() => {
    timer = null
    arm()
    notify()
  }, delay)
}

function onWake() {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
  if (startOfLocalDay(Date.now()) === armedDay) return
  arm()
  notify()
}

export function onDayRollover(cb: Listener): () => void {
  listeners.add(cb)
  if (listeners.size === 1) {
    arm()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onWake)
      window.addEventListener('focus', onWake)
    }
  }
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0) {
      if (timer) clearTimeout(timer)
      timer = null
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onWake)
        window.removeEventListener('focus', onWake)
      }
    }
  }
}

export function hourBarHTML(
  ts: string | number | null | undefined,
  opts: { liStyle?: string; lineColor?: string; labelStyle?: string } = {},
): string {
  const {
    liStyle = '',
    lineColor = 'rgb(var(--ink-rgb) / 0.15)',
    labelStyle = 'font-size:11px;color:rgb(var(--ink-rgb) / 0.35)',
  } = opts
  const ms = toBarMs(ts)
  const line = `<div style="flex-grow:1;height:0;border-top:1px solid ${lineColor}"></div>`
  return `<li data-hour-bar${ms == null ? '' : ` data-bar-ts="${ms}"`} style="display:flex;align-items:center;margin:6px 12px;user-select:none;${liStyle}">` +
    line +
    `<span data-hour-bar-label style="margin:0 8px;${labelStyle};white-space:nowrap">${hourBarLabel(ms)}</span>` +
    line +
    `</li>`
}

export function relabelHourBars(root: ParentNode | null | undefined): void {
  if (!root) return
  const now = Date.now()
  for (const el of root.querySelectorAll<HTMLElement>('[data-hour-bar][data-bar-ts]')) {
    const span = el.querySelector<HTMLElement>('[data-hour-bar-label]')
    if (!span) continue
    const next = hourBarLabel(el.getAttribute('data-bar-ts'), now)
    if (next && span.textContent !== next) span.textContent = next
  }
}

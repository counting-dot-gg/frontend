import { useSyncExternalStore } from 'react'
import { API } from '@/lib/apiBase'

export type Severity = 'major' | 'minor'

export interface SiteStatus {
  level: 'ok' | Severity | 'unknown'
  firing: { title: string; severity: Severity; since: number | null }[]
}

const POLL_MS = 60_000
const UNKNOWN: SiteStatus = { level: 'unknown', firing: [] }

let current: SiteStatus = UNKNOWN
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

async function refresh(): Promise<void> {
  if (document.visibilityState === 'hidden') return
  try {
    const res = await fetch(`${API}/api/status-summary`, { cache: 'no-store' })
    current = res.ok ? ((await res.json()) as SiteStatus) : UNKNOWN
  } catch {
    current = UNKNOWN
  }
  for (const l of listeners) l()
}

function onVisible(): void {
  if (document.visibilityState === 'visible') void refresh()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) {
    void refresh()
    timer = setInterval(() => void refresh(), POLL_MS)
    document.addEventListener('visibilitychange', onVisible)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size > 0) return
    if (timer) clearInterval(timer)
    timer = null
    document.removeEventListener('visibilitychange', onVisible)
  }
}

export function useSiteStatus(): SiteStatus {
  return useSyncExternalStore(subscribe, () => current, () => UNKNOWN)
}

export const LEVEL_COLOR: Record<SiteStatus['level'], string> = {
  ok: 'var(--success)',
  minor: 'var(--warn)',
  major: 'var(--danger)',
  unknown: 'var(--muted-foreground)',
}

import { useSyncExternalStore } from 'react'
import type { DailyHOCEntry, LastCountInfo } from '@/components/thread/ThreadView'

export type ThreadStats = { lastCount: LastCountInfo | null; dailyHOC: DailyHOCEntry[] }

const EMPTY: ThreadStats = { lastCount: null, dailyHOC: [] }
let state: ThreadStats = EMPTY
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function setLastCount(lastCount: LastCountInfo | null): void {
  state = { ...state, lastCount }
  emit()
}

export function setDailyHOC(next: DailyHOCEntry[] | ((prev: DailyHOCEntry[]) => DailyHOCEntry[])): void {
  state = { ...state, dailyHOC: typeof next === 'function' ? next(state.dailyHOC) : next }
  emit()
}

export function resetThreadStats(): void {
  state = EMPTY
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useThreadStats(): ThreadStats {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY)
}

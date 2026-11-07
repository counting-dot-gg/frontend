import { useSyncExternalStore } from 'react'

export type DevicePerf = { flipList: boolean; fewerRows: boolean; liveRank: boolean }

const KEY = 'cgg.devicePerf'
const DEFAULTS: DevicePerf = { flipList: false, fewerRows: false, liveRank: true }

let state: DevicePerf | null = null
const listeners = new Set<() => void>()

function load(): DevicePerf {
  if (state) return state
  let saved: Partial<DevicePerf> = {}
  try { saved = JSON.parse(window.localStorage.getItem(KEY) || '{}') } catch {}
  state = { flipList: saved.flipList === true, fewerRows: saved.fewerRows === true, liveRank: saved.liveRank !== false }
  return state
}

export function getDevicePerf(): DevicePerf {
  if (typeof window === 'undefined') return DEFAULTS
  return load()
}

export function setDevicePerf(next: Partial<DevicePerf>): void {
  state = { ...load(), ...next }
  try { window.localStorage.setItem(KEY, JSON.stringify(state)) } catch {}
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useDevicePerf(): DevicePerf {
  return useSyncExternalStore(subscribe, getDevicePerf, () => DEFAULTS)
}

export function liveRowLimit(normal: number): number {
  if (typeof window === 'undefined') return normal
  try {
    const n = Number(new URLSearchParams(window.location.search).get('rows'))
    if (Number.isInteger(n) && n >= 5) return n
  } catch {}
  if (getDevicePerf().fewerRows && window.matchMedia('(max-width: 640px)').matches) return 25
  return normal
}

export function flipListOn(perf: DevicePerf): boolean {
  if (typeof window === 'undefined') return false
  try { if (new URLSearchParams(window.location.search).has('flip')) return true } catch {}
  return perf.flipList
}

'use client'

export const WISDOM_RISE_MS = 35000

export const WISDOM_SHADOW_DELAY_MS = 3000

let open = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach(l => l())
}

export function subscribeSkyWisdom(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function readSkyWisdom(): boolean {
  return open
}

export function readSkyWisdomServer(): boolean {
  return false
}

export function toggleSkyWisdom(): void {
  open = !open
  emit()
}

export function closeSkyWisdom(): void {
  if (!open) return
  open = false
  emit()
}

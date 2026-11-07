'use client'

import { useSyncExternalStore } from 'react'
import type { RankName } from './rankUtils'

export interface FeatPerson {
  uuid: string
  name: string
  username?: string
  color?: string
  discordId?: string
  avatar?: string
}

export interface Feat {
  key: string
  who?: FeatPerson | FeatPerson[] | null
  rank?: { rank: RankName; division: number }
  text: string
  where?: string
  href?: string
  at: number
}

const STORAGE_KEY = 'cgg-feats'
const MAX = 200
const EMPTY: Feat[] = []

let feats: Feat[] | null = null
let latest: Feat | null = null
const listeners = new Set<() => void>()

function read(): Feat[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function emit() {
  listeners.forEach(l => l())
}

export function subscribeFeats(cb: () => void): () => void {
  if (listeners.size === 0 && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
  }
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

function onStorage(e: StorageEvent) {
  if (e.key !== STORAGE_KEY) return
  feats = read()
  emit()
}

export function readFeats(): Feat[] {
  if (typeof window === 'undefined') return EMPTY
  return (feats ??= read())
}

export function readFeatsServer(): Feat[] {
  return EMPTY
}

export function readLatestFeat(): Feat | null {
  return latest
}

export function pushFeat(f: Omit<Feat, 'at'>): void {
  const stored = read()
  const feat: Feat = { ...f, at: Date.now() }
  latest = feat
  if (!stored.some(x => x.key === f.key)) {
    feats = [feat, ...stored].slice(0, MAX)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(feats)) } catch {}
  } else {
    feats = stored
  }
  emit()
}

let enabledOverride: boolean | null = null

export function setFeatsEnabled(v: boolean): void {
  if (enabledOverride === v) return
  enabledOverride = v
  emit()
}

export function useFeatsEnabled(fromSession: boolean): boolean {
  return useSyncExternalStore(subscribeFeats, () => enabledOverride ?? fromSession, () => fromSession)
}

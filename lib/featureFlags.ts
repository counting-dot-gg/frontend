'use client'

import { useEffect, useState } from 'react'

let cache: Record<string, boolean> | null = null
let inFlight: Promise<Record<string, boolean>> | null = null

export function fetchFlags(): Promise<Record<string, boolean>> {
  if (cache) return Promise.resolve(cache)
  if (inFlight) return inFlight
  inFlight = fetch('/api/features', { credentials: 'include' })
    .then(r => (r.ok ? r.json() : {}))
    .then((j: Record<string, boolean>) => {
      cache = j ?? {}
      return cache
    })
    .catch(() => ({}))
    .finally(() => { inFlight = null })
  return inFlight
}

export function useFeatureFlag(key: string): boolean {
  const [on, setOn] = useState<boolean>(() => cache?.[key] ?? false)
  useEffect(() => {
    let alive = true
    void fetchFlags().then(f => { if (alive) setOn(!!f[key]) })
    return () => { alive = false }
  }, [key])
  return on
}

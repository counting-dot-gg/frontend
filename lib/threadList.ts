import { API } from '@/lib/apiBase'

const TTL_MS = 30_000

let inFlight: Promise<unknown[]> | null = null
let cached: { at: number; value: unknown[] } | null = null

export function fetchAllThreads<T = unknown>(): Promise<T[]> {
  if (cached && Date.now() - cached.at < TTL_MS) {
    return Promise.resolve(cached.value as T[]);
  }
  if (inFlight) return inFlight as Promise<T[]>;

  inFlight = fetch(`${API}/api/thread/all`, { credentials: 'include' })
    .then(r => {
      if (!r.ok) throw new Error(`thread/all ${r.status}`)
      return r.json()
    })
    .then((value: unknown[]) => {
      cached = { at: Date.now(), value }
      return value
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight as Promise<T[]>
}

export function invalidateAllThreads(): void {
  cached = null
}

const GRAFANA_URL = process.env.GRAFANA_URL

export const PROM_UID = process.env.GRAFANA_PROM_UID || 'grafanacloud-prom'
export const HISTORY_UID = process.env.GRAFANA_HISTORY_UID || 'grafanacloud-alert-state-history'

export async function grafana<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.GRAFANA_STATUS_TOKEN
  if (!token || !GRAFANA_URL) throw new Error('GRAFANA_URL and GRAFANA_STATUS_TOKEN must be set')
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${GRAFANA_URL}${path}${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) throw new Error(`grafana ${res.status}`)
  return res.json() as Promise<T>
}

export function cached<K, V>(ttlMs: number, load: (key: K) => Promise<V>) {
  const hits = new Map<K, { at: number; value: V }>()
  const inflight = new Map<K, Promise<V>>()
  return async (key: K): Promise<{ value: V; stale: boolean }> => {
    const hit = hits.get(key)
    if (hit && Date.now() - hit.at < ttlMs) return { value: hit.value, stale: false }
    let p = inflight.get(key)
    if (!p) {
      p = load(key).finally(() => inflight.delete(key))
      inflight.set(key, p)
    }
    try {
      const value = await p
      hits.set(key, { at: Date.now(), value })
      return { value, stale: false }
    } catch (err) {
      if (hit) return { value: hit.value, stale: true }
      throw err
    }
  }
}

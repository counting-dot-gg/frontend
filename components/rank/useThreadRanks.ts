'use client'

import { useEffect, useState } from 'react'
import { API } from '@/lib/apiBase'
import type { ThreadRankRow } from '@/lib/rankUtils'

export function useThreadRanks(username: string | undefined, enabled = true): Record<string, ThreadRankRow> {
  const [ranks, setRanks] = useState<Record<string, ThreadRankRow>>({})
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  useEffect(() => {
    if (!username || !enabled || loadedFor === username) return
    let cancelled = false
    fetch(`${API}/api/rank/counter/${encodeURIComponent(username)}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data) return
        const byThread: Record<string, ThreadRankRow> = {}
        for (const r of (data.ranks ?? []) as ThreadRankRow[]) {
          if (r.threadUuid) byThread[r.threadUuid] = r
        }
        setRanks(byThread)
        setLoadedFor(username)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [username, enabled, loadedFor])

  return ranks
}

import type { Metadata } from 'next'
import { Suspense } from 'react'
import StatsClient from './StatsClient'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

export const metadata: Metadata = {
  title: 'Stats | counting.gg',
  description: 'Counting leaderboards, graphs and per-thread statistics.',
}

interface ThreadItem {
  uuid: string
  name: string
  title: string
  allowDoublePosts: boolean
  resetOnMistakes: boolean
}

async function getThreads(): Promise<ThreadItem[]> {
  try {
    const res = await fetch(`${API}/api/thread/all`, { next: { revalidate: 120 } })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : (data.threads ?? [])
  } catch {
    return []
  }
}

export default async function StatsPage() {
  const threads = await getThreads()
  return (
    <Suspense>
      <StatsClient initialThreads={threads} />
    </Suspense>
  )
}

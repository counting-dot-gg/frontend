import type { Metadata } from 'next'
import ThreadsClient, { type ThreadCardData } from './ThreadsClient'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

export const metadata: Metadata = {
  title: 'Threads | counting.gg',
}

function categoryOf(t: { locked?: boolean; category?: string }): string {
  if (t.locked) return 'Archived'
  return t.category?.trim() || 'Uncategorized'
}

const PRIORITY = ['Traditional', 'Double Counting', 'No Mistakes', 'Miscellaneous']
function byCategory(a: string, b: string): number {
  const ia = PRIORITY.indexOf(a)
  const ib = PRIORITY.indexOf(b)
  if (ia !== -1 && ib !== -1) return ia - ib
  if (ia !== -1) return -1
  if (ib !== -1) return 1
  return a.localeCompare(b)
}

async function getThreads(): Promise<ThreadCardData[]> {
  try {
    const res = await fetch(`${API}/api/thread/all`, { next: { revalidate: 60 } })
    if (!res.ok) return []
    const rows = await res.json()
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

export default async function ThreadsPage() {
  const threads = await getThreads()

  const grouped: Record<string, ThreadCardData[]> = {}
  for (const t of threads) {
    const cat = categoryOf(t)
    ;(grouped[cat] ??= []).push(t)
  }
  for (const list of Object.values(grouped)) {
  }
  const categories = Object.keys(grouped).sort(byCategory)

  return <ThreadsClient grouped={grouped} categories={categories} total={threads.length} />
}

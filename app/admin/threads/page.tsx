import type { Metadata } from 'next'
import { apiFetch } from '@/lib/apiFetch'
import { requireAdmin } from '@/lib/adminGuard'
import ThreadAdminClient, { type AdminThread } from './ThreadAdminClient'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

export const metadata: Metadata = {
  title: 'Thread admin | counting.gg',
}

async function getAllThreads(): Promise<AdminThread[]> {
  try {
    const res = await apiFetch(`${API}/api/thread/all`, { cache: 'no-store' })
    if (!res.ok) return []
    const rows = await res.json()
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

export default async function AdminThreadsPage() {
  await requireAdmin()
  const threads = await getAllThreads()
  return <ThreadAdminClient threads={threads} />
}

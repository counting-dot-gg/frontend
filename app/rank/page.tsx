import type { Metadata } from 'next'
import { getSession } from '@/lib/session'
import RankClient from './RankClient'

export const metadata: Metadata = {
  title: 'Rank | counting.gg',
}

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

interface Thread {
  uuid: string
  name: string
  title: string
}

async function getAllThreads(): Promise<Thread[]> {
  try {
    const res = await fetch(`${API}/api/thread/all`, { next: { revalidate: 120 } })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : (data.threads ?? [])
  } catch {
    return []
  }
}

export default async function RankPage() {
  const [session, threads] = await Promise.all([getSession(), getAllThreads()])

  return (
    <RankClient
      username={session?.counter?.username ?? session?.username ?? null}
      isAdmin={session?.counter?.roles?.includes('admin') ?? false}
      threads={threads}
    />
  )
}

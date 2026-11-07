import type { Metadata } from 'next'
import { getSession } from '@/lib/session'
import RankAdminClient from './RankAdminClient'

export const metadata: Metadata = {
  title: 'Rank Admin | counting.gg',
  robots: { index: false, follow: false },
}

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

type Thread = { uuid: string; name: string; title: string }

async function getThreads(): Promise<Thread[]> {
  try {
    const res = await fetch(`${API}/api/thread/all`, { next: { revalidate: 120 } })
    if (!res.ok) return []
    const data = await res.json()
    const threads: Thread[] = Array.isArray(data) ? data : (data.threads ?? [])
    return threads.map(t => ({ uuid: t.uuid, name: t.name, title: t.title }))
  } catch {
    return []
  }
}

export default async function RankAdminPage() {
  const session = await getSession()
  const isAdmin = !!session?.counter?.roles?.includes('admin')

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--surface-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#555' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 16, color: '#888', fontWeight: 600 }}>Access denied.</div>
        </div>
      </div>
    )
  }

  return <RankAdminClient threads={await getThreads()} />
}

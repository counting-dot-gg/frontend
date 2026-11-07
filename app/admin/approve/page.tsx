import type { Metadata } from 'next'
import { apiFetch } from '@/lib/apiFetch'
import { requireAdmin } from '@/lib/adminGuard'
import ApproveClient, { type PendingCounter } from './ApproveClient'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { uuidParse } = require('uuid-timestamp')

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

function signupDate(uuid: string): string | null {
  try {
    const ms = uuidParse(uuid)
    if (!Number.isFinite(ms)) return null
    return new Date(ms).toISOString().slice(0, 10)
  } catch {
    return null
  }
}

export const metadata: Metadata = {
  title: 'Approve registrations | counting.gg',
}

async function getUnapproved(cookieHeader: string): Promise<PendingCounter[]> {
  try {
    const res = await apiFetch(`${API}/api/counter/unapproved`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export default async function AdminApprovePage() {
  await requireAdmin()

  const { headers } = await import('next/headers')
  const cookieHeader = (await headers()).get('cookie') ?? ''

  const counters = await getUnapproved(cookieHeader)
  const pending = counters.map(c => ({
    ...c,
    roles: c.roles ?? [],
    signedUpAt: signupDate(c.uuid),
  }))
  return <ApproveClient initialPending={pending} />
}

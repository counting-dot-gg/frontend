import type { Metadata } from 'next'
import StatusClient from './StatusClient'
import { getSession } from '@/lib/session'

export const metadata: Metadata = {
  title: 'Status | counting.gg',
  description: 'Live latency and health for counting.gg, measured in the browsers of everyone counting.',
}

export const dynamic = 'force-dynamic'

export default async function StatusPage() {
  const session = await getSession()
  const roles: string[] = session?.counter?.roles ?? []
  return <StatusClient staff={roles.includes('admin') || roles.includes('mod')} signedIn={!!session?.counter} />
}

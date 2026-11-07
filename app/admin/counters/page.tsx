import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/adminGuard'
import CounterAdminClient from './CounterAdminClient'

export const metadata: Metadata = {
  title: 'Counter admin | counting.gg',
}

export default async function AdminCountersPage() {
  await requireAdmin()
  return <CounterAdminClient />
}

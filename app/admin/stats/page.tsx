import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/adminGuard'
import AdminStatsClient from './AdminStatsClient'

export const metadata: Metadata = {
  title: 'Stats admin | counting.gg',
  robots: { index: false, follow: false },
}

export default async function AdminStatsPage() {
  await requireAdmin()
  return <AdminStatsClient />
}

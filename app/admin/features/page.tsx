import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/adminGuard'
import FeatureFlagsClient from './FeatureFlagsClient'

export const metadata: Metadata = {
  title: 'Experimental features | counting.gg',
}

export default async function AdminFeatureFlagsPage() {
  await requireAdmin()
  return <FeatureFlagsClient />
}

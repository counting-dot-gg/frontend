import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/adminGuard'
import SystemMessageClient from './SystemMessageClient'

export const metadata: Metadata = {
  title: 'Send system message | counting.gg',
}

export default async function AdminSystemMessagePage() {
  await requireAdmin()
  return <SystemMessageClient />
}

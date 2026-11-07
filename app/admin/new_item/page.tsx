import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/adminGuard'
import NewItemClient from './NewItemClient'

export const metadata: Metadata = {
  title: 'New item | counting.gg',
}

export default async function AdminNewItemPage() {
  await requireAdmin()
  return <NewItemClient />
}

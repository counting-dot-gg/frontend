import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/adminGuard'
import DiscordRolesClient from './DiscordRolesClient'

export const metadata: Metadata = {
  title: 'Discord roles | counting.gg',
}

export default async function AdminDiscordRolesPage() {
  await requireAdmin()
  return <DiscordRolesClient />
}

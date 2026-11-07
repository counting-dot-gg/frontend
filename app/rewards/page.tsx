import type { Metadata } from 'next'
import { getSession } from '@/lib/session'
import RewardsClient from './RewardsClient'

export const metadata: Metadata = {
  title: 'XP Rewards | counting.gg',
}

export default async function RewardsPage() {
  const session = await getSession()
  return (
    <RewardsClient
      xp={session?.counter?.xp ?? 0}
      initialItems={session?.items ?? []}
      isLoggedIn={!!session?.counter}
    />
  )
}

import type { Metadata } from 'next'
import { getSession } from '@/lib/session'
import AchievementsClient from './AchievementsClient'

export const metadata: Metadata = {
  title: 'Achievements | counting.gg',
}

export default async function AchievementsPage() {
  const session = await getSession()
  return (
    <AchievementsClient
      userUUID={session?.uuid ?? null}
      isLoggedIn={!!session}
    />
  )
}

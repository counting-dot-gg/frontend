import type { Metadata } from 'next'
import { getSession } from '@/lib/session'
import FeedbackClient from './FeedbackClient'

export const metadata: Metadata = {
  title: 'Feedback | counting.gg',
}

export default async function FeedbackPage() {
  const session = await getSession()
  const roles = session?.counter?.roles ?? []

  return (
    <FeedbackClient
      meUuid={session?.counter?.uuid ?? session?.uuid ?? null}
      isStaff={roles.includes('admin') || roles.includes('mod')}
      canPost={!!session && !roles.includes('banned') && !roles.includes('muted')}
    />
  )
}

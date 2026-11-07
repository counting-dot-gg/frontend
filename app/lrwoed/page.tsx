import type { Metadata } from 'next'
import { getSession } from '@/lib/session'
import LrwoedClient from './LrwoedClient'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'lrwoed | Counting!',
    description: Math.random() < 0.5
      ? 'The best wordle variant'
      : 'The worst wordle variant',
  }
}

export default async function LrwoedPage() {
  const session = await getSession()
  return <LrwoedClient isLoggedIn={!!session} />
}

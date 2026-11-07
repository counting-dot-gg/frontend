import type { Metadata } from 'next'
import { getSession } from '@/lib/session'
import BingoClient from './BingoClient'

export const metadata: Metadata = {
  title: 'Bingo | counting.gg',
}

export default async function BingoPage() {
  const session = await getSession()
  return (
    <BingoClient
      meUuid={session?.counter?.uuid ?? session?.uuid ?? null}
      isAdmin={!!session?.counter?.roles?.includes('admin')}
    />
  )
}

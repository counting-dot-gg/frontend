import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import BingoSimClient from './BingoSimClient'

export const metadata: Metadata = {
  title: 'Bingo Simulator | counting.gg',
}

export default async function BingoSimPage() {
  const session = await getSession()
  const roles = session?.counter?.roles ?? []
  if (!roles.includes('admin') && !roles.includes('mod')) notFound()
  return <BingoSimClient />
}

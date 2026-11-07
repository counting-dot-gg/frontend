import type { Metadata } from 'next'
import { Suspense } from 'react'
import CompletedBingoClient from './CompletedBingoClient'

export const metadata: Metadata = {
  title: 'Bingo history | counting.gg',
}

export default function CompletedBingoPage() {
  return (
    <Suspense>
      <CompletedBingoClient />
    </Suspense>
  )
}

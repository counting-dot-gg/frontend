import type { Metadata } from 'next'
import UuidClient from './UuidClient'

export const metadata: Metadata = {
  title: 'UUID Calculator | counting.gg',
}

export default function UuidPage() {
  return <UuidClient />
}

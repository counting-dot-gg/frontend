import type { Metadata } from 'next'
import HuhClient from './HuhClient'

export const metadata: Metadata = {
  title: 'Ok | counting.gg',
  description: 'Ok.',
}

export default function HuhPage() {
  return <HuhClient />
}

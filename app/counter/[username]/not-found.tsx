import type { Metadata } from 'next'
import NotFound from '@/components/NotFound'

export const metadata: Metadata = {
  title: 'Counter not found | counting.gg',
  robots: { index: false, follow: true },
}

export default function CounterNotFound() {
  return (
    <NotFound
      emoji="👤"
      title="No counter by that name."
      links={[
        { href: '/counters', label: 'All counters' },
        { href: '/', label: 'Home' },
      ]}
    />
  )
}

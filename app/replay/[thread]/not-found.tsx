import type { Metadata } from 'next'
import NotFound from '@/components/NotFound'

export const metadata: Metadata = {
  title: 'Replay not found | counting.gg',
  robots: { index: false, follow: true },
}

export default function ReplayNotFound() {
  return (
    <NotFound
      emoji="⏪"
      title="No replay for that."
      links={[
        { href: '/threads', label: 'All threads' },
        { href: '/', label: 'Home' },
      ]}
    />
  )
}

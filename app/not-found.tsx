import type { Metadata } from 'next'
import NotFound from '@/components/NotFound'

export const metadata: Metadata = {
  title: 'Page not found | counting.gg',
  robots: { index: false, follow: true },
}

export default function GlobalNotFound() {
  return (
    <NotFound
      title="Nothing here."
      links={[
        { href: '/', label: 'Home' },
        { href: '/threads', label: 'Threads' },
        { href: '/counters', label: 'Counters' },
      ]}
    />
  )
}

import type { Metadata } from 'next'
import NotFound from '@/components/NotFound'

export const metadata: Metadata = {
  title: 'Thread not found | counting.gg',
  robots: { index: false, follow: true },
}

export default function ThreadNotFound() {
  return (
    <NotFound
      emoji="🧵"
      title="No thread by that name."
      links={[
        { href: '/threads', label: 'All threads' },
        { href: '/thread/main', label: 'Main' },
        { href: '/', label: 'Home' },
      ]}
    />
  )
}

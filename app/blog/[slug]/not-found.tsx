import type { Metadata } from 'next'
import NotFound from '@/components/NotFound'

export const metadata: Metadata = {
  title: 'Post not found | counting.gg',
  robots: { index: false, follow: true },
}

export default function BlogNotFound() {
  return (
    <NotFound
      emoji="📄"
      title="No post here."
      links={[
        { href: '/blogs', label: 'All posts' },
        { href: '/', label: 'Home' },
      ]}
    />
  )
}

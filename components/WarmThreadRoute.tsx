'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function WarmThreadRoute({ href = '/thread/main' }: { href?: string }) {
  const pathname = usePathname()
  if (pathname?.startsWith('/thread/')) return null

  return (
    <Link
      href={href}
      prefetch
      aria-hidden
      tabIndex={-1}
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        overflow: 'hidden',
        clip: 'rect(0 0 0 0)',
        clipPath: 'inset(50%)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    />
  )
}

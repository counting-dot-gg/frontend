'use client'

import ErrorFallback from '@/components/ErrorFallback'

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: 'var(--surface-0)', color: 'var(--ink-1)', fontFamily: 'system-ui, sans-serif' }}>
        <ErrorFallback error={error} reset={unstable_retry} scope="root layout" />
      </body>
    </html>
  )
}

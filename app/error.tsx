'use client'

import { useEffect } from 'react'
import ErrorFallback from '@/components/ErrorFallback'

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error('Route error:', error)
  }, [error])

  return <ErrorFallback error={error} reset={unstable_retry} scope="page" />
}

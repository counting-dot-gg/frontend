'use client'

import Link from 'next/link'
import InteractivePostList from '@/components/thread/InteractivePostList'
import { formatFullTimestamp } from '@/lib/postHelpers'
import type { PostRow, RenderPrefs } from '@/components/thread/ThreadView'

export default function CountClient({ row, threadName, threadTitle, validationType, prefs, viewerUUID, viewerRoles }: {
  row: PostRow
  threadName: string
  validationType?: string
  threadTitle: string
  prefs: RenderPrefs
  viewerUUID?: string
  viewerRoles?: string[]
}) {
  const contextHref = `/thread/${encodeURIComponent(threadName)}?context=${encodeURIComponent(row.uuid)}`
  const postedAt = row.timestamp ? formatFullTimestamp(row.timestamp, prefs.pref_timestamp_display) : ''

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 80px' }}>
      <Link
        href={`/thread/${encodeURIComponent(threadName)}`}
        style={{ fontSize: '0.8rem', color: '#f97316', textDecoration: 'none', fontWeight: 600 }}
      >
        ← {threadTitle}
      </Link>

      <h1 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '10px 0 6px', letterSpacing: '-0.02em' }}>
        Single count
      </h1>
      <p style={{ color: 'var(--ink-3)', fontSize: '0.85rem', marginBottom: 22, lineHeight: 1.6 }}>
        One update from this thread.{' '}
        <Link href={contextHref} style={{ color: '#f97316', textDecoration: 'none' }}>
          See it in context
        </Link>
        , or open the thread for the latest counts.
      </p>

      {postedAt && (
        <p
          suppressHydrationWarning
          style={{ color: 'var(--ink-3)', fontSize: '0.8rem', margin: '0 0 8px', fontVariantNumeric: 'tabular-nums' }}
        >
          {`Posted ${postedAt}`}
        </p>
      )}

      <div style={{
        background: 'rgb(var(--ink-rgb) / 0.025)', border: '1px solid rgb(var(--ink-rgb) / 0.08)',
        borderRadius: 10, padding: '8px 4px',
      }}>
        <InteractivePostList
          posts={[row]}
          prefs={prefs}
          threadName={threadName}
          validationType={validationType}
          viewerUUID={viewerUUID}
          viewerRoles={viewerRoles}
        />
      </div>
    </div>
  )
}

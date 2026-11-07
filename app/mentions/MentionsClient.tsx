'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { buildRowHTML, setRowInteractive, setRowThreadName, type PostRow, type RenderPrefs } from '@/components/thread/ThreadView'

import { API } from '@/lib/apiBase'

export interface MentionItem {
  row: PostRow
  threadName: string
  threadTitle: string
  validationType?: string
}

function MentionCard({ item, prefs, read, onToggle, busy }: {
  item: MentionItem
  prefs: RenderPrefs
  read: boolean
  onToggle: () => void
  busy: boolean
}) {
  const html = useMemo(() => {
    setRowThreadName(item.threadName, false, item.validationType)
    setRowInteractive(false)
    return buildRowHTML(item.row, prefs)
  }, [item, prefs])

  return (
    <li
      className={
        'rounded-xl border bg-card transition-colors ' +
        (read ? 'border-border' : 'border-primary/50 bg-primary/[0.06]')
      }
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 px-3 py-2">
        {!read && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            new
          </span>
        )}
        <span className="text-xs font-semibold">{item.threadTitle}</span>

        <div className="ml-auto flex items-center gap-3">
          {item.threadName && (
            <Link
              href={`/thread/${encodeURIComponent(item.threadName)}?context=${encodeURIComponent(item.row.uuid)}`}
              className="text-xs font-semibold text-primary hover:underline underline-offset-4"
            >
              Context
            </Link>
          )}
          <button
            onClick={onToggle}
            disabled={busy}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {read ? 'Mark as unread' : 'Mark as read'}
          </button>
        </div>
      </div>

      <div className="px-1 py-2" dangerouslySetInnerHTML={{ __html: html }} />
    </li>
  )
}

export default function MentionsClient({ items, prefs, unreadOnArrival }: {
  items: MentionItem[]
  prefs: RenderPrefs
  unreadOnArrival: number
}) {
  const [readMap, setReadMap] = useState<Record<string, boolean>>(
    () => Object.fromEntries(items.map(i => [i.row.uuid, true])),
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggle = async (uuid: string) => {
    if (busy) return
    const next = !readMap[uuid]
    setBusy(uuid)
    setError(null)
    setReadMap(prev => ({ ...prev, [uuid]: next }))
    try {
      const res = await fetch(`${API}/api/counter/changeMessageReadStatus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageIDs: [uuid], newReadStatus: next }),
      })
      if (!res.ok) throw new Error(String(res.status))
    } catch {
      setReadMap(prev => ({ ...prev, [uuid]: !next }))
      setError('Couldn’t update that mention. Try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Mentions</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {items.length === 0
            ? 'Nobody has mentioned you yet.'
            : unreadOnArrival > 0
              ? `${unreadOnArrival} new since you last checked: all marked read now.`
              : 'Posts that mention you, newest first.'}
        </p>

        {error && (
          <p role="alert" className="mb-5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
            {error}
          </p>
        )}

        {items.length > 0 && (
          <ul className="space-y-3">
            {items.map(item => (
              <MentionCard
                key={item.row.uuid}
                item={item}
                prefs={prefs}
                read={readMap[item.row.uuid] ?? true}
                busy={busy === item.row.uuid}
                onToggle={() => toggle(item.row.uuid)}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

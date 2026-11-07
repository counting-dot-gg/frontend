'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { buildRowHTML, defaultRenderPrefs, setRowInteractive, setRowThreadName, type PostRow } from '@/components/thread/ThreadView'
import { avatarUrl } from '@/lib/counterUtils'

import { API } from '@/lib/apiBase'
const RENDER_PREFS = defaultRenderPrefs()
const PER_PAGE = 25

export interface FinderThread {
  uuid: string
  name: string
  title: string
  validationType?: string
}

type Mode = 'number' | 'rawCount' | 'comment'

const MODES: { value: Mode; label: string; endpoint: string; field: string }[] = [
  {
    value: 'number',
    label: 'Count number',
    endpoint: 'findPostByThreadAndNumber',
    field: 'number',
  },
  {
    value: 'rawCount',
    label: 'Raw count',
    endpoint: 'findPostByThreadAndRawCount',
    field: 'rawCount',
  },
  {
    value: 'comment',
    label: 'Comment',
    endpoint: 'findPostByThreadAndComment',
    field: 'comment',
  },
]

interface Counter {
  uuid: string
  username: string
  name: string
  discordId: string
  avatar: string
  color: string
  emoji?: string
}

function toPostRow(post: any, counters: Map<string, Counter>): PostRow {
  const c = counters.get(post.authorUUID)
  return {
    uuid: post.uuid,
    rawText: post.rawText ?? '',
    countContent: post.countContent,
    rawCount: post.rawCount,
    comment: post.comment,
    isValidCount: post.isValidCount,
    stricken: post.stricken,
    timestamp: post.timestamp,
    timeSinceLastPost: post.timeSinceLastPost,
    authorUUID: post.authorUUID,
    authorUsername: c?.username ?? 'unknown',
    authorName: c?.name ?? c?.username ?? 'unknown',
    authorColor: c?.color ?? '#888888',
    authorEmoji: c?.emoji,
    authorAvatarUrl: c ? avatarUrl(c) : undefined,
    reactions: post.reactions ?? undefined,
  }
}

export default function PostFinderClient({ threads, canSearchComments }: {
  threads: FinderThread[]
  canSearchComments: boolean
}) {
  setRowInteractive(false)

  const [selectedThread, setSelectedThread] = useState<FinderThread | null>(null)
  const [threadQuery, setThreadQuery] = useState('')
  const [threadListOpen, setThreadListOpen] = useState(false)
  const [threadActiveIdx, setThreadActiveIdx] = useState(0)
  const threadBoxRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<Mode>('number')
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<PostRow[] | null>(null)
  const [threadByUuid, setThreadByUuid] = useState<Map<string, string>>(new Map())
  const threadNameByUuid = useMemo(() => new Map(threads.map(t => [t.uuid, t.name])), [threads])
  const validationTypeByUuid = useMemo(() => new Map(threads.map(t => [t.uuid, t.validationType])), [threads])
  const [postThreads, setPostThreads] = useState<Map<string, string>>(new Map())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const availableModes = useMemo(
    () => MODES.filter(m => m.value !== 'comment' || canSearchComments),
    [canSearchComments],
  )
  const activeMode = availableModes.find(m => m.value === mode) ?? availableModes[0]

  const sortedThreads = useMemo(
    () => [...threads].sort((a, b) => a.title.localeCompare(b.title)),
    [threads],
  )

  const filteredThreads = useMemo(() => {
    const q = threadQuery.trim().toLowerCase()
    if (!q) return sortedThreads
    return sortedThreads.filter(
      t => t.title.toLowerCase().includes(q) || t.name.toLowerCase().includes(q),
    )
  }, [threadQuery, sortedThreads])

  useEffect(() => {
    if (!threadListOpen) return
    const onDown = (e: MouseEvent) => {
      if (threadBoxRef.current?.contains(e.target as Node)) return
      setThreadListOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [threadListOpen])

  const pickThread = useCallback((t: FinderThread | null) => {
    setSelectedThread(t)
    setThreadQuery(t ? t.title : '')
    setThreadListOpen(false)
    setThreadActiveIdx(0)
  }, [])

  const resolveThread = useCallback((): FinderThread | null => {
    if (selectedThread) return selectedThread
    const q = threadQuery.trim().toLowerCase()
    if (!q) return null
    return sortedThreads.find(
      t => t.title.toLowerCase() === q || t.name.toLowerCase() === q,
    ) ?? null
  }, [selectedThread, threadQuery, sortedThreads])

  const search = useCallback(async () => {
    const q = query.trim()
    if (!q) return
    if (mode === 'number' && !/^\d+$/.test(q)) {
      setError('Count number must be digits only.')
      return
    }

    setBusy(true)
    setError(null)
    setRows(null)
    setPage(1)
    try {
      const body: Record<string, unknown> = {
        [activeMode.field]: mode === 'number' ? parseInt(q, 10) : q,
      }
      const thread = resolveThread()
      if (thread) body.thread = thread.uuid

      const res = await fetch(`${API}/api/thread/${activeMode.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        if (res.status === 404) { setRows([]); return }
        throw new Error(`Search failed (${res.status})`)
      }
      const data = await res.json()
      const counters = new Map<string, Counter>(
        (data.counters ?? []).map((c: Counter) => [c.uuid, c]),
      )
      const tMap = new Map<string, string>(
        (data.threads ?? []).map((t: any) => [t.uuid, t.title ?? t.name]),
      )
      const posts: any[] = data.posts ?? []
      setThreadByUuid(tMap)
      setPostThreads(new Map(posts.map(p => [p.uuid, p.thread])))
      setRows(posts.map(p => toPostRow(p, counters)))
    } catch (e: any) {
      setError(e.message ?? 'Search failed')
    } finally {
      setBusy(false)
    }
  }, [query, mode, resolveThread, activeMode])

  const totalPages = rows ? Math.max(1, Math.ceil(rows.length / PER_PAGE)) : 1
  const pageRows = rows ? rows.slice((page - 1) * PER_PAGE, page * PER_PAGE) : []

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px 80px' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: '0 0 28px', letterSpacing: '-0.02em' }}>
        Post Finder
      </h1>

      <section style={{
        background: 'rgb(var(--ink-rgb) / 0.025)', border: '1px solid rgb(var(--ink-rgb) / 0.08)',
        borderRadius: 10, padding: 18, marginBottom: 28,
      }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
          {availableModes.map(m => {
            const active = m.value === mode
            return (
              <button
                key={m.value}
                onClick={() => { setMode(m.value); setRows(null); setError(null) }}
                style={{
                  padding: '6px 12px', borderRadius: 7, fontSize: '0.8rem', fontWeight: active ? 700 : 500,
                  border: `1px solid ${active ? '#f97316' : 'rgb(var(--ink-rgb) / 0.12)'}`,
                  background: active ? 'rgba(249,115,22,0.14)' : 'rgb(var(--ink-rgb) / 0.03)',
                  color: active ? '#f97316' : 'var(--ink-2)', cursor: 'pointer',
                }}
              >
                {m.label}
              </button>
            )
          })}
        </div>


        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div ref={threadBoxRef} style={{ position: 'relative', width: 220, flexShrink: 0 }}>
            <input
              value={threadQuery}
              onChange={e => {
                setThreadQuery(e.target.value)
                setSelectedThread(null)
                setThreadListOpen(true)
                setThreadActiveIdx(0)
              }}
              onFocus={() => setThreadListOpen(true)}
              onKeyDown={e => {
                if (!threadListOpen) return
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setThreadActiveIdx(i => Math.min(filteredThreads.length - 1, i + 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setThreadActiveIdx(i => Math.max(0, i - 1))
                } else if (e.key === 'Enter') {
                  if (filteredThreads[threadActiveIdx]) {
                    e.preventDefault()
                    pickThread(filteredThreads[threadActiveIdx])
                  }
                } else if (e.key === 'Escape') {
                  setThreadListOpen(false)
                }
              }}
              placeholder="All threads"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgb(var(--ink-rgb) / 0.05)', border: '1px solid rgb(var(--ink-rgb) / 0.12)',
                borderRadius: 6, padding: '7px 26px 7px 9px', fontSize: '0.82rem',
                color: 'var(--ink-1)', outline: 'none',
              }}
            />
            {(selectedThread || threadQuery) && (
              <button
                onClick={() => pickThread(null)}
                title="Search all threads"
                style={{
                  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer',
                  fontSize: 12, padding: 2, lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}

            {threadListOpen && filteredThreads.length > 0 && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
                background: 'var(--surface-raised)', border: '1px solid rgb(var(--ink-rgb) / 0.12)',
                borderRadius: 8, maxHeight: 220, overflowY: 'auto',
                boxShadow: '0 8px 24px rgb(var(--shadow-rgb) / 0.5)',
              }}>
                {filteredThreads.map((t, i) => (
                  <div
                    key={t.uuid}
                    onMouseDown={e => { e.preventDefault(); pickThread(t) }}
                    onMouseEnter={() => setThreadActiveIdx(i)}
                    style={{
                      padding: '6px 10px', cursor: 'pointer', fontSize: '0.8rem',
                      background: i === threadActiveIdx ? 'rgb(var(--ink-rgb) / 0.08)' : 'transparent',
                      color: 'var(--ink-2)',
                    }}
                  >
                    {t.title}
                    <span style={{ color: 'var(--ink-3)', fontSize: '0.7rem', marginLeft: 6, fontFamily: 'var(--font-mono)' }}>
                      {t.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') search() }}
            placeholder={mode === 'number' ? 'e.g. 1000' : mode === 'rawCount' ? 'e.g. 3E8' : 'e.g. nice'}
            inputMode={mode === 'number' ? 'numeric' : 'text'}
            style={{
              flex: 1, minWidth: 180, background: 'rgb(var(--ink-rgb) / 0.05)',
              border: '1px solid rgb(var(--ink-rgb) / 0.12)', borderRadius: 6,
              padding: '7px 10px', fontSize: '0.85rem', color: 'var(--ink-1)', outline: 'none',
              fontFamily: 'var(--font-mono)',
            }}
          />

          <button
            onClick={search}
            disabled={busy || !query.trim()}
            style={{
              padding: '8px 20px', borderRadius: 7, border: 'none',
              background: '#f97316', color: '#fff', fontWeight: 700, fontSize: '0.85rem',
              cursor: busy || !query.trim() ? 'default' : 'pointer',
              opacity: busy || !query.trim() ? 0.5 : 1,
            }}
          >
            {busy ? 'Searching…' : 'Search'}
          </button>
        </div>

        {error && <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--danger)' }}>{error}</div>}
      </section>

      {rows !== null && (
        <section>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            gap: 10, flexWrap: 'wrap', marginBottom: 12,
          }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
              {rows.length === 0
                ? 'No matches'
                : `${rows.length} result${rows.length === 1 ? '' : 's'}`}
            </h2>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--ink-3)' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={pagerStyle(page === 1)}
                >
                  ←
                </button>
                <span>{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={pagerStyle(page === totalPages)}
                >
                  →
                </button>
              </div>
            )}
          </div>

          {rows.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--ink-3)' }}>
              Nothing matched that search. Try a different thread, or switch search mode above.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {pageRows.map(row => {
                const threadUuid = postThreads.get(row.uuid)
                const threadTitle = threadUuid ? threadByUuid.get(threadUuid) : undefined
                setRowThreadName(
                  threadUuid ? threadNameByUuid.get(threadUuid) ?? '' : '',
                  false,
                  threadUuid ? validationTypeByUuid.get(threadUuid) : undefined,
                )
                return (
                  <li key={row.uuid} style={{
                    background: 'rgb(var(--ink-rgb) / 0.02)', border: '1px solid rgb(var(--ink-rgb) / 0.06)',
                    borderRadius: 8, padding: '6px 4px',
                  }}>
                    {!selectedThread && threadTitle && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--ink-3)', padding: '0 8px 2px', fontWeight: 700 }}>
                        {threadTitle}
                      </div>
                    )}
                    <div dangerouslySetInnerHTML={{ __html: buildRowHTML(row, RENDER_PREFS) }} />
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

function pagerStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '3px 9px', borderRadius: 6,
    border: '1px solid rgb(var(--ink-rgb) / 0.12)',
    background: 'rgb(var(--ink-rgb) / 0.04)',
    color: disabled ? 'rgb(var(--ink-rgb) / 0.35)' : 'var(--ink-2)',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: '0.8rem',
  }
}

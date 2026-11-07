'use client'

import { fetchAllThreads } from '@/lib/threadList'
import { useEffect, useRef, useState, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import type { DropResult } from '@hello-pangea/dnd'
import { DragDropContext, Droppable, Draggable, useIdlePreloadDnd } from '@/lib/dndLazy'
import { getSocket } from '@/lib/socket'
import CategoryChevron from './CategoryChevron'
import { useThreadNav } from '@/app/providers'
import type { MiscSettings, CategoryWithoutFullThreads } from '@/lib/types'
import { LC_THREAD_NAME, LC_THREAD_TITLE, LC_THREAD_UUID } from '@/lib/reddit'

interface ThreadItem {
  uuid: string
  name: string
  title: string
  threadOfTheDay: boolean
  allowDoublePosts: boolean
  resetOnMistakes: boolean
}

interface Category {
  name: string
  threads: ThreadItem[]
  expanded: boolean
}

import { API } from '@/lib/apiBase'
import { RankIconBadge } from '@/components/rank/RankIconBadge'
import { useThreadRanks } from '@/components/rank/useThreadRanks'
const DEFAULT_FAVORITES = ['main', 'double_counting', 'bars', 'slow', 'no_mistakes']
const OTHER_OVERRIDES = ['no_counting', LC_THREAD_NAME]
const SELF_ECHO_WINDOW_MS = 3000

const LIVECOUNTING_THREAD: ThreadItem = {
  uuid: LC_THREAD_UUID,
  name: LC_THREAD_NAME,
  title: LC_THREAD_TITLE,
  threadOfTheDay: false,
  allowDoublePosts: true,
  resetOnMistakes: false,
}

function withLivecounting(threads: ThreadItem[]): ThreadItem[] {
  return threads.some(t => t.uuid === LC_THREAD_UUID) ? threads : [...threads, LIVECOUNTING_THREAD]
}

function buildDefaultCategories(threads: ThreadItem[]): Category[] {
  const favorites = threads.filter(t => DEFAULT_FAVORITES.includes(t.name))
  const traditional = threads.filter(
    t => !OTHER_OVERRIDES.includes(t.name) && !favorites.includes(t) && !t.allowDoublePosts && !t.resetOnMistakes
  )
  const double = threads.filter(
    t => !OTHER_OVERRIDES.includes(t.name) && ![...favorites, ...traditional].includes(t) && t.allowDoublePosts && !t.resetOnMistakes
  )
  const noMistakes = threads.filter(
    t => !OTHER_OVERRIDES.includes(t.name) && ![...favorites, ...traditional, ...double].includes(t) && t.resetOnMistakes
  )
  const other = threads.filter(
    t => ![...favorites, ...traditional, ...double, ...noMistakes].includes(t)
  )
  return [
    { name: 'Favorites', threads: favorites, expanded: true },
    { name: 'Traditional', threads: traditional, expanded: true },
    { name: 'Double Counting', threads: double, expanded: true },
    { name: 'No Mistakes', threads: noMistakes, expanded: true },
    { name: 'Other', threads: other, expanded: true },
  ].filter(c => c.threads.length > 0 || c.name === 'Other')
}

function buildFromMiscSettings(allThreads: ThreadItem[], cats: CategoryWithoutFullThreads[]): Category[] {
  const result: Category[] = cats.map(cat => ({
    name: cat.name,
    expanded: cat.expanded,
    threads: cat.threadUUIDs
      .map(uuid => allThreads.find(t => t.uuid === uuid))
      .filter((t): t is ThreadItem => t !== undefined),
  }))

  if (!result.find(c => c.name === 'Other')) {
    result.push({ name: 'Other', threads: [], expanded: true })
  }

  const placed = new Set(result.flatMap(c => c.threads.map(t => t.uuid)))
  const uncategorized = allThreads.filter(t => !placed.has(t.uuid))

  return result.map(c =>
    c.name === 'Other' ? { ...c, threads: [...c.threads, ...uncategorized] } : c
  )
}

interface ThreadPickerProps {
  open: boolean
  onClose: () => void
  initialMiscSettings?: MiscSettings
  username?: string
}

export default function ThreadPicker({ open, onClose, initialMiscSettings, username }: ThreadPickerProps) {
  useIdlePreloadDnd(open)
  const threadRanks = useThreadRanks(username, open)
  const pathname = usePathname()
  const router = useRouter()
  const [allThreads, setAllThreads] = useState<ThreadItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [newCatName, setNewCatName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [threadDragging, setThreadDragging] = useState(false)
  const miscSettingsRef = useRef<MiscSettings | undefined>(initialMiscSettings)
  const lastChangeRef = useRef<number>(0)
  const lastUpdatedRef = useRef<number>(initialMiscSettings?.lastUpdated ?? 0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { isThreadViewMounted, requestThreadNav } = useThreadNav()

  const currentThread = pathname.startsWith('/thread/') ? decodeURIComponent(pathname.split('/')[2] ?? '') : null

  useEffect(() => {
    let cancelled = false
    fetchAllThreads<ThreadItem>()
      .then((fetched: ThreadItem[]) => {
        if (cancelled) return
        const threads = withLivecounting(fetched)
        setAllThreads(threads)
        const ms = miscSettingsRef.current
        if (ms?.categories?.length) {
          setCategories(buildFromMiscSettings(threads, ms.categories))
        } else {
          setCategories(buildDefaultCategories(threads))
        }
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const socket = getSocket()
    const handler = (ms: MiscSettings) => {
      miscSettingsRef.current = ms
      if (typeof ms.lastUpdated === 'number') lastUpdatedRef.current = ms.lastUpdated
      if (Date.now() - lastChangeRef.current < SELF_ECHO_WINDOW_MS) return
      setAllThreads(prev => {
        prev = withLivecounting(prev)
        if (ms.categories?.length) {
          setCategories(buildFromMiscSettings(prev, ms.categories))
        } else {
          setCategories(buildDefaultCategories(prev))
        }
        return prev
      })
    }
    const ackHandler = (lastUpdated: number) => { lastUpdatedRef.current = lastUpdated }
    socket.on('updateMiscSettings', handler)
    socket.on('miscSettingsLastUpdated', ackHandler)
    return () => {
      socket.off('updateMiscSettings', handler)
      socket.off('miscSettingsLastUpdated', ackHandler)
    }
  }, [])

  const persistCategories = useCallback((cats: Category[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const mapped: CategoryWithoutFullThreads[] = cats.map(c => ({
        name: c.name,
        expanded: c.expanded,
        threadUUIDs: c.threads.map(t => t.uuid),
      }))
      const socket = getSocket()
      if (socket.connected) {
        socket.emit('updateCategories', {
          update: mapped,
          miscSettingsChanged: lastUpdatedRef.current,
        })
      }
    }, 800)
  }, [])

  function markChanged(cats: Category[]) {
    lastChangeRef.current = Date.now()
    persistCategories(cats)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  function toggleCategory(name: string) {
    setCategories(prev => {
      const next = prev.map(c => c.name === name ? { ...c, expanded: !c.expanded } : c)
      markChanged(next)
      return next
    })
  }

  function addCategory() {
    const trimmed = newCatName.trim()
    if (!trimmed) return
    setCategories(prev => {
      const next = [...prev, { name: trimmed, threads: [], expanded: true }]
      markChanged(next)
      return next
    })
    setNewCatName('')
  }

  function confirmDelete(name: string) {
    setCategories(prev => {
      const toDelete = prev.find(c => c.name === name)
      const threadsToMove = toDelete?.threads ?? []
      const next = prev
        .filter(c => c.name !== name)
        .map(c => c.name === 'Other' ? { ...c, threads: [...c.threads, ...threadsToMove] } : c)
      if (!next.find(c => c.name === 'Other')) {
        next.push({ name: 'Other', threads: threadsToMove, expanded: true })
      }
      markChanged(next)
      return next
    })
    setDeleteTarget(null)
  }

  function onDragEnd(result: DropResult) {
    setThreadDragging(false)
    const { source, destination, type } = result
    if (!destination) return

    if (type === 'CATEGORY') {
      setCategories(prev => {
        const next = Array.from(prev)
        const [moved] = next.splice(source.index, 1)
        next.splice(destination.index, 0, moved)
        markChanged(next)
        return next
      })
      return
    }

    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    setCategories(prev => {
      const next = prev.map(c => ({ ...c, threads: [...c.threads] }))
      const srcIdx = next.findIndex(c => c.name === source.droppableId)
      const dstIdx = next.findIndex(c => c.name === destination.droppableId)
      if (srcIdx === -1 || dstIdx === -1) return prev

      const [moved] = next[srcIdx].threads.splice(source.index, 1)
      if (next[dstIdx].expanded) next[dstIdx].threads.splice(destination.index, 0, moved)
      else next[dstIdx].threads.push(moved)
      markChanged(next)
      return next
    })
  }

  function navigate(threadName: string) {
    if (isThreadViewMounted) {
      requestThreadNav(threadName)
    } else {
      router.push(`/thread/${threadName}`)
    }
    onClose()
  }

  const btnBase: React.CSSProperties = {
    display: 'block', width: '100%', background: 'none', border: 'none',
    cursor: 'pointer', textAlign: 'left',
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: 'rgb(var(--shadow-rgb) / 0.5)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.2s',
        }}
      />

      <div
        data-thread-picker
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 1201,
          width: 220, display: 'flex', flexDirection: 'column',
          background: 'var(--surface-raised)',
          borderRight: '1px solid rgb(var(--ink-rgb) / 0.08)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div style={{
          padding: '14px 12px 10px', borderBottom: '1px solid rgb(var(--ink-rgb) / 0.08)',
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: 1, textTransform: 'uppercase' }}>Threads</span>
          <button onClick={onClose} style={{ ...btnBase, width: 'auto', color: 'var(--ink-3)', fontSize: 16, padding: '0 2px', lineHeight: 1 }}>✕</button>
        </div>

        {loading ? (
          <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-3)' }}>Loading…</div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <DragDropContext
                onBeforeCapture={(b) => flushSync(() => setThreadDragging(!b.draggableId.startsWith('cat:')))}
                onDragEnd={onDragEnd}
              >
                <Droppable droppableId="categories" type="CATEGORY" direction="vertical">
                  {provided => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                      {categories.map((cat, catIdx) => (
                        <Draggable key={cat.name} draggableId={`cat:${cat.name}`} index={catIdx}>
                          {(catProvided, catSnapshot) => (
                            <div
                              ref={catProvided.innerRef}
                              {...catProvided.draggableProps}
                              style={{
                                ...catProvided.draggableProps.style,
                                background: catSnapshot.isDragging ? 'rgba(249,115,22,0.08)' : undefined,
                              }}
                            >
                              <div
                                {...catProvided.dragHandleProps}
                                style={{
                                  display: 'flex', alignItems: 'center',
                                  padding: '5px 8px 5px 10px',
                                  cursor: 'grab',
                                }}
                              >
                                <button
                                  onClick={() => toggleCategory(cat.name)}
                                  style={{
                                    ...btnBase, display: 'flex', alignItems: 'center', gap: 4,
                                    color: 'var(--ink-3)', fontSize: 11, fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: 0.8, flex: 1,
                                    padding: '2px 0',
                                  }}
                                >
                                  <CategoryChevron open={cat.expanded} />
                                  {cat.name}
                                </button>
                                {cat.name !== 'Other' && (
                                  <button
                                    onClick={e => { e.stopPropagation(); setDeleteTarget(cat.name) }}
                                    title={`Delete ${cat.name}`}
                                    style={{
                                      ...btnBase, width: 'auto', flexShrink: 0,
                                      color: 'var(--ink-3)', fontSize: 12, padding: '2px 4px',
                                      lineHeight: 1, borderRadius: 3,
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>

                              {(cat.expanded || threadDragging) && (
                                <Droppable droppableId={cat.name} type="THREAD">
                                  {(threadProvided, threadSnapshot) => (
                                    <div
                                      ref={threadProvided.innerRef}
                                      {...threadProvided.droppableProps}
                                      style={{
                                        minHeight: 4,
                                        background: threadSnapshot.isDraggingOver ? 'rgba(249,115,22,0.04)' : undefined,
                                      }}
                                    >
                                      {cat.expanded && cat.threads.map((thread, tIdx) => {
                                        const active = thread.name === currentThread
                                        return (
                                          <Draggable key={thread.uuid} draggableId={thread.uuid} index={tIdx}>
                                            {(tProvided, tSnapshot) => (
                                              <div
                                                ref={tProvided.innerRef}
                                                {...tProvided.draggableProps}
                                                {...tProvided.dragHandleProps}
                                                style={{
                                                  ...tProvided.draggableProps.style,
                                                  opacity: tSnapshot.isDragging ? 0.85 : 1,
                                                }}
                                              >
                                                <button
                                                  onClick={() => navigate(thread.name)}
                                                  style={{
                                                    ...btnBase,
                                                    display: 'flex', alignItems: 'center', gap: 5,
                                                    padding: '4px 10px 4px 22px',
                                                    background: active ? 'rgba(249,115,22,0.16)' : tSnapshot.isDragging ? 'rgb(var(--ink-rgb) / 0.06)' : 'none',
                                                    color: active ? 'var(--brand-ink)' : 'var(--ink-3)',
                                                    fontSize: 13,
                                                    opacity: active ? 1 : 0.82,
                                                    transition: 'background 0.1s, color 0.1s',
                                                    cursor: 'pointer',
                                                  }}
                                                  onMouseEnter={e => {
                                                    if (!active) {
                                                      e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.05)'
                                                      e.currentTarget.style.opacity = '1'
                                                    }
                                                  }}
                                                  onMouseLeave={e => {
                                                    if (!active) {
                                                      e.currentTarget.style.background = 'none'
                                                      e.currentTarget.style.opacity = '0.82'
                                                    }
                                                  }}
                                                >
                                                  <span style={{ width: 20, display: 'flex', justifyContent: 'center', flexShrink: 0, fontSize: 10, color: active ? 'var(--brand-ink)' : 'var(--ink-3)' }}>
                                                    {threadRanks[thread.uuid]
                                                      ? <RankIconBadge rank={threadRanks[thread.uuid].rank} division={threadRanks[thread.uuid].division} size="mini" />
                                                      : '#'}
                                                  </span>
                                                  {thread.threadOfTheDay && <span style={{ fontSize: 10, flexShrink: 0 }}>🔥</span>}
                                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {thread.title}
                                                  </span>
                                                </button>
                                              </div>
                                            )}
                                          </Draggable>
                                        )
                                      })}
                                      {threadDragging && (!cat.expanded || cat.threads.length === 0) && (
                                        <div style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', padding: '5px 0', border: '1px dashed rgb(var(--ink-rgb) / 0.18)', borderRadius: 6, margin: '2px 10px' }}>
                                          Drop here
                                        </div>
                                      )}
                                      {threadProvided.placeholder}
                                    </div>
                                  )}
                                </Droppable>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>

            <div style={{
              flexShrink: 0, borderTop: '1px solid rgb(var(--ink-rgb) / 0.08)',
              padding: '8px 10px', display: 'flex', gap: 6, alignItems: 'center',
            }}>
              <input
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCategory() }}
                placeholder="New category…"
                style={{
                  flex: 1, minWidth: 0, background: 'rgb(var(--ink-rgb) / 0.05)',
                  border: '1px solid rgb(var(--ink-rgb) / 0.1)', borderRadius: 6,
                  padding: '5px 8px', fontSize: 12, color: 'var(--ink-1)', outline: 'none',
                }}
              />
              {newCatName.trim() && (
                <button
                  onClick={addCategory}
                  style={{
                    background: '#f97316', border: 'none', borderRadius: 6,
                    color: '#fff', fontSize: 13, fontWeight: 700,
                    padding: '4px 10px', cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  +
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {deleteTarget && (
        <div
          onClick={() => setDeleteTarget(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1300,
            background: 'rgb(var(--shadow-rgb) / 0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'rgb(var(--surface-0-rgb) / 0.99)', border: '1px solid rgb(var(--ink-rgb) / 0.12)',
              borderRadius: 12, padding: '20px 24px', maxWidth: 340, width: '90%',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Delete "{deleteTarget}"?</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 16 }}>
              All threads in this category will be moved to Other.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid rgb(var(--ink-rgb) / 0.12)', background: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 12 }}
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(deleteTarget)}
                style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--danger)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

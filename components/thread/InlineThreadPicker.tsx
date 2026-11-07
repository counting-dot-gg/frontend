'use client'

import { fetchAllThreads } from '@/lib/threadList'
import { useRef, useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { DropResult } from '@hello-pangea/dnd'
import { DragDropContext, Droppable, Draggable, useIdlePreloadDnd } from '@/lib/dndLazy'
import { getSocket } from '@/lib/socket'
import CategoryChevron from './CategoryChevron'
import { RankIconBadge } from '@/components/rank/RankIconBadge'
import { useThreadRanks } from '@/components/rank/useThreadRanks'
import { useThreadNav } from '@/app/providers'
import type { MiscSettings, CategoryWithoutFullThreads } from '@/lib/types'
import { LC_THREAD_NAME, LC_THREAD_TITLE, LC_THREAD_UUID } from '@/lib/reddit'

const INLINE_FAVORITES = ['main', 'double_counting', 'bars', 'slow', 'no_mistakes']
const INLINE_OTHER_OVERRIDES = ['no_counting', LC_THREAD_NAME]

const LIVECOUNTING_THREAD: InlineThread = {
  uuid: LC_THREAD_UUID,
  name: LC_THREAD_NAME,
  title: LC_THREAD_TITLE,
  threadOfTheDay: false,
  allowDoublePosts: true,
  resetOnMistakes: false,
}

const SELF_ECHO_WINDOW_MS = 3000

function withLivecounting(threads: InlineThread[]): InlineThread[] {
  return threads.some(t => t.uuid === LC_THREAD_UUID) ? threads : [...threads, LIVECOUNTING_THREAD]
}

interface InlineThread { uuid: string; name: string; title: string; threadOfTheDay: boolean; allowDoublePosts: boolean; resetOnMistakes: boolean }
interface InlineCategory { name: string; threads: InlineThread[]; expanded: boolean }

function buildInlineCategories(threads: InlineThread[]): InlineCategory[] {
  const favs = threads.filter(t => INLINE_FAVORITES.includes(t.name))
  const traditional = threads.filter(t => !INLINE_OTHER_OVERRIDES.includes(t.name) && !favs.includes(t) && !t.allowDoublePosts && !t.resetOnMistakes)
  const double = threads.filter(t => !INLINE_OTHER_OVERRIDES.includes(t.name) && ![...favs, ...traditional].includes(t) && t.allowDoublePosts && !t.resetOnMistakes)
  const noMistakes = threads.filter(t => !INLINE_OTHER_OVERRIDES.includes(t.name) && ![...favs, ...traditional, ...double].includes(t) && t.resetOnMistakes)
  const other = threads.filter(t => ![...favs, ...traditional, ...double, ...noMistakes].includes(t))
  return [
    { name: 'Favorites', threads: favs, expanded: true },
    { name: 'Traditional', threads: traditional, expanded: true },
    { name: 'Double Counting', threads: double, expanded: false },
    { name: 'No Mistakes', threads: noMistakes, expanded: false },
    { name: 'Other', threads: other, expanded: false },
  ].filter(c => c.threads.length > 0 || c.name === 'Other')
}

function buildInlineFromMiscSettings(allThreads: InlineThread[], cats: CategoryWithoutFullThreads[]): InlineCategory[] {
  const result: InlineCategory[] = cats.map(cat => ({
    name: cat.name,
    expanded: cat.expanded,
    threads: cat.threadUUIDs.map(uuid => allThreads.find(t => t.uuid === uuid)).filter((t): t is InlineThread => t !== undefined),
  }))
  if (!result.find(c => c.name === 'Other')) result.push({ name: 'Other', threads: [], expanded: false })
  const placed = new Set(result.flatMap(c => c.threads.map(t => t.uuid)))
  const uncategorized = allThreads.filter(t => !placed.has(t.uuid))
  return result.map(c => c.name === 'Other' ? { ...c, threads: [...c.threads, ...uncategorized] } : c)
}


export default function InlineThreadPicker({ currentThreadName, initialMiscSettings, username }: { currentThreadName: string; initialMiscSettings?: MiscSettings; username?: string }) {
  useIdlePreloadDnd(true)
  const threadRanks = useThreadRanks(username)
  const [allThreads, setAllThreads] = useState<InlineThread[]>([])
  const [categories, setCategories] = useState<InlineCategory[]>([])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const miscRef = useRef<MiscSettings | undefined>(initialMiscSettings)
  const lastUpdatedRef = useRef<number>(initialMiscSettings?.lastUpdated ?? 0)
  const lastChangeRef = useRef<number>(0)
  const [newCatName, setNewCatName] = useState('')
  const [threadDragging, setThreadDragging] = useState(false)
  const [hoveredCat, setHoveredCat] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { requestThreadNav, isThreadViewMounted } = useThreadNav()
  const router = useRouter()

  const goToThread = useCallback((name: string) => {
    if (isThreadViewMounted) requestThreadNav(name)
    else router.push(`/thread/${name}`)
  }, [isThreadViewMounted, requestThreadNav, router])

  useEffect(() => {
    fetchAllThreads<InlineThread>()
      .then((fetched: InlineThread[]) => {
        const threads = withLivecounting(fetched)
        setAllThreads(threads)
        const ms = miscRef.current
        const cats = ms?.categories?.length ? buildInlineFromMiscSettings(threads, ms.categories) : buildInlineCategories(threads)
        setCategories(cats)
        setCollapsed(new Set(cats.filter(c => !c.expanded).map(c => c.name)))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const socket = getSocket()
    const handler = (ms: MiscSettings) => {
      miscRef.current = ms
      if (typeof ms.lastUpdated === 'number') lastUpdatedRef.current = ms.lastUpdated
      if (Date.now() - lastChangeRef.current < SELF_ECHO_WINDOW_MS) return
      setAllThreads(prev => {
        prev = withLivecounting(prev)
        const cats = ms.categories?.length ? buildInlineFromMiscSettings(prev, ms.categories) : buildInlineCategories(prev)
        setCategories(cats)
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

  function toggle(name: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return

      const target = e.target as HTMLElement | null
      if (target?.tagName === 'SELECT') return

      let catIdx = -1
      let threadIdx = -1
      categories.forEach((cat, ci) => {
        const ti = cat.threads.findIndex(t => t.name === currentThreadName)
        if (ti !== -1) { catIdx = ci; threadIdx = ti }
      })
      if (catIdx === -1) return

      let next: InlineThread | undefined
      if (e.key === 'ArrowUp') {
        if (threadIdx > 0) {
          next = categories[catIdx].threads[threadIdx - 1]
        } else if (catIdx > 0) {
          const prevCat = categories[catIdx - 1]
          if (prevCat.threads.length > 0) next = prevCat.threads[prevCat.threads.length - 1]
        }
      } else {
        if (threadIdx < categories[catIdx].threads.length - 1) {
          next = categories[catIdx].threads[threadIdx + 1]
        } else if (catIdx < categories.length - 1) {
          const nextCat = categories[catIdx + 1]
          if (nextCat.threads.length > 0) next = nextCat.threads[0]
        }
      }

      if (next) {
        e.preventDefault()
        goToThread(next.name)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [categories, currentThreadName, goToThread])

  const persistCategories = useCallback((cats: InlineCategory[]) => {
    lastChangeRef.current = Date.now()
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const mapped: CategoryWithoutFullThreads[] = cats.map(c => ({
        name: c.name,
        expanded: !collapsed.has(c.name),
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
  }, [collapsed])

  function onDragEnd(result: DropResult) {
    setThreadDragging(false)
    const { source, destination, type } = result
    if (!destination) return

    if (type === 'CATEGORY') {
      setCategories(prev => {
        const next = Array.from(prev)
        const [moved] = next.splice(source.index, 1)
        next.splice(destination.index, 0, moved)
        persistCategories(next)
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
      if (!collapsed.has(next[dstIdx].name)) next[dstIdx].threads.splice(destination.index, 0, moved)
      else next[dstIdx].threads.push(moved)
      persistCategories(next)
      return next
    })
  }

  function deleteCategory(name: string) {
    setCategories(prev => {
      const doomed = prev.find(c => c.name === name)
      if (!doomed) return prev
      const next = prev
        .filter(c => c.name !== name)
        .map(c => c.name === 'Other' ? { ...c, threads: [...c.threads, ...doomed.threads] } : c)
      if (!next.some(c => c.name === 'Other')) {
        next.push({ name: 'Other', threads: doomed.threads, expanded: true })
      }
      persistCategories(next)
      return next
    })
  }

  function addCategory() {
    const trimmed = newCatName.trim()
    if (!trimmed) return
    if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setNewCatName('')
      return
    }
    setCategories(prev => {
      const next = [...prev, { name: trimmed, threads: [], expanded: true }]
      persistCategories(next)
      return next
    })
    setNewCatName('')
  }

  return (
    <DragDropContext
      onBeforeCapture={(b) => flushSync(() => setThreadDragging(!b.draggableId.startsWith('inline-cat:')))}
      onDragEnd={onDragEnd}
    >
      <Droppable droppableId="inline-categories" type="CATEGORY" direction="vertical">
        {provided => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            {categories.map((cat, catIdx) => {
              const open = !collapsed.has(cat.name)
              return (
                <Draggable key={cat.name} draggableId={`inline-cat:${cat.name}`} index={catIdx}>
                  {(catProvided, catSnapshot) => (
                    <div
                      ref={catProvided.innerRef}
                      {...catProvided.draggableProps}
                      style={{
                        ...catProvided.draggableProps.style,
                        marginBottom: 4,
                        background: catSnapshot.isDragging ? 'rgba(249,115,22,0.08)' : undefined,
                        borderRadius: 4,
                      }}
                    >
                      <div
                        {...catProvided.dragHandleProps}
                        onClick={() => toggle(cat.name)}
                        onMouseEnter={() => setHoveredCat(cat.name)}
                        onMouseLeave={() => setHoveredCat(null)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5, width: '100%',
                          cursor: 'grab', padding: '5px 0',
                          color: 'var(--ink-3)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8,
                          userSelect: 'none',
                        }}
                      >
                        <CategoryChevron open={open} />
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat.name}</span>
                        {cat.name !== 'Other' && (
                          <button
                            onClick={e => { e.stopPropagation(); deleteCategory(cat.name) }}
                            title={`Delete ${cat.name}`}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#444', fontSize: 12, padding: '2px 4px', lineHeight: 1,
                              borderRadius: 3, flexShrink: 0,
                              opacity: hoveredCat === cat.name ? 1 : 0,
                              transition: 'opacity 0.12s, color 0.12s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#444')}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      {(open || threadDragging) && (
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
                              {open && cat.threads.map((t, tIdx) => {
                                const active = t.name === currentThreadName
                                return (
                                  <Draggable key={t.uuid} draggableId={t.uuid} index={tIdx}>
                                    {(tProvided, tSnapshot) => (
                                      <div
                                        ref={tProvided.innerRef}
                                        {...tProvided.draggableProps}
                                        style={{
                                          ...tProvided.draggableProps.style,
                                          display: 'flex', alignItems: 'stretch', gap: 2,
                                          borderRadius: 4, overflow: 'hidden',
                                          background: active ? 'rgba(249,115,22,0.12)' : tSnapshot.isDragging ? 'rgb(var(--ink-rgb) / 0.06)' : 'none',
                                        }}
                                      >
                                        <div
                                          {...tProvided.dragHandleProps}
                                          style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            width: 20, flexShrink: 0, cursor: 'grab',
                                            color: active ? '#f97316' : '#666', fontSize: 15, fontWeight: 700,
                                          }}
                                        >
                                          {threadRanks[t.uuid]
                                            ? <RankIconBadge rank={threadRanks[t.uuid].rank} division={threadRanks[t.uuid].division} size="mini" />
                                            : '#'}
                                        </div>
                                        <a
                                          href={`/thread/${t.name}`}
                                          onClick={e => { e.preventDefault(); if (!active) goToThread(t.name) }}
                                          onMouseEnter={e => {
                                            if (!active) {
                                              e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.05)'
                                            }
                                          }}
                                          onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'none' }}
                                          style={{
                                            display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0,
                                            padding: '4px 4px 4px 2px', fontSize: 13.5,
                                            color: active ? '#f97316' : 'var(--ink-2)',
                                            textDecoration: 'none', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                                            cursor: active ? 'default' : 'pointer',
                                          }}
                                        >
                                          {t.threadOfTheDay && <span style={{ fontSize: 9, flexShrink: 0 }}>🔥</span>}
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                                        </a>
                                      </div>
                                    )}
                                  </Draggable>
                                )
                              })}
                              {threadDragging && (!open || cat.threads.length === 0) && (
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
              )
            })}
            {provided.placeholder}

            <div style={{ display: 'flex', gap: 6, padding: '8px 4px 4px' }}>
              <input
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCategory() } }}
                placeholder="New category…"
                style={{
                  flex: 1, minWidth: 0, background: 'rgb(var(--ink-rgb) / 0.05)',
                  border: '1px solid rgb(var(--ink-rgb) / 0.1)', borderRadius: 6,
                  padding: '4px 8px', fontSize: 12, color: 'var(--ink-1)', outline: 'none',
                }}
              />
              {newCatName.trim() && (
                <button
                  onClick={addCategory}
                  style={{
                    padding: '4px 10px', background: '#f97316', border: 'none',
                    borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  Add
                </button>
              )}
            </div>
          </div>
        )}
      </Droppable>
    </DragDropContext>
  )
}

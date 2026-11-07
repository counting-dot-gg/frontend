'use client'

import { useContext, useEffect, useRef, useState, useCallback } from 'react'
import type React from 'react'
import type { Socket } from 'socket.io-client'
import { formatTimestamp, formatFullTimestamp, standardizeCountFormat } from '@/lib/postHelpers'
import { PrefsContext } from './PrefsContext'
import { avatarUrl, buildCounterMap } from '@/lib/counterUtils'
import { renderMarkdown } from '@/lib/markdown'
import { hourBarKey, hourBarLabel } from '@/lib/hourBar'
import { useDayRollover } from '@/lib/useDayRollover'

import { API } from '@/lib/apiBase'

interface ChatPost {
  uuid: string
  rawText: string
  countContent?: string
  rawCount?: string
  comment?: string
  isValidCount: boolean
  stricken: boolean
  timestamp: string
  authorUUID: string
  authorUsername: string
  authorName: string
  authorColor: string
  authorEmoji?: string
  authorAvatarUrl?: string
  isCommentDeleted?: boolean
}

interface Counter {
  uuid: string
  username: string
  name: string
  discordId: string
  avatar: string
  color: string
  emoji?: string
}


function toChat(post: any, counters: Map<string, Counter>): ChatPost {
  const c = counters.get(post.authorUUID)
  return {
    uuid: post.uuid,
    rawText: post.rawText,
    countContent: post.countContent,
    rawCount: post.rawCount,
    comment: post.comment,
    isValidCount: post.isValidCount,
    stricken: post.stricken,
    timestamp: post.timestamp,
    authorUUID: post.authorUUID,
    authorUsername: c?.username ?? 'unknown',
    authorName: c?.name ?? c?.username ?? 'unknown',
    authorColor: c?.color ?? '#888888',
    authorEmoji: c?.emoji,
    authorAvatarUrl: c ? avatarUrl(c) : undefined,
    isCommentDeleted: post.isCommentDeleted,
  }
}

interface ChatsTabProps {
  threadName: string
  socket: Socket | null
  isLive: boolean
  viewerUUID?: string
  viewerRoles?: string[]
  validationType?: string
}

export default function ChatsTab({ threadName, socket, isLive, viewerUUID, viewerRoles, validationType }: ChatsTabProps) {
  const [chats, setChats] = useState<ChatPost[]>([])
  useDayRollover()
  const [loading, setLoading] = useState(true)
  const [loadedOldest, setLoadedOldest] = useState(false)
  const [loadedNewest, setLoadedNewest] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const chatsRef = useRef<ChatPost[]>([])
  const seenRef = useRef<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)

  const commit = useCallback((next: ChatPost[]) => {
    chatsRef.current = next
    setChats([...next])
  }, [])

  const canModerate = !!viewerRoles?.some(r => r === 'admin' || r === 'mod')

  const deleteChat = useCallback((uuid: string, skipConfirm = false) => {
    if (!socket) return
    if (!skipConfirm && !confirm('Delete this message?')) return
    socket.emit('deleteComment', { uuid })
  }, [socket])

  useEffect(() => {
    if (!isLive) return
    let cancelled = false
    setLoading(true)
    seenRef.current = new Set()

    fetch(`${API}/api/thread/getRecent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ thread_name: threadName, context: null, commentsOnly: true }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const counters = buildCounterMap<Counter>(data.counters)
        const posts: ChatPost[] = (data.recentCounts ?? []).map((p: any) => toChat(p, counters))
        posts.forEach(p => seenRef.current.add(p.uuid))
        chatsRef.current = posts
        setChats(posts)
        setLoadedOldest(data.isOldest ?? false)
        setLoadedNewest(data.isNewest ?? true)
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [threadName, isLive])

  useEffect(() => {
    if (!socket) return

    const onPost = (data: { post: any; counter: any }) => {
      const p = data.post
      if (!p.hasThreeCharComment) return
      if (seenRef.current.has(p.uuid)) return
      seenRef.current.add(p.uuid)

      const c = data.counter
      const chat: ChatPost = {
        uuid: p.uuid,
        rawText: p.rawText,
        countContent: p.countContent,
        rawCount: p.rawCount,
        comment: p.comment,
        isValidCount: p.isValidCount,
        stricken: p.stricken,
        timestamp: p.timestamp,
        authorUUID: p.authorUUID,
        authorUsername: c?.username ?? 'unknown',
        authorName: c?.name ?? c?.username ?? 'unknown',
        authorColor: c?.color ?? '#888888',
        authorEmoji: c?.emoji,
        authorAvatarUrl:
          c?.discordId && c?.avatar && c.avatar.length > 5
            ? `https://cdn.discordapp.com/avatars/${c.discordId}/${c.avatar}`
            : undefined,
      }
      const next = [chat, ...chatsRef.current].slice(0, 50)
      commit(next)
    }

    const onDeleteComment = (serverPost: any) => {
      const next = chatsRef.current.map(c =>
        c.uuid === serverPost.uuid ? { ...c, isCommentDeleted: true, comment: undefined } : c
      )
      commit(next)
    }

    const onLoadOldChats = (data: { recentCounts: any[]; counters: Counter[]; isOldest?: boolean; isNewest?: boolean }) => {
      const counters = buildCounterMap<Counter>(data.counters)
      const fresh = (data.recentCounts ?? [])
        .filter((p: any) => !seenRef.current.has(p.uuid))
        .map((p: any) => { seenRef.current.add(p.uuid); return toChat(p, counters) })
      const next = [...chatsRef.current, ...fresh]
      commit(next)
      if (data.isOldest) setLoadedOldest(true)
      if (data.isNewest) setLoadedNewest(true)
      setLoadingOlder(false)
    }

    const onLoadNewChats = (data: { recentCounts: any[]; counters: Counter[]; isOldest?: boolean; isNewest?: boolean }) => {
      const counters = buildCounterMap<Counter>(data.counters)
      const fresh = (data.recentCounts ?? [])
        .filter((p: any) => !seenRef.current.has(p.uuid))
        .map((p: any) => { seenRef.current.add(p.uuid); return toChat(p, counters) })
      const next = [...fresh, ...chatsRef.current]
      commit(next)
      if (data.isOldest) setLoadedOldest(true)
      if (data.isNewest) setLoadedNewest(true)
    }

    socket.on('post', onPost)
    socket.on('deleteComment', onDeleteComment)
    socket.on('loadOldChats', onLoadOldChats)
    socket.on('loadNewChats', onLoadNewChats)

    return () => {
      socket.off('post', onPost)
      socket.off('deleteComment', onDeleteComment)
      socket.off('loadOldChats', onLoadOldChats)
      socket.off('loadNewChats', onLoadNewChats)
    }
  }, [socket, commit])

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    atBottomRef.current = distFromBottom < 60
    if (distFromBottom < 120 && !loadingOlder && !loadedOldest && socket && isLive) {
      const oldest = chatsRef.current[chatsRef.current.length - 1]
      if (oldest) {
        setLoadingOlder(true)
        socket.emit('getOlderChats', { thread_name: threadName, uuid: oldest.uuid })
      }
    }
  }, [loadingOlder, loadedOldest, socket, isLive, threadName])

  if (loading) {
    return <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-3)' }}>Loading chats…</div>
  }

  if (chats.length === 0) {
    return <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-3)' }}>No chats yet. Post a count with a comment to start.</div>
  }

  const rows: React.ReactNode[] = []
  let lastHourKey = ''
  for (const chat of chats) {
    const key = hourBarKey(chat.timestamp)
    if (key !== lastHourKey) {
      lastHourKey = key
      rows.push(<HourBar key={`bar-${key}`} label={hourBarLabel(chat.timestamp)} />)
    }
    rows.push(
      <ChatRow
        key={chat.uuid}
        chat={chat}
        canDelete={!chat.isCommentDeleted && (canModerate || (!!viewerUUID && chat.authorUUID === viewerUUID))}
        onDelete={deleteChat}
        validationType={validationType}
      />
    )
  }

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      style={{ display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto', flex: 1 }}
    >
      {rows}
      {!loadedOldest && (
        <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--ink-3)', textAlign: 'center' }}>
          {loadingOlder ? 'Loading…' : 'Scroll down for older chats'}
        </div>
      )}
    </div>
  )
}

function HourBar({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', margin: '6px 12px', userSelect: 'none' }}>
      <div style={{ flexGrow: 1, height: 0, borderTop: '1px solid rgb(var(--ink-rgb) / 0.15)' }} />
      <span style={{ margin: '0 8px', fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flexGrow: 1, height: 0, borderTop: '1px solid rgb(var(--ink-rgb) / 0.15)' }} />
    </div>
  )
}

function ChatRow({ chat, canDelete, onDelete, validationType }: {
  chat: ChatPost
  canDelete: boolean
  onDelete: (uuid: string, skipConfirm?: boolean) => void
  validationType?: string
}) {
  const [hover, setHover] = useState(false)
  const prefs = useContext(PrefsContext)
  const color = chat.authorColor || '#888888'
  const nameDisplay = chat.authorEmoji
    ? `${chat.authorEmoji} ${chat.authorName} ${chat.authorEmoji}`
    : chat.authorName
  const tsLabel = chat.timestamp ? formatTimestamp(chat.timestamp, 'Seconds') : ''
  const tsFull = chat.timestamp ? formatFullTimestamp(chat.timestamp, 'Seconds') : ''

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', gap: 8, padding: '6px 12px',
        borderBottom: '1px solid rgb(var(--ink-rgb) / 0.04)',
      }}>
      <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', marginTop: 2 }}>
        {chat.authorAvatarUrl ? (
          <img src={chat.authorAvatarUrl} alt="" width={28} height={28} style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{
            width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: color + '33', fontSize: 9, fontWeight: 700, color,
          }}>
            {chat.authorEmoji ?? chat.authorUsername.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
          <a
            href={`/counter/${chat.authorUsername}`}
            style={{ fontSize: 12, fontWeight: 700, color, textDecoration: 'none', flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            {nameDisplay}
          </a>
          {chat.countContent && (
            <span style={{
              fontSize: 11, color: 'var(--ink-3)', fontFamily: 'monospace',
              textDecoration: chat.stricken ? 'line-through' : undefined,
            }}>
              {standardizeCountFormat(chat.countContent, prefs?.pref_standardize_format ?? 'Disabled', validationType)}
            </span>
          )}
          <span title={tsFull} style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 'auto', flexShrink: 0, fontFamily: 'monospace' }}>{tsLabel}</span>
          {canDelete && (
            <button
              onClick={e => onDelete(chat.uuid, e.shiftKey)}
              title="Delete (hold Shift to skip the confirmation)"
              aria-label="Delete message"
              style={{
                visibility: hover ? 'visible' : 'hidden',
                background: 'none', border: 'none', color: 'var(--danger)',
                cursor: 'pointer', fontSize: 11, padding: '0 2px', flexShrink: 0, lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>
        <div style={{ fontSize: 13, color: chat.isCommentDeleted ? 'var(--ink-3)' : 'var(--ink-2)', fontStyle: chat.isCommentDeleted ? 'italic' : undefined, wordBreak: 'break-word' }}>
          {chat.isCommentDeleted
            ? '[deleted]'
            : chat.comment
              ? <span className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(chat.comment, 18) }} />
              : null}
        </div>
      </div>
    </div>
  )
}

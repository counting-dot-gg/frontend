'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { getSocket } from '@/lib/socket'
import { publishChatPanel, subscribeChatPanel, readOpenNonce, readOpenTab } from '@/lib/chatPanel'
import FeatsPanel from './FeatsPanel'
import { useFeatsEnabled } from '@/lib/feats'
import { useEdgeLoader } from '@/lib/useEdgeLoader'
import { notifyRateLimited } from '@/lib/rateLimitNotice'
import { formatTimestamp } from '@/lib/postHelpers'
import { avatarUrl, buildCounterMap } from '@/lib/counterUtils'
import { renderMarkdown } from '@/lib/markdown'
import { useTeamChat, type RoomChat } from './useTeamChat'
import { teamColor } from '@/lib/bingo'
import type { SessionUser } from '@/lib/types'

import { API } from '@/lib/apiBase'
const THREAD = 'no_counting'
const MAX_MESSAGES = 50
const MAX_CHAT_HISTORY = 500
const SEND_COOLDOWN_MS = 500
const EXPANDED_HEIGHT = 360
const HEIGHT_KEY = 'cgg-chat-height'
const clampHeight = (h: number) => Math.round(Math.max(160, Math.min(h, (typeof window === 'undefined' ? 900 : window.innerHeight) - 160)))

interface Counter {
  uuid: string
  username: string
  name: string
  discordId: string
  avatar: string
  color: string
  emoji?: string
}

interface ChatMessage {
  uuid: string
  comment?: string
  timestamp: string
  authorUUID: string
  authorUsername: string
  authorName: string
  authorColor: string
  authorEmoji?: string
  authorAvatarUrl?: string
  deleted?: boolean
}

function toChatMessage(post: any, counters: Map<string, Counter>): ChatMessage {
  const c = counters.get(post.authorUUID)
  return {
    uuid: post.uuid,
    comment: post.comment,
    timestamp: post.timestamp,
    authorUUID: post.authorUUID,
    authorUsername: c?.username ?? 'unknown',
    authorName: c?.name ?? c?.username ?? 'unknown',
    authorColor: c?.color ?? '#888888',
    authorEmoji: c?.emoji,
    authorAvatarUrl: c ? avatarUrl(c) : undefined,
    deleted: post.isCommentDeleted ?? false,
  }
}

interface SiteChatProps {
  user?: SessionUser | null
  initialOpen?: boolean
}

export default function SiteChat({ user, initialOpen = false }: SiteChatProps) {
  const [listHeight, setListHeight] = useState(EXPANDED_HEIGHT)
  const [canResize, setCanResize] = useState(false)
  useEffect(() => {
    setCanResize(window.matchMedia('(pointer: fine)').matches)
    try {
      const saved = Number(localStorage.getItem(HEIGHT_KEY))
      if (saved > 0) setListHeight(clampHeight(saved))
    } catch {}
  }, [])
  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = listHeight
    let h = startH
    const move = (ev: PointerEvent) => { h = clampHeight(startH + (startY - ev.clientY)); setListHeight(h) }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.userSelect = ''
      try { localStorage.setItem(HEIGHT_KEY, String(h)) } catch {}
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const chatDefault = user?.userPrefs?.pref_chat_default ?? 'Hidden'
  const [superCollapsed, setSuperCollapsed] = useState(initialOpen ? false : chatDefault === 'Hidden')
  const [expanded, setExpanded] = useState(initialOpen ? true : chatDefault === 'Open')
  const [status, setStatus] = useState<'connecting' | 'live' | 'disconnected'>('connecting')
  const [watcherCount, setWatcherCount] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [lastReadUUID, setLastReadUUID] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [tab, setTab] = useState<'site' | 'team' | 'game' | 'feats'>(() =>
    initialOpen && readOpenTab() === 'feats' ? 'feats' : 'site')
  const [teamInput, setTeamInput] = useState('')
  const [gameInput, setGameInput] = useState('')

  const messagesRef = useRef<ChatMessage[]>([])
  const seenRef = useRef<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  const [loadedOldestChat, setLoadedOldestChat] = useState(false)
  const anchorRef = useRef<number | null>(null)
  const capRef = useRef(MAX_MESSAGES)
  const atBottomRef = useRef(true)
  const lastSendRef = useRef(0)
  const hasOpenedRef = useRef(false)
  const hasConnectedOnceRef = useRef(false)
  const backfillingRef = useRef(false)

  const bingoChat = useTeamChat(!!user, tab)
  const featsOn = useFeatsEnabled(user?.userPrefs?.pref_milestones !== false)

  useEffect(() => {
    publishChatPanel({ hidden: superCollapsed, unread: unreadCount })
  }, [superCollapsed, unreadCount])


  useEffect(() => {
    if ((tab === 'team' || tab === 'game') && !bingoChat[tab].available) setTab('site')
    if (tab === 'feats' && !featsOn) setTab('site')
  }, [bingoChat, tab, featsOn])

  const roles = user?.counter?.roles ?? []
  const canPost = roles.includes('counter') && !roles.includes('banned') && !roles.includes('muted')
  const canModerate = roles.includes('admin') || roles.includes('mod')

  const commit = useCallback((next: ChatMessage[]) => {
    messagesRef.current = next
    setMessages([...next])
  }, [])

  const backfill = useCallback(async () => {
    if (backfillingRef.current) return
    const cursor = messagesRef.current[messagesRef.current.length - 1]
    if (!cursor) return
    backfillingRef.current = true
    try {
      let cursorUUID = cursor.uuid
      for (let i = 0; i < 20; i++) {
        const params = new URLSearchParams({
          thread_name: THREAD, uuid: cursorUUID, limit: '50', commentsOnly: 'true',
        })
        const res = await fetch(`${API}/api/thread/loadNewerCounts?${params}`, { credentials: 'include' })
        if (!res.ok) break
        const data = await res.json()
        const counters = buildCounterMap<Counter>(data.counters)
        const fresh: ChatMessage[] = (data.counts ?? [])
          .filter((p: any) => !seenRef.current.has(p.uuid))
          .map((p: any) => toChatMessage(p, counters))
        if (fresh.length > 0) {
          fresh.forEach(m => seenRef.current.add(m.uuid))
          const next = [...messagesRef.current, ...fresh].slice(-capRef.current)
          commit(next)
          if (!hasOpenedRef.current) setUnreadCount(n => n + fresh.length)
          cursorUUID = fresh[fresh.length - 1].uuid
        }
        if (data.loadedNewest || fresh.length === 0) break
      }
    } catch {
    } finally {
      backfillingRef.current = false
    }
  }, [commit])

  const loadOlderChat = useCallback(async () => {
    const oldest = messagesRef.current[0]
    const el = scrollRef.current
    if (!oldest || !el) return

    const params = new URLSearchParams({
      thread_name: THREAD, uuid: oldest.uuid, limit: '50', commentsOnly: 'true',
    })
    const res = await fetch(`${API}/api/thread/loadOlderCounts?${params}`, { credentials: 'include' })
    if (res.status === 429) {
      notifyRateLimited(Number(res.headers.get('retry-after')) || undefined)
      return
    }
    if (!res.ok) return
    const data = await res.json()

    const counters = buildCounterMap<Counter>(data.counters)
    const older: ChatMessage[] = (data.counts ?? [])
      .filter((p: any) => !seenRef.current.has(p.uuid))
      .map((p: any) => toChatMessage(p, counters))
      .reverse()

    if (older.length > 0) {
      older.forEach(m => seenRef.current.add(m.uuid))
      anchorRef.current = el.scrollHeight - el.scrollTop
      capRef.current = Math.min(capRef.current + older.length, MAX_CHAT_HISTORY)
      commit([...older, ...messagesRef.current].slice(-capRef.current))
    }

    if (data.loadedOldest || older.length === 0) setLoadedOldestChat(true)
  }, [commit])

  const { loading: loadingOlderChat } = useEdgeLoader({
    root: scrollRef,
    edge: 'top',
    margin: 300,
    enabled: expanded && tab === 'site' && !loading,
    exhausted: loadedOldestChat,
    onLoad: loadOlderChat,
  })

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || anchorRef.current === null) return
    el.scrollTop = el.scrollHeight - anchorRef.current
    anchorRef.current = null
  }, [messages])

  useEffect(() => {
    const socket = getSocket()

    const onConnect = () => {
      setStatus('live')
      socket.emit('chat_watch')
      if (hasConnectedOnceRef.current) {
        backfill()
      } else {
        hasConnectedOnceRef.current = true
      }
    }
    const onDisconnect = () => setStatus('disconnected')
    const onWatcherCount = (n: number) => setWatcherCount(n)
    const onLastRead = (uuid: string | null) => setLastReadUUID(uuid)

    const onChatPost = (data: { post: any; counter: Counter }) => {
      const c = data.counter
      if (!seenRef.current.has(data.post.uuid)) {
        seenRef.current.add(data.post.uuid)
        const msg = toChatMessage(data.post, new Map([[c.uuid, c]]))
        const next = [...messagesRef.current, msg].slice(-capRef.current)
        commit(next)
        if (!hasOpenedRef.current) setUnreadCount(n => n + 1)
      }
    }

    const onDeleteComment = (serverPost: any) => {
      const next = messagesRef.current.map(m =>
        m.uuid === serverPost.uuid ? { ...m, deleted: true, comment: undefined } : m
      )
      commit(next)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('chat_watcher_count', onWatcherCount)
    socket.on('chat_last_read', onLastRead)
    socket.on('chat_post', onChatPost)
    socket.on('deleteComment', onDeleteComment)

    if (!socket.connected) {
      socket.connect()
    } else {
      onConnect()
    }

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('chat_watcher_count', onWatcherCount)
      socket.off('chat_last_read', onLastRead)
      socket.off('chat_post', onChatPost)
      socket.off('deleteComment', onDeleteComment)
    }
  }, [commit, backfill])

  useEffect(() => {
    let cancelled = false
    fetch(`${API}/api/thread/getRecent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ thread_name: THREAD, context: null, commentsOnly: true }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const counters = buildCounterMap<Counter>(data.counters)
        const posts: ChatMessage[] = (data.recentCounts ?? [])
          .map((p: any) => toChatMessage(p, counters))
          .reverse()
          .slice(-capRef.current)
        posts.forEach(p => seenRef.current.add(p.uuid))
        messagesRef.current = posts
        setMessages(posts)
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!expanded) return
    if (!atBottomRef.current) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, expanded])

  useLayoutEffect(() => {
    if (!expanded || tab !== 'site' || loading) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    atBottomRef.current = true
  }, [expanded, tab, loading])

  const onChatScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }, [])

  const open = useCallback(() => {
    setSuperCollapsed(false)
    setExpanded(true)
    hasOpenedRef.current = true
    setUnreadCount(0)
    const newest = messagesRef.current[messagesRef.current.length - 1]
    if (newest) {
      getSocket().emit('chat_mark_read', newest.uuid)
      setLastReadUUID(newest.uuid)
    }
  }, [])

  useEffect(() => {
    let seen = readOpenNonce()
    return subscribeChatPanel(() => {
      const n = readOpenNonce()
      if (n !== seen) {
        seen = n
        open()
        if (readOpenTab() === 'feats') setTab('feats')
      }
    })
  }, [open])

  const collapse = useCallback(() => {
    setExpanded(false)
    hasOpenedRef.current = false
  }, [])

  const superCollapse = useCallback(() => {
    setSuperCollapsed(true)
    setExpanded(false)
    hasOpenedRef.current = false
  }, [])

  const send = useCallback(() => {
    const text = inputValue.trim()
    if (!text || sending) return
    const now = Date.now()
    if (now - lastSendRef.current < SEND_COOLDOWN_MS) return
    lastSendRef.current = now

    const socket = getSocket()
    const post_hash = (Math.random() * 100000000000000000).toString(36)
    socket.emit('post', { thread_name: THREAD, text, post_hash })
    setInputValue('')
    setSending(true)
    setTimeout(() => setSending(false), SEND_COOLDOWN_MS)
  }, [inputValue, sending])

  const deleteMessage = useCallback((uuid: string, skipConfirm = false) => {
    if (!skipConfirm && !confirm('Delete this message?')) return
    getSocket().emit('deleteComment', { uuid })
  }, [])

  if (superCollapsed) return null

  const lastMessage = messages[messages.length - 1]
  const statusColor = status === 'live' ? 'var(--success)' : status === 'disconnected' ? 'var(--danger)' : '#3b82f6'

  return (
    <div style={{
      position: 'fixed', bottom: 0, right: 8, zIndex: 1400,
      width: 320, maxWidth: 'calc(100vw - 16px)',
      background: 'var(--surface-raised)', border: '1px solid rgb(var(--ink-rgb) / 0.12)', borderBottom: 'none',
      borderRadius: '8px 8px 0 0', boxShadow: '0 -4px 24px rgb(var(--shadow-rgb) / 0.4)',
      display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)',
    }}>
      {expanded && canResize && (
        <div
          onPointerDown={startResize}
          aria-hidden
          style={{ position: 'absolute', top: -4, left: 0, right: 0, height: 8, cursor: 'ns-resize', zIndex: 1 }}
        />
      )}
      <div
        onClick={() => (expanded ? undefined : open())}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, minHeight: 36,
          padding: '6px 8px 6px 12px', background: 'var(--primary)', color: 'var(--primary-foreground)',
          borderRadius: '8px 8px 0 0', cursor: expanded ? 'default' : 'pointer',
        }}
      >
        {!expanded ? (
          <>
            <span style={{ fontWeight: 700, fontSize: 13, flexShrink: 0 }}>Chat</span>
            {unreadCount > 0 && (
              <span style={{
                minWidth: 16, height: 16, borderRadius: 8, background: 'var(--danger)', color: '#fff',
                fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px', flexShrink: 0,
              }}>
                {unreadCount > 50 ? '50+' : unreadCount}
              </span>
            )}
            {lastMessage && (
              <span style={{
                fontSize: 12, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', flex: 1, minWidth: 0,
              }}>
                <b>{lastMessage.authorName}:</b> {lastMessage.deleted ? '[deleted]' : lastMessage.comment}
              </span>
            )}
          </>
        ) : (
          <>
            <span style={{ fontWeight: 700, fontSize: 13, flexShrink: 0 }}>Chat</span>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: statusColor, flexShrink: 0 }} />
            <span style={{ fontSize: 11, opacity: 0.85, flexShrink: 0 }}>{status}</span>
            <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 'auto', flexShrink: 0 }}>
              {watcherCount != null ? `${watcherCount} watching` : ''}
            </span>
          </>
        )}
        <div style={{ display: 'flex', gap: 2, flexShrink: 0, marginLeft: expanded ? 4 : 0 }}>
          <button
            onClick={e => { e.stopPropagation(); expanded ? collapse() : open() }}
            aria-label={expanded ? 'Collapse chat' : 'Expand chat'}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 4, fontSize: 12, opacity: 0.85 }}
          >
            {expanded ? '▾' : '▴'}
          </button>
          {expanded && (
            <button
              onClick={e => { e.stopPropagation(); superCollapse() }}
              aria-label="Close chat"
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 4, fontSize: 12, opacity: 0.85 }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {expanded && (featsOn || bingoChat.team.available || bingoChat.game.available) && (
        <div style={{
          display: 'flex', borderBottom: '1px solid rgb(var(--ink-rgb) / 0.08)',
          background: 'rgb(var(--ink-rgb) / 0.03)',
        }}>
          {([
            { key: 'site' as const, label: 'Site', badge: 0 },
            ...[bingoChat.team, bingoChat.game]
              .filter(r => r.available)
              .map(r => ({ key: r.scope, label: r.name, badge: r.unread })),
            ...(featsOn ? [{ key: 'feats' as const, label: '★', badge: 0 }] : []),
          ]).map(t => (
            <button
              key={t.key}
              aria-label={t.key === 'feats' ? 'Accomplishments' : undefined}
              onClick={() => { setTab(t.key); if (t.key === 'team' || t.key === 'game') bingoChat[t.key].markRead() }}
              style={{
                flex: t.key === 'feats' ? '0 0 40px' : 1, padding: '7px 0', border: 'none', cursor: 'pointer',
                background: tab === t.key ? 'rgb(var(--ink-rgb) / 0.07)' : 'transparent',
                color: tab === t.key ? 'var(--ink-1)' : 'var(--ink-3)',
                fontWeight: 700, fontSize: 12,
                borderBottom: tab === t.key ? '2px solid #f97316' : '2px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
              {t.badge > 0 && (
                <span style={{
                  minWidth: 15, height: 15, borderRadius: 8, background: 'var(--danger)', color: '#fff',
                  fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', padding: '0 3px',
                }}>
                  {t.badge > 50 ? '50+' : t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {expanded && tab === 'feats' && <FeatsPanel height={listHeight + 49} />}

      {expanded && (tab === 'team' || tab === 'game') && (
        <TeamPanel
          key={tab}
          height={listHeight}
          chat={bingoChat[tab]}
          value={tab === 'team' ? teamInput : gameInput}
          onChange={tab === 'team' ? setTeamInput : setGameInput}
          canPost={canPost}
          meUuid={user?.counter?.uuid ?? user?.uuid ?? null}
        />
      )}

      {expanded && tab === 'site' && (
        <>
          <div
            ref={scrollRef}
            onScroll={onChatScroll}
            style={{ height: listHeight, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '4px 0' }}
          >
            {!loading && messages.length > 0 && (
              <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--ink-3)', textAlign: 'center', flexShrink: 0 }}>
                {loadingOlderChat
                  ? 'Loading older messages…'
                  : loadedOldestChat
                    ? 'Beginning of chat'
                    : ' '}
              </div>
            )}
            {loading ? (
              <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-3)', textAlign: 'center' }}>Loading…</div>
            ) : messages.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-3)', textAlign: 'center' }}>No messages yet.</div>
            ) : (
              messages.map((m, i) => (
                <div key={m.uuid}>
                  {lastReadUUID && i > 0 && messages[i - 1].uuid === lastReadUUID && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '4px 12px' }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--danger)' }} />
                      <span style={{ fontSize: 9, color: 'var(--danger)', fontWeight: 700, textTransform: 'uppercase' }}>New</span>
                      <div style={{ flex: 1, height: 1, background: 'var(--danger)' }} />
                    </div>
                  )}
                  <ChatRow message={m} canDelete={canModerate || m.authorUUID === user?.uuid} onDelete={deleteMessage} />
                </div>
              ))
            )}
          </div>

          {user && canPost ? (
            <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: '1px solid rgb(var(--ink-rgb) / 0.08)' }}>
              <input
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }}
                placeholder="Message…"
                style={{
                  flex: 1, minWidth: 0, background: 'rgb(var(--ink-rgb) / 0.05)', border: '1px solid rgb(var(--ink-rgb) / 0.12)',
                  borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--ink-1)', outline: 'none',
                }}
              />
              <button
                onClick={send}
                disabled={!inputValue.trim() || sending}
                style={{
                  padding: '6px 12px', borderRadius: 6, border: 'none',
                  background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 12,
                  cursor: inputValue.trim() && !sending ? 'pointer' : 'default',
                  opacity: inputValue.trim() && !sending ? 1 : 0.5,
                }}
              >
                ➤
              </button>
            </div>
          ) : (
            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ink-3)', borderTop: '1px solid rgb(var(--ink-rgb) / 0.08)', textAlign: 'center' }}>
              {!user ? (
                <a href={process.env.NEXT_PUBLIC_LOGIN ?? '/api/auth/login'} style={{ color: '#f97316', textDecoration: 'none', fontWeight: 600 }}>
                  Log in to chat →
                </a>
              ) : roles.includes('banned') ? 'You are banned from chat.'
                : roles.includes('muted') ? 'You are muted.'
                : roles.includes('manual_verification_needed') ? 'Registration pending approval.'
                : (
                  <a href="/register" style={{ color: '#f97316', textDecoration: 'none', fontWeight: 600 }}>
                    Create your profile →
                  </a>
                )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TeamPanel({ chat, value, onChange, canPost, meUuid, height }: {
  chat: RoomChat
  height: number
  value: string
  onChange: (v: string) => void
  canPost: boolean
  meUuid: string | null
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [chat.messages])

  const submit = () => {
    const text = value.trim()
    if (!text) return
    if (chat.send(text)) onChange('')
  }

  return (
    <>
      <div
        ref={scrollRef}
        style={{ height, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '4px 0' }}
      >
        {chat.messages.map(m => (
          <div key={m.id} style={{ padding: '5px 12px' }}>
            <div style={{ display: 'flex', gap: 7, alignItems: 'baseline' }}>
              {chat.scope === 'game' && m.authorTeamName && (
                <span style={{
                  fontSize: 10, fontWeight: 700, flexShrink: 0, padding: '1px 5px', borderRadius: 4,
                  background: teamColor(m.authorTeamName).fill, color: teamColor(m.authorTeamName).ink,
                }}>
                  {m.authorTeamName}
                </span>
              )}
              <span style={{
                fontSize: 12, fontWeight: 700, flexShrink: 0,
                color: m.authorColor || (m.authorUuid === meUuid ? '#f97316' : '#9aa4b2'),
              }}>
                {m.authorUsername}
              </span>
              <time
                dateTime={new Date(m.timestamp).toISOString()}
                style={{ fontSize: 10, color: 'var(--ink-3)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
              >
                {formatTimestamp(m.timestamp, 'Seconds')}
              </time>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', wordBreak: 'break-word', marginTop: 1 }}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {chat.error && (
        <div style={{ padding: '4px 12px', fontSize: 11, color: 'var(--danger)' }}>{chat.error}</div>
      )}

      {canPost ? (
        <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: '1px solid rgb(var(--ink-rgb) / 0.08)' }}>
          <input
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
            placeholder={`Message ${chat.name}…`}
            maxLength={400}
            style={{
              flex: 1, minWidth: 0, background: 'rgb(var(--ink-rgb) / 0.05)',
              border: '1px solid rgb(var(--ink-rgb) / 0.12)', borderRadius: 6,
              padding: '6px 10px', fontSize: 13, color: 'var(--ink-1)', outline: 'none',
            }}
          />
          <button
            onClick={submit}
            disabled={!value.trim() || chat.sending}
            style={{
              padding: '6px 12px', borderRadius: 6, border: 'none',
              background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 12,
              cursor: value.trim() && !chat.sending ? 'pointer' : 'default', opacity: value.trim() && !chat.sending ? 1 : 0.5,
            }}
          >
            ➤
          </button>
        </div>
      ) : (
        <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ink-3)', borderTop: '1px solid rgb(var(--ink-rgb) / 0.08)', textAlign: 'center' }}>
          You can’t post right now.
        </div>
      )}
    </>
  )
}

function ChatRow({ message, canDelete, onDelete }: { message: ChatMessage; canDelete: boolean; onDelete: (uuid: string, skipConfirm?: boolean) => void }) {
  const [hover, setHover] = useState(false)
  const nameDisplay = message.authorEmoji ? `${message.authorEmoji} ${message.authorName} ${message.authorEmoji}` : message.authorName

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', gap: 8, padding: '5px 12px', alignItems: 'flex-start' }}
    >
      <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', marginTop: 2 }}>
        {message.authorAvatarUrl ? (
          <img src={message.authorAvatarUrl} alt="" width={22} height={22} style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{
            width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: message.authorColor + '33', fontSize: 8, fontWeight: 700, color: message.authorColor,
          }}>
            {message.authorEmoji ?? message.authorUsername.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <a
            href={`/counter/${message.authorUsername}`}
            style={{ fontSize: 12, fontWeight: 700, color: message.authorColor, textDecoration: 'none', flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            {nameDisplay}
          </a>
          {message.timestamp && (
            <time
              dateTime={new Date(Number(message.timestamp)).toISOString()}
              style={{
                fontSize: 10, color: '#6b7280', flexShrink: 0,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatTimestamp(message.timestamp, 'Seconds')}
            </time>
          )}
          {hover && canDelete && !message.deleted && (
            <button
              onClick={e => onDelete(message.uuid, e.shiftKey)}
              title="Delete (hold Shift to skip the confirmation)"
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 11, padding: 2, flexShrink: 0 }}
            >
              ✕
            </button>
          )}
        </div>
        <div style={{ fontSize: 13, color: message.deleted ? 'var(--ink-3)' : 'var(--ink-2)', fontStyle: message.deleted ? 'italic' : undefined, wordBreak: 'break-word' }}>
          {message.deleted
            ? '[deleted]'
            : message.comment
              ? <span className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(message.comment, 18) }} />
              : null}
        </div>
      </div>
    </div>
  )
}

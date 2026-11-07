'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LC_CHAT_THREAD_ID, fetchLiveThread, formatWithMs, hourKey, hourLabel, unmirrorChat, uuidv1ToMs } from '@/lib/reddit'
import { useEdgeLoader } from '@/lib/useEdgeLoader'
import { loadRedditUserColors, redditUserColor } from '@/lib/redditUserColors'
import { renderMarkdown } from '@/lib/markdown'
import { useDayRollover } from '@/lib/useDayRollover'

const MAX_CHATS = 100

interface ChatMsg {
  id: string
  author: string
  body: string
  timestamp: number
  stricken?: boolean
  sourceUrl?: string
}

function toChat(p: { id: string; author: string; body: string; stricken?: boolean }): ChatMsg {
  const real = unmirrorChat(p.author, p.body)
  return { id: p.id, author: real.author, body: real.body, sourceUrl: real.sourceUrl, stricken: !!p.stricken, timestamp: uuidv1ToMs(p.id) }
}

export default function RedditChatsTab({ redditAccess }: { redditAccess?: string }) {
  const [chats, setChats] = useState<ChatMsg[]>([])
  useDayRollover()
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [wsUrl, setWsUrl] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      loadRedditUserColors(),
      fetchLiveThread(LC_CHAT_THREAD_ID, 50, redditAccess),
    ])
      .then(([, { about, posts }]) => {
        if (cancelled) return
        if (about?.websocket_url) setWsUrl(about.websocket_url)
        else { setError('Reddit returned no websocket for the chat thread.'); setStatus('offline') }

        setChats(posts.map(toChat).slice(0, MAX_CHATS))
      })
      .catch(() => {
        if (cancelled) return
        setError('Could not load the Reddit chat thread.')
        setStatus('offline')
      })
    return () => { cancelled = true }
  }, [redditAccess])

  useEffect(() => {
    if (!wsUrl) return
    setStatus('connecting')
    const ws = new WebSocket(wsUrl)
    ws.addEventListener('open', () => setStatus('live'))
    ws.addEventListener('close', () => setStatus('offline'))
    ws.addEventListener('error', () => setStatus('offline'))
    ws.addEventListener('message', ev => {
      let msg: any
      try { msg = JSON.parse(ev.data) } catch { return }
      if (msg?.type === 'update') {
        const d = msg.payload?.data
        if (!d?.id) return
        setChats(prev =>
          prev.some(c => c.id === d.id)
            ? prev
            : [toChat(d), ...prev].slice(0, Math.max(MAX_CHATS, prev.length)),
        )
      } else if (msg?.type === 'strike' || msg?.type === 'delete') {
        const id = String(msg.payload ?? '').replace(/^LiveUpdate_/, '')
        setChats(prev =>
          msg.type === 'delete'
            ? prev.filter(c => c.id !== id)
            : prev.map(c => (c.id === id ? { ...c, stricken: true } : c)),
        )
      }
    })
    return () => ws.close()
  }, [wsUrl])

  const [exhausted, setExhausted] = useState(false)
  const loadOlder = useCallback(async () => {
    const oldest = chats[chats.length - 1]
    if (!oldest) return
    try {
      const { posts } = await fetchLiveThread(LC_CHAT_THREAD_ID, 50, redditAccess, `LiveUpdate_${oldest.id}`)
      const seen = new Set(chats.map(c => c.id))
      const fresh = posts.filter(p => !seen.has(p.id)).map(toChat)
      if (fresh.length === 0) { setExhausted(true); return }
      setChats(prev => [...prev, ...fresh.filter(c => !prev.some(x => x.id === c.id))])
    } catch {
    }
  }, [chats, redditAccess])
  const { loading: loadingOlder } = useEdgeLoader({
    root: scrollRef,
    edge: 'bottom',
    margin: 400,
    enabled: chats.length > 0 && !error,
    exhausted,
    onLoad: loadOlder,
  })

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && stickRef.current) el.scrollTop = 0
  }, [chats])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        ref={scrollRef}
        onScroll={e => {
          const el = e.currentTarget
          stickRef.current = el.scrollTop < 40
        }}
        style={{ flex: 1, overflowY: 'auto' }}
      >
        {error && <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
        {!error && chats.length === 0 && (
          <div style={{ padding: '10px 12px', fontSize: 12, color: '#666' }}>
            {status === 'connecting' ? 'Connecting to Reddit chat…' : 'No messages yet.'}
          </div>
        )}
        {chats.map((chat, i) => {
          const next = chats[i + 1]
          const bar = !next || hourKey(next.timestamp) !== hourKey(chat.timestamp)
            ? hourLabel(chat.timestamp)
            : null
          return (
            <div key={chat.id}>
              <ChatRow chat={chat} />
              {bar && <HourBar label={bar} />}
            </div>
          )
        })}
        {chats.length > 0 && (loadingOlder || exhausted) && (
          <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--ink-3)', textAlign: 'center' }}>
            {exhausted ? 'Start of the chat.' : 'Loading older messages…'}
          </div>
        )}
      </div>
    </div>
  )
}

function HourBar({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', margin: '6px 12px', userSelect: 'none' }}>
      <div style={{ flexGrow: 1, height: 0, borderTop: '1px solid rgb(var(--ink-rgb) / 0.15)' }} />
      <span style={{ margin: '0 8px', fontSize: 11, color: 'rgb(var(--ink-rgb) / 0.35)', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flexGrow: 1, height: 0, borderTop: '1px solid rgb(var(--ink-rgb) / 0.15)' }} />
    </div>
  )
}

function ChatRow({ chat }: { chat: ChatMsg }) {
  const color = redditUserColor(chat.author)
  return (
    <div style={{
      display: 'flex', gap: 8, padding: '6px 12px',
      borderBottom: '1px solid rgb(var(--ink-rgb) / 0.04)',
    }}>
      <div style={{
        flexShrink: 0, width: 28, height: 28, borderRadius: '50%', marginTop: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgb(var(--ink-rgb) / 0.06)', fontSize: 9, fontWeight: 700, color,
      }}>
        {chat.author ? chat.author.slice(0, 2).toUpperCase() : ''}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
          {chat.author && (
            <a
              href={`https://reddit.com/user/${chat.author}`}
              target="_blank" rel="noreferrer"
              style={{ fontSize: 12, fontWeight: 700, color, textDecoration: 'none', flexShrink: 0 }}
            >
              {chat.author}
            </a>
          )}
          {chat.sourceUrl ? (
            <a href={chat.sourceUrl} target="_blank" rel="noreferrer" title="Open on Reddit"
               style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 'auto', flexShrink: 0, fontFamily: 'monospace', textDecoration: 'none' }}>
              {formatWithMs(chat.timestamp)}
            </a>
          ) : (
            <span style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 'auto', flexShrink: 0, fontFamily: 'monospace' }}>
              {formatWithMs(chat.timestamp)}
            </span>
          )}
        </div>
        <div
          className="md"
          style={{
            fontSize: 13, color: 'var(--ink-1)', wordBreak: 'break-word',
            textDecoration: chat.stricken ? 'line-through' : undefined,
          }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(chat.body, 18) }}
        />
      </div>
    </div>
  )
}

import { hourBarKey, hourBarLabel } from '@/lib/hourBar'

export const LC_THREAD_ID = 'ta535s1hq2je'

export const LC_CHAT_THREAD_ID = '14ny3ur3axhd4'

export const LC_CHAT_MIRROR = 'b66b'
const MIRROR_ATTRIBUTION = /\n*\\- \*\/u\/([A-Za-z0-9_-]+)\* \(\[link\]\((https?:\/\/[^)\s]+)\)\)\s*$/

export function unmirrorChat(author: string, body: string): { author: string; body: string; sourceUrl?: string } {
  if ((author || '').toLowerCase() !== LC_CHAT_MIRROR) return { author, body }
  const m = MIRROR_ATTRIBUTION.exec(body || '')
  if (!m) return { author: '', body }
  return { author: m[1], body: body.slice(0, m.index).replace(/\s+$/, ''), sourceUrl: m[2] }
}

export const LC_THREAD_NAME = 'livecounting'
export const LC_THREAD_TITLE = '/r/livecounting'
export const LC_THREAD_UUID = 'reddit-livecounting'

export const REDDIT_RATE_LIMIT_MS = 333

export const MAX_POSTS = 50

export interface LiveThreadSnapshot {
  about: any
  posts: { id: string; author: string; body: string; stricken: boolean }[]
}

let currentToken: string | null = null
let lastPrimed: string | null = null

export function primeRedditAccess(token: string | null | undefined) {
  const t = token || null
  if (t === lastPrimed) return
  lastPrimed = t
  currentToken = t
}

export class RedditRelinkError extends Error {
  constructor() {
    super('Reddit link needs re-linking')
    this.name = 'RedditRelinkError'
  }
}

type RefreshResult = { token: string } | { relink: true } | { failed: true }

let refreshInFlight: Promise<RefreshResult> | null = null

export function refreshRedditAccess(): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async (): Promise<RefreshResult> => {
    try {
      const res = await fetch('/api/auth/reddit_token', { credentials: 'include' })
      if (res.status === 409) return { relink: true }
      if (!res.ok) return { failed: true }
      const json = await res.json().catch(() => null)
      const token = json?.redditAccess
      if (!token) return { failed: true }
      currentToken = token
      return { token }
    } catch {
      return { failed: true }
    } finally {
      setTimeout(() => { refreshInFlight = null }, 0)
    }
  })()
  return refreshInFlight
}

export async function redditFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const attempt = (token: string | null) =>
    fetch(url, {
      ...init,
      headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })

  let res: Response | null = null
  let networkError: unknown = null
  try {
    res = await attempt(currentToken)
    if (res.status !== 401) return res
  } catch (e) {
    networkError = e
  }

  const fresh = await refreshRedditAccess()
  if ('relink' in fresh) throw new RedditRelinkError()
  if ('token' in fresh) return attempt(fresh.token)
  if (res) return res
  throw networkError
}

export async function fetchLiveThread(
  threadId: string,
  limit: number,
  redditAccess?: string,
  after?: string,
): Promise<LiveThreadSnapshot> {
  const page = after ? `&after=${encodeURIComponent(after)}` : ''
  if (redditAccess) {
    primeRedditAccess(redditAccess)
    const aboutRes = await redditFetch(`https://oauth.reddit.com/live/${threadId}/about`)
    const listRes = await redditFetch(`https://oauth.reddit.com/live/${threadId}?limit=${limit}${page}`)
    if (!aboutRes.ok) throw new Error(`about ${aboutRes.status}`)
    const about = (await aboutRes.json())?.data ?? {}
    const children = listRes.ok ? (await listRes.json())?.data?.children ?? [] : []
    return {
      about,
      posts: children.map((c: any) => ({
        id: c.data.id, author: c.data.author, body: c.data.body, stricken: !!c.data.stricken,
      })),
    }
  }

  const res = await fetch(`/api/reddit-live?thread=${threadId}&limit=${limit}${page}`)
  const json = await res.json().catch(() => null)
  if (!res.ok || !json || json.error) throw new Error(json?.error ?? `proxy ${res.status}`)
  return json as LiveThreadSnapshot
}

export interface RedditPost {
  id: string
  name?: string
  author: string
  body: string
  stricken?: boolean
  timestamp: number
  fakePost?: boolean
  real_timestamp?: number
  replyTime?: number
  timestamp_prediction_error?: number
  counter?: { username: string; color: string; name: string }
}

const LC_COUNT = /^-?\d[\d\s,.]*/

export function parseLiveCount(body: string): { count?: string; comment?: string } {
  const text = (body ?? '').trim()
  if (!text) return {}

  const match = LC_COUNT.exec(text)
  if (!match) return { comment: text }

  const count = match[0].replace(/[\s,.]+$/, '')
  if (!count) return { comment: text }

  const comment = text.slice(count.length).trim()
  return { count, comment: comment || undefined }
}

export function uuidv1ToMs(uuid: string): number {
  try {
    const parts = uuid.split('-')
    const timeStr = [parts[2].substring(1), parts[1], parts[0]].join('')
    const ms = Math.floor((parseInt(timeStr, 16) - 122192928000000000) / 10000)
    return Number.isFinite(ms) ? ms : 0
  } catch {
    return 0
  }
}

export function formatWithMs(ms: number): string {
  const d = new Date(ms)
  return (
    d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) +
    '.' + String(d.getMilliseconds()).padStart(3, '0')
  )
}

export const hourLabel = (ms: number): string => hourBarLabel(ms)

export const hourKey = (ms: number): string => hourBarKey(ms)

export function mergePost(list: RedditPost[], incoming: RedditPost, reorder: boolean): RedditPost[] {
  if (list.some(p => !p.fakePost && p.id === incoming.id)) return list

  const pendingIdx = incoming.fakePost
    ? -1
    : list.findIndex(p => p.fakePost && p.body === incoming.body && p.author === incoming.author)

  let next: RedditPost[]
  if (pendingIdx !== -1) {
    const pending = list[pendingIdx]
    const merged: RedditPost = {
      ...incoming,
      counter: pending.counter,
      replyTime: pending.replyTime,
      timestamp_prediction_error: incoming.timestamp - pending.timestamp,
    }
    next = [...list]
    next[pendingIdx] = merged
  } else {
    next = [incoming, ...list]
  }

  if (reorder) next.sort((a, b) => b.timestamp - a.timestamp)
  return next.slice(0, MAX_POSTS)
}

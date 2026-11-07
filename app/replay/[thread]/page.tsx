import { notFound } from 'next/navigation'
import { cache } from 'react'
import { apiFetch } from '@/lib/apiFetch'
import type { Metadata } from 'next'
import { avatarUrl, buildCounterMap } from '@/lib/counterUtils'
import ReplayClient from './ReplayClient'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'
const MAX_POSTS = 5000

export interface ReplayPost {
  uuid: string
  rawText: string
  countContent?: string
  comment?: string
  isCount: boolean
  isValidCount: boolean
  stricken: boolean
  timestamp: string
  timeSinceLastCount?: number
  timeSinceLastPost?: number
  rawCount?: number
  validCountNumber?: number
  authorUUID: string
  authorUsername: string
  authorName: string
  authorColor: string
  authorAvatarUrl?: string
}

interface ApiPost {
  uuid: string
  rawText: string
  countContent?: string
  comment?: string
  isCount: boolean
  isValidCount: boolean
  stricken: boolean
  timestamp: string
  timeSinceLastCount?: number
  timeSinceLastPost?: number
  rawCount?: number
  validCountNumber?: number
  authorUUID: string
}

interface ApiCounter {
  uuid: string
  username: string
  name: string
  discordId: string
  avatar: string
  color: string
  emoji?: string
}

interface Thread {
  uuid: string
  name: string
  title: string
  description: string
  allowDoublePosts: boolean
  resetOnMistakes: boolean
  validationType: string
  countsPerSplit: number
  splitsPerGet: number
  splitOffset: number
}

async function getThread(threadName: string): Promise<Thread | null> {
  try {
    const res = await apiFetch(`${API}/api/thread/${encodeURIComponent(threadName)}`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function findStartPostByValidCount(threadUuid: string, number: number): Promise<{ uuid: string; timestamp?: string } | null> {
  try {
    const res = await apiFetch(`${API}/api/thread/findPostByThreadAndNumber`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number, thread: threadUuid }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    const post = data.posts?.[0]
    return post ? { uuid: post.uuid, timestamp: post.timestamp } : null
  } catch {
    return null
  }
}

async function findStartPostByRawCount(threadUuid: string, rawCount: string): Promise<{ uuid: string; timestamp?: string } | null> {
  try {
    const res = await apiFetch(`${API}/api/thread/findPostByThreadAndRawCount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawCount, thread: threadUuid }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    const post = data.posts?.[0]
    return post ? { uuid: post.uuid, timestamp: post.timestamp } : null
  } catch {
    return null
  }
}

async function loadAllPosts(
  threadName: string,
  startUuid: string,
  endValidCount: number | null,
  endRawCount: string | null,
): Promise<{ posts: ApiPost[]; counters: ApiCounter[]; truncated: boolean }> {
  const allPosts: ApiPost[] = []
  const counterMap = new Map<string, ApiCounter>()
  let cursorUuid = startUuid
  let loadedNewest = false
  let reachedEnd = false

  while (!loadedNewest && allPosts.length < MAX_POSTS) {
    const url = `${API}/api/thread/loadNewerCounts?thread_name=${encodeURIComponent(threadName)}&uuid=${cursorUuid}&limit=1000`
    let data: { counts: ApiPost[]; loadedNewest: boolean; counters: ApiCounter[] }
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) break
      data = await res.json()
    } catch {
      break
    }

    for (const c of data.counters ?? []) if (c?.uuid) counterMap.set(c.uuid, c)
    const batch = data.counts ?? []

    if (endValidCount != null) {
      const cutIdx = batch.findIndex(
        (p) => p.validCountNumber != null && p.validCountNumber > endValidCount,
      )
      if (cutIdx !== -1) {
        allPosts.push(...batch.slice(0, cutIdx))
        loadedNewest = true
        reachedEnd = true
        break
      }
    } else if (endRawCount != null) {
      const cutIdx = batch.findIndex(
        (p) => p.rawCount != null && String(p.rawCount) === endRawCount,
      )
      if (cutIdx !== -1) {
        allPosts.push(...batch.slice(0, cutIdx + 1))
        loadedNewest = true
        reachedEnd = true
        break
      }
    }

    allPosts.push(...batch)
    loadedNewest = data.loadedNewest ?? false
    if (batch.length === 0) break
    cursorUuid = batch[batch.length - 1].uuid
  }

  const truncated = !reachedEnd && !loadedNewest && allPosts.length >= MAX_POSTS
  return { posts: allPosts, counters: Array.from(counterMap.values()), truncated }
}

function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function toReplayPost(post: ApiPost, counter: ApiCounter | undefined): ReplayPost {
  return {
    uuid: post.uuid,
    rawText: post.rawText,
    countContent: post.countContent,
    comment: post.comment,
    isCount: post.isCount,
    isValidCount: post.isValidCount,
    stricken: post.stricken,
    timestamp: post.timestamp,
    timeSinceLastCount: num(post.timeSinceLastCount),
    timeSinceLastPost: num(post.timeSinceLastPost),
    rawCount: num(post.rawCount),
    validCountNumber: num(post.validCountNumber),
    authorUUID: post.authorUUID,
    authorUsername: counter?.username ?? 'unknown',
    authorName: counter?.name ?? counter?.username ?? 'unknown',
    authorColor: counter?.color ?? '#888888',
    authorAvatarUrl: counter ? avatarUrl(counter) : undefined,
  }
}

type PageProps = {
  params: Promise<{ thread: string }>
  searchParams: Promise<{
    startValidCountNumber?: string
    endValidCountNumber?: string
    startRawCount?: string
    endRawCount?: string
    start?: string
    end?: string
  }>
}

const loadReplay = cache(async function (
  threadName: string,
  startValidCountNum: number | null,
  endValidCountNum: number | null,
  startRaw: string | null,
  endRaw: string | null,
): Promise<{
  posts: ReplayPost[]
  error: string | null
  truncated: boolean
  anchorTimestamp: string | null
}> {
  const empty = { posts: [] as ReplayPost[], error: null, truncated: false, anchorTimestamp: null }

  const thread = await getThread(threadName)
  if (!thread) return empty
  if (startValidCountNum == null && startRaw == null) return empty

  const startPost = startRaw
    ? await findStartPostByRawCount(thread.uuid, startRaw)
    : await findStartPostByValidCount(thread.uuid, startValidCountNum!)

  if (!startPost) {
    const label = startRaw ? `raw count "${startRaw}"` : `count #${startValidCountNum}`
    return { ...empty, error: `Could not find ${label} in this thread.` }
  }

  const { posts: rawPosts, counters, truncated } = await loadAllPosts(
    threadName, startPost.uuid, endValidCountNum, endRaw,
  )
  const counterMap = buildCounterMap(counters)
  return {
    posts: rawPosts.map((p) => toReplayPost(p, counterMap.get(p.authorUUID))),
    error: null,
    truncated,
    anchorTimestamp: startPost.timestamp ?? null,
  }
})

function joinNames(names: string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

function formatRunTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const total = ms / 1000
  const m = Math.floor(total / 60)
  const rest = total - m * 60
  return m > 0 ? `${m}:${rest.toFixed(3).padStart(6, '0')}` : `${rest.toFixed(3)}s`
}

function summariseRun(posts: ReplayPost[], anchorTimestamp: string | null): {
  names: string[]; counts: number; durationMs: number
} {
  const tally = new Map<string, number>()
  let counts = 0
  let firstTs: number | null = null
  let lastTs: number | null = null

  for (const p of posts) {
    if (!p.isCount || !p.isValidCount || p.stricken) continue
    counts++
    const name = p.authorName?.trim()
    if (name) tally.set(name, (tally.get(name) ?? 0) + 1)
    const ts = Number(p.timestamp)
    if (Number.isFinite(ts)) {
      if (firstTs == null) firstTs = ts
      lastTs = ts
    }
  }

  const anchor = Number(anchorTimestamp)
  const from = Number.isFinite(anchor) ? anchor : firstTs
  const durationMs = from != null && lastTs != null && lastTs > from ? lastTs - from : 0

  const names = Array.from(tally.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([n]) => n)

  return { names, counts, durationMs }
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { thread: rawThread } = await params
  const sp = await searchParams
  const threadName = decodeURIComponent(rawThread)

  const thread = await getThread(threadName)
  if (!thread) return { title: 'Replay not found | counting.gg', robots: { index: false, follow: false } }

  const startVCN = sp.startValidCountNumber ?? sp.start
  const endVCN = sp.endValidCountNumber ?? sp.end
  const startRaw = sp.startRawCount
  const endRaw = sp.endRawCount

  const startLabel = startVCN ? `#${parseInt(startVCN).toLocaleString()}` : startRaw ? `raw:${startRaw}` : null
  const endLabel = endVCN ? `#${parseInt(endVCN).toLocaleString()}` : endRaw ? `raw:${endRaw}` : null

  const rangeParts: string[] = []
  if (startLabel) rangeParts.push(startLabel)
  if (endLabel) rangeParts.push(`→ ${endLabel}`)
  const rangeStr = rangeParts.length ? ` (counts ${rangeParts.join(' ')})` : ''

  const title = `Replay: ${thread.title}${rangeStr} | counting.gg`

  const { posts, anchorTimestamp } = await loadReplay(
    threadName,
    startVCN ? parseInt(startVCN) : null,
    endVCN ? parseInt(endVCN) : null,
    startRaw ?? null,
    endRaw ?? null,
  ).then(r => r, () => ({ posts: [] as ReplayPost[], anchorTimestamp: null }))

  const { names, counts, durationMs } = summariseRun(posts, anchorTimestamp)
  const timeStr = formatRunTime(durationMs)

  const description = names.length > 0 && counts > 0 && timeStr
    ? `Watch ${joinNames(names)} run ${counts.toLocaleString()} counts in ${thread.title} in ${timeStr}`
    : `Watch a replay of ${thread.title}${rangeStr}.`

  const ogImageParams = new URLSearchParams({ thread: threadName })
  if (startVCN) ogImageParams.set('start', startVCN)
  if (endVCN) ogImageParams.set('end', endVCN)
  const ogImage = `/api/og/replay?${ogImageParams}`

  const canonicalParams = new URLSearchParams()
  if (startVCN) canonicalParams.set('startValidCountNumber', startVCN)
  if (endVCN) canonicalParams.set('endValidCountNumber', endVCN)
  if (!startVCN && startRaw) canonicalParams.set('startRawCount', startRaw)
  if (!endVCN && endRaw) canonicalParams.set('endRawCount', endRaw)
  const query = canonicalParams.toString()
  const canonical = `/replay/${encodeURIComponent(threadName)}${query ? `?${query}` : ''}`

  const hasContent = posts.length > 0

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: hasContent, follow: true },
    openGraph: {
      title, description, siteName: 'counting.gg',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}

export default async function ReplayPage({ params, searchParams }: PageProps) {
  const { thread: rawThread } = await params
  const sp = await searchParams
  const threadName = decodeURIComponent(rawThread)

  const startVCN = sp.startValidCountNumber ?? sp.start
  const endVCN = sp.endValidCountNumber ?? sp.end
  const startRaw = sp.startRawCount
  const endRaw = sp.endRawCount

  const startValidCountNum = startVCN ? parseInt(startVCN) : null
  const endValidCountNum = endVCN ? parseInt(endVCN) : null

  const thread = await getThread(threadName)
  if (!thread) notFound()

  const { posts, error, truncated, anchorTimestamp } = await loadReplay(
    threadName, startValidCountNum, endValidCountNum, startRaw ?? null, endRaw ?? null,
  )

  return (
    <ReplayClient
      threadName={threadName}
      threadTitle={thread.title}
      validationType={thread.validationType}
      posts={posts}
      startNum={startValidCountNum}
      endNum={endValidCountNum}
      error={error}
      countsPerSplit={thread.countsPerSplit ?? 100}
      splitsPerGet={thread.splitsPerGet ?? 10}
      truncated={truncated}
      anchorTimestamp={anchorTimestamp}
    />
  )
}

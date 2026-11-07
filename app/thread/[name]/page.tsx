import { apiFetch } from '@/lib/apiFetch'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { cache } from 'react'
import ThreadView, { type PostRow } from '@/components/thread/ThreadView'
import { getSession } from '@/lib/session'
import { resolvePrefs } from '@/lib/prefs'
import { avatarUrl, buildCounterMap } from '@/lib/counterUtils'
import { LC_THREAD_ID, LC_THREAD_NAME, LC_THREAD_TITLE, LC_THREAD_UUID, parseLiveCount, uuidv1ToMs } from '@/lib/reddit'
import { fetchLiveThreadServer, loadColorTableServer } from '@/lib/redditServer'
import { redditUserColor } from '@/lib/redditUserColors'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

interface Post {
  uuid: string
  rawText: string
  countContent?: string
  rawCount?: string
  comment?: string
  isValidCount: boolean
  stricken: boolean
  timestamp: string
  timeSinceLastPost?: number
  validCountNumber?: number
  timeSinceLastCount?: number | string
  authorUUID: string
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

interface Thread {
  uuid: string
  name: string
  title: string
  description: string
  rules: string
  threadOfTheDay: boolean
  countBans: string[]
  autoValidated: boolean
  allowDoublePosts: boolean
  resetOnMistakes: boolean
  validationType: string
  firstValidCount: string
  locked: boolean
  color1?: string
  color2?: string
  postBans: string[]
  updatableBy: string[]
}


function toPostRow(post: Post, author: Counter | undefined): PostRow {
  return {
    uuid: post.uuid,
    rawText: post.rawText,
    countContent: post.countContent,
    rawCount: post.rawCount,
    comment: post.comment,
    isValidCount: post.isValidCount,
    stricken: post.stricken,
    timestamp: post.timestamp,
    timeSinceLastPost: post.timeSinceLastPost,
    validCountNumber: post.validCountNumber,
    timeSinceLastCount: post.timeSinceLastCount,
    authorUUID: post.authorUUID,
    authorUsername: author?.username ?? 'unknown',
    authorName: author?.name ?? author?.username ?? 'unknown',
    authorColor: author?.color ?? '#888888',
    authorEmoji: author?.emoji,
    authorAvatarUrl: author ? avatarUrl(author) : undefined,
    reactions: (post as any).reactions ?? undefined,
  }
}


async function fetchWithCookies(url: string, init?: RequestInit) {
  return apiFetch(url, { ...init, cache: 'no-store' })
}

const getThread = cache(async function(threadName: string): Promise<Thread | null> {
  try {
    const res = await fetchWithCookies(`${API}/api/thread/${encodeURIComponent(threadName)}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
})

interface ThreadStats {
  totalCounts: number
  topCounterName: string | null
}

async function getThreadStats(threadName: string): Promise<ThreadStats | null> {
  try {
    const res = await fetch(`${API}/api/thread/stats/threadStats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thread: threadName, includeDetails: false }),
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const data = await res.json()
    const lb: Record<string, number> = data.stats?.all?.leaderboard ?? {}
    const counters: Counter[] = data.counters ?? []
    const totalCounts = Object.values(lb).reduce((sum, n) => sum + n, 0)
    const topUuid = Object.entries(lb).sort((a, b) => b[1] - a[1])[0]?.[0]
    const topCounter = topUuid ? counters.find(c => c.uuid === topUuid) : null
    const topCounterName = topCounter?.name ?? topCounter?.username ?? null
    return { totalCounts, topCounterName }
  } catch {
    return null
  }
}

interface RecentSplit {
  number: string
  split: number
  replay?: string
}

async function getRecentCounts(threadName: string, context: string | null = null): Promise<{ posts: Post[]; counters: Counter[]; recentSplits: RecentSplit[] } | null> {
  try {
    const res = await fetchWithCookies(`${API}/api/thread/getRecent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thread_name: threadName, context }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return { posts: data.recentCounts ?? [], counters: data.counters ?? [], recentSplits: data.recentSplits ?? [] }
  } catch {
    return null
  }
}

function threadCategory(thread: Thread): string {
  if (thread.allowDoublePosts && !thread.resetOnMistakes) return 'Double Counting'
  if (thread.resetOnMistakes) return 'No Mistakes'
  return 'Traditional'
}

const LC_START = 'July 22, 2014'

function parseCount(body: string): number | null {
  const match = /\d[\d,.\s'’_]*/.exec(body ?? '')
  if (!match) return null
  const text = match[0]
    .replace(/\.(?=\d{3}(?!\d))/g, '')
    .replace(/[,\s'’_]/g, '')
  const n = Number(text)
  return Number.isInteger(n) ? n : null
}

function highestCount(posts: { body: string; stricken: boolean }[]): number | null {
  const values = posts
    .filter(p => !p.stricken)
    .map(p => parseCount(p.body))
    .filter((n): n is number => n !== null)
  if (!values.length) return null

  const median = [...values].sort((a, b) => a - b)[values.length >> 1]
  const plausible = values.filter(v => Math.abs(v - median) <= 1000)
  return plausible.length ? Math.max(...plausible) : median
}

const getLivecounting = cache(async function () {
  try {
    return await fetchLiveThreadServer(LC_THREAD_ID, 25)
  } catch {
    return null
  }
})

function livecountingThread(): Thread {
  return {
    uuid: LC_THREAD_UUID,
    name: LC_THREAD_NAME,
    title: LC_THREAD_TITLE,
    description: "Reddit's live counting thread, mirrored through counting.gg.",
    rules: '',
    threadOfTheDay: false,
    countBans: [],
    autoValidated: false,
    allowDoublePosts: true,
    resetOnMistakes: false,
    validationType: 'main',
    firstValidCount: '',
    locked: false,
    postBans: [],
    updatableBy: [],
  }
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params
  const threadName = decodeURIComponent(name)

  if (threadName === LC_THREAD_NAME) {
    const snapshot = await getLivecounting()
    const count = snapshot ? highestCount(snapshot.posts) : null
    const title = `${LC_THREAD_TITLE} | the internet's largest count`
    const description = count
      ? `The biggest number ever counted to is ${count.toLocaleString()} on /r/livecounting, counted by over 4,218 contributors since ${LC_START}.`
      : `The biggest number ever counted to, live on /r/livecounting: counted by over 4,218 contributors since ${LC_START}.`
    return {
      title,
      description,
      alternates: { canonical: '/thread/livecounting' },
      openGraph: { title, description, siteName: 'counting.gg', type: 'website' },
      twitter: { card: 'summary', title, description },
    }
  }

  const [thread, stats] = await Promise.all([getThread(threadName), getThreadStats(threadName)])
  if (!thread) return { title: 'Thread not found | counting.gg' }

  const title = `${thread.title} | counting.gg`
  const parts: string[] = []
  if (thread.description) parts.push(thread.description)
  parts.push(`${threadCategory(thread)} counting thread`)
  if (stats?.totalCounts) parts.push(`${stats.totalCounts.toLocaleString()} total counts`)
  if (stats?.topCounterName) parts.push(`led by ${stats.topCounterName}`)
  const description = parts.join(' · ')

  return {
    title,
    description,
    openGraph: {
      title, description, siteName: 'counting.gg',
      images: [{ url: `/api/og/thread?thread=${encodeURIComponent(threadName)}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image', title, description,
      images: [`/api/og/thread?thread=${encodeURIComponent(threadName)}`],
    },
  }
}

export default async function ThreadPage({ params, searchParams }: {
  params: Promise<{ name: string }>
  searchParams: Promise<{ context?: string | string[] }>
}) {
  const { name } = await params
  const threadName = decodeURIComponent(name)
  const { context: rawContext } = await searchParams
  const context = (Array.isArray(rawContext) ? rawContext[0] : rawContext) || null

  if (threadName === LC_THREAD_NAME) {
    const [session, snapshot, colorTable] = await Promise.all([
      getSession(), getLivecounting(), loadColorTableServer(),
    ])
    const thread = livecountingThread()

    const rows = (snapshot?.posts ?? [])
      .map(p => ({ ...p, timestamp: uuidv1ToMs(p.id) }))
      .sort((a, b) => b.timestamp - a.timestamp)
    const initialPosts: PostRow[] = rows.map((p, i) => {
      const { count, comment } = parseLiveCount(p.body)
      return {
      uuid: p.id,
      rawText: p.body,
      countContent: count,
      comment,
      isValidCount: count != null,
      stricken: p.stricken,
      timestamp: String(p.timestamp),
      timeSinceLastPost: i < rows.length - 1 ? p.timestamp - rows[i + 1].timestamp : undefined,
      authorUUID: '',
      authorUsername: p.author,
      authorName: p.author,
      authorColor: redditUserColor(p.author, colorTable),
      authorEmoji: undefined,
      authorAvatarUrl: undefined,
      reactions: undefined,
      }
    })

    return (
      <ThreadView
        key={LC_THREAD_NAME}
        threadName={LC_THREAD_NAME}
        threadTitle={LC_THREAD_TITLE}
        threadUUID={undefined}
        threadEnabled={false}
        initialPosts={initialPosts}
        ssrNewestTimestamp={null}
        ssrRedditAbout={snapshot?.about ?? null}
        isLoggedIn={!!session}
        userUUID={session?.uuid}
        bingoGameId={session?.bingoGameId ?? null}
        userUsername={session?.counter?.username ?? session?.username}
        userRoles={session?.counter?.roles}
        userXP={session?.counter?.xp}
        prefs={resolvePrefs(session?.userPrefs ?? null, null)}
        thread={thread}
        miscSettings={session?.miscSettings}
        initialSplits={[]}
        isReddit
        reddit={session?.reddit}
        redditAccess={session?.redditAccess}
      />
    )
  }

  const [data, thread, session] = await Promise.all([
    getRecentCounts(threadName, context),
    getThread(threadName),
    getSession(),
  ])
  if (!data) notFound()

  const counterMap = buildCounterMap(data.counters)
  const initialPosts: PostRow[] = data.posts.map((post) => toPostRow(post, counterMap.get(post.authorUUID)))
  const ssrNewestTimestamp = context ? null : (data.posts.length > 0 ? data.posts[0].timestamp : null)
  const contextUUID = context && initialPosts.some(p => p.uuid === context) ? context : undefined

  const threadUUID = thread?.uuid
  const threadEnabled = threadUUID
    ? (session?.userPrefs?.threadPreferences ?? []).find(p => p.thread?.uuid === threadUUID)?.enabled ?? false
    : false
  const prefs = resolvePrefs(session?.userPrefs ?? null, threadUUID ?? null)

  return (
    <ThreadView
      key={threadName}
      threadName={threadName}
      threadTitle={thread?.title ?? threadName}
      threadUUID={threadUUID}
      threadEnabled={threadEnabled}
      initialPosts={initialPosts}
      ssrNewestTimestamp={ssrNewestTimestamp}
      contextUUID={contextUUID}
      isLoggedIn={!!session}
      userUUID={session?.uuid}
      bingoGameId={session?.bingoGameId ?? null}
      userUsername={session?.counter?.username ?? session?.username}
      userRoles={session?.counter?.roles}
      userXP={session?.counter?.xp}
      prefs={prefs}
      thread={thread ?? undefined}
      miscSettings={session?.miscSettings}
      initialSplits={data.recentSplits}
      reddit={session?.reddit}
      redditAccess={session?.redditAccess}
    />
  )
}

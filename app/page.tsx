import type { Metadata } from 'next'
import HomeClient from './HomeClient'
import { getSession } from '@/lib/session'
import { resolvePrefs } from '@/lib/prefs'
import { easternHourFraction, easternDayKey } from '@/lib/daylight'
import { wisdomForDay } from '@/lib/dailyWisdom'
import { isProbablyMobile } from '@/lib/device'

const FRESH = { cache: 'no-store' } as const

async function getDiscordMembers(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://discord.com/api/v10/invites/bfS9RQht6M?with_counts=true',
      { next: { revalidate: 3600 } },
    )
    if (!res.ok) return null
    const data = await res.json()
    const n = Number(data?.approximate_member_count)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

export const metadata: Metadata = {
  title: 'counting.gg',
  description: 'The largest counting site on the internet',
}

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

interface Thread {
  name: string
  title: string
  uuid: string
  allowDoublePosts: boolean
  resetOnMistakes: boolean
}

async function getThreads(): Promise<Thread[]> {
  try {
    const res = await fetch(`${API}/api/thread/all`, FRESH)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : (data.threads ?? [])
  } catch {
    return []
  }
}

async function getUnlockedGoals(): Promise<string[]> {
  try {
    const res = await fetch(`${API}/api/site-goals`, FRESH)
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.filter((g: any) => g?.unlocked).map((g: any) => g.goalKey)
  } catch {
    return []
  }
}

export type LatestCount = { rawCount: string | null; validCountNumber: number | null }

async function getLatestCounts(): Promise<Record<string, LatestCount>> {
  try {
    const res = await fetch(`${API}/api/thread/latestCounts`, FRESH)
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}

async function getDailyPage(): Promise<{
  byThread: Record<string, number>
  leaderboard: any[]
  totalCounts: number | null
  totalPosts: number | null
}> {
  try {
    const res = await fetch(`${API}/api/api/defaultPage`, FRESH)
    if (!res.ok) return { byThread: {}, leaderboard: [], totalCounts: null, totalPosts: null }
    const data = await res.json()

    const totalCounts =
      typeof data.totalCounts === 'number' && data.totalCounts > 0
        ? data.totalCounts
        : null

    const totalPosts =
      typeof data.totalPosts === 'number' && data.totalPosts > 0
        ? data.totalPosts
        : null

    const leaderboard = Object.values<any>(data.dailyLeaderboard ?? {})
      .filter(e => e?.counter?.username && e.counts > 0)
      .sort((a, b) => b.counts - a.counts)

    const boards = data.allLeaderboards
    if (!boards || typeof boards !== 'object') return { byThread: {}, leaderboard, totalCounts, totalPosts }

    const totals: Record<string, number> = {}
    for (const [uuid, board] of Object.entries<any>(boards)) {
      if (uuid === 'all' || !board || typeof board !== 'object') continue
      let counts = 0
      for (const entry of Object.values<any>(board)) counts += Number(entry?.counts) || 0
      if (counts > 0) totals[uuid] = counts
    }
    return { byThread: totals, leaderboard, totalCounts, totalPosts }
  } catch {
    return { byThread: {}, leaderboard: [], totalCounts: null, totalPosts: null }
  }
}

export type BlogSummary = {
  id: number
  uuid: string
  title: string
  body: string
  preview: string
  author: { username: string; name?: string; color?: string; discordId?: string; avatar?: string; roles?: string[] | string }
  timestamp: string
}
type LatestBlog = BlogSummary | null

const PREVIEW_CHARS = 240

function toPreview(body: string, chars = PREVIEW_CHARS): string {
  const flat = (body ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*`>[\]_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (flat.length <= chars) return flat
  const cut = flat.slice(0, chars)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > chars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…'
}

async function getBlogs(): Promise<{ featured: LatestBlog; recent: BlogSummary[] }> {
  try {
    const res = await fetch(`${API}/api/thread/blogs/1`, FRESH)
    if (!res.ok) return { featured: null, recent: [] }
    const data = await res.json()
    const raw: (BlogSummary & { body?: string })[] = data.blogs ?? []

    const summarise = (b: (typeof raw)[number]): BlogSummary => ({
      id: b.id,
      uuid: b.uuid,
      title: b.title,
      body: b.body ?? '',
      preview: toPreview(b.body ?? ''),
      author: {
        username: b.author?.username,
        name: b.author?.name,
        color: b.author?.color,
        discordId: b.author?.discordId,
        avatar: b.author?.avatar,
      },
      timestamp: b.timestamp,
    })

    const featuredRaw = raw.find(b => {
      const roles = b?.author?.roles
      return Array.isArray(roles) ? roles.includes('admin') : typeof roles === 'string' && roles.includes('admin')
    })

    const featured = featuredRaw ? summarise(featuredRaw) : null
    const recent = raw
      .filter(b => b?.uuid !== featured?.uuid)
      .slice(0, 3)
      .map(summarise)

    return { featured, recent }
  } catch {
    return { featured: null, recent: [] }
  }
}

async function getCoverage(path: string) {
  try {
    const res = await fetch(`${API}/api/thread/${path}`, FRESH)
    if (!res.ok) return null
    const data = await res.json()
    return typeof data?.pct === 'number' ? data : null
  } catch {
    return null
  }
}

export default async function HomePage() {
  const [allThreads, session, blogs, latestCounts, daily, unlockedGoals, msCoverage, csCoverage] =
    await Promise.all([
      getThreads(),
      getSession(),
      getBlogs(),
      getLatestCounts(),
      getDailyPage(),
      getUnlockedGoals(),
      getCoverage('msCoverage'),
      getCoverage('csCoverage'),
    ])

  const wisdom = unlockedGoals.includes('crystal_ball')
    ? (() => {
        const f = wisdomForDay(easternDayKey())
        return f ? { w: f.w, h: f.h } : null
      })()
    : null

  const threadMeta = allThreads.map(t => {
    const extra = t as Thread & { validationType?: string; color1?: string; color2?: string }
    return {
      uuid: t.uuid,
      name: t.name,
      title: t.title,
      validationType: extra.validationType,
      countFormat: session
        ? resolvePrefs(session.userPrefs ?? null, t.uuid).pref_standardize_format
        : undefined,
      color1: extra.color1,
      color2: extra.color2,
    }
  })

  return (
    <div style={{ minHeight: 'calc(100vh - 65px)' }}>
      <HomeClient
        initialCount={daily.totalCounts}
        initialPosts={daily.totalPosts}
        threadMeta={threadMeta}
        initialHour={easternHourFraction()}
        initialDayKey={easternDayKey()}
        initialNarrow={await isProbablyMobile()}
        discordMembers={await getDiscordMembers()}
        wisdom={wisdom}
        initialLatestCounts={latestCounts}
        initialLeaderboard={daily.leaderboard}
        initialThreadBoard={
          threadMeta
            .filter(t => (daily.byThread[t.uuid] ?? 0) > 0)
            .map(t => ({
              uuid: t.uuid,
              name: t.name,
              title: t.title,
              counts: daily.byThread[t.uuid],
              validationType: t.validationType,
              countFormat: t.countFormat,
              color1: t.color1,
              color2: t.color2,
            }))
            .sort((a, b) => b.counts - a.counts)
        }
        isLoggedIn={!!session}
        viewerUuid={session?.uuid ?? null}
        initialMsCoverage={msCoverage}
        initialCsCoverage={csCoverage}
        isBanned={!!session?.counter?.roles?.includes('banned')}
        isMuted={!!session?.counter?.roles?.includes('muted')}
        isStaff={!!session?.counter?.roles?.some(r => r === 'admin' || r === 'mod')}
        isCounter={!!session?.counter?.roles?.includes('counter')}
        latestBlog={blogs.featured}
        recentBlogs={blogs.recent}
      />
    </div>
  )
}

import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import {
  CardHeader, Eyebrow, Headline, PersonChip, Scrim, StatPanel, SunGlow,
  avatarUrl, cardShellStyle,
} from '../shared'

export const runtime = 'edge'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

interface Thread {
  uuid: string
  name: string
  title: string
  description?: string
  validationType?: string
}

interface RecentPost {
  rawCount?: string | number | null
  validCountNumber?: number | null
  isValidCount?: boolean
  stricken?: boolean
  authorUUID?: string
}

interface Counter {
  uuid: string
  username: string
  name: string
  discordId: string
  avatar: string
  color: string
}

async function getThread(name: string): Promise<Thread | null> {
  try {
    const r = await fetch(`${API}/api/thread/${encodeURIComponent(name)}`, { next: { revalidate: 300 } })
    return r.ok ? r.json() : null
  } catch { return null }
}

async function getSince(threadUuid: string): Promise<string | null> {
  try {
    const r = await fetch(`${API}/api/thread/findPostByThreadAndNumber`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: 1, thread: threadUuid }),
      next: { revalidate: 86400 },
    })
    if (!r.ok) return null
    const data = await r.json()
    const ms = Number(data.posts?.[0]?.timestamp)
    if (!Number.isFinite(ms) || ms <= 0) return null
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', year: 'numeric', timeZone: 'America/New_York',
    }).format(new Date(ms))
  } catch { return null }
}

async function getLive(threadName: string): Promise<{
  current: string | null
  counter: Counter | null
}> {
  try {
    const r = await fetch(`${API}/api/thread/getRecent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thread_name: threadName, context: null }),
      cache: 'no-store',
    })
    if (!r.ok) return { current: null, counter: null }
    const data = await r.json()
    const posts: RecentPost[] = data.recentCounts ?? []
    const counters: Counter[] = data.counters ?? []

    const newest = posts.find(p => p.isValidCount === true && !p.stricken && p.rawCount != null)
    if (!newest) return { current: null, counter: null }

    const counter = counters.find(c => c.uuid === newest.authorUUID) ?? null
    return { current: String(newest.rawCount), counter }
  } catch {
    return { current: null, counter: null }
  }
}

async function getStats(threadName: string): Promise<{ total: number; top: string | null }> {
  try {
    const r = await fetch(`${API}/api/thread/stats/threadStats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thread: threadName, includeDetails: false }),
      next: { revalidate: 300 },
    })
    if (!r.ok) return { total: 0, top: null }
    const data = await r.json()
    const lb: Record<string, number> = data.stats?.all?.leaderboard ?? {}
    const counters: Counter[] = data.counters ?? []
    const total = Object.values(lb).reduce((s, n) => s + n, 0)
    const topUuid = Object.entries(lb).sort((a, b) => b[1] - a[1])[0]?.[0]
    const top = topUuid ? (counters.find(c => c.uuid === topUuid)?.name ?? null) : null
    return { total, top }
  } catch {
    return { total: 0, top: null }
  }
}

export async function GET(req: NextRequest) {
  const threadName = req.nextUrl.searchParams.get('thread') ?? ''
  if (!threadName) return new Response('Missing thread', { status: 400 })

  const thread = await getThread(threadName)
  if (!thread) return new Response('Thread not found', { status: 404 })

  const [live, stats, since] = await Promise.all([
    getLive(threadName), getStats(threadName), getSince(thread.uuid),
  ])

  const headline = live.current
    ? live.current
    : stats.total > 0
      ? stats.total.toLocaleString()
      : thread.title

  const headlineLabel = live.current
    ? 'CURRENT COUNT'
    : stats.total > 0
      ? 'TOTAL COUNTS'
      : ''

  const items: { label: string; value: string; accent?: string }[] = []
  if (live.current && stats.total > 0) {
    items.push({ label: 'TOTAL COUNTS', value: stats.total.toLocaleString() })
  }
  if (stats.top) {
    items.push({ label: 'TOP COUNTER', value: stats.top })
  }

  return new ImageResponse(
    (
      <div style={cardShellStyle()}>
        <SunGlow />
        <Scrim />

        <CardHeader subject={thread.title} right={since ? `Since ${since}` : undefined} />

        <div style={{
          display: 'flex', flex: 1,
          padding: '0 52px 34px', alignItems: 'center', position: 'relative',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            {headlineLabel && <Eyebrow>{headlineLabel}</Eyebrow>}

            <Headline maxWidth={live.counter ? 620 : 800}>{headline}</Headline>

            <div style={{ display: 'flex', marginTop: 34 }}>
              <StatPanel items={items} />
            </div>
          </div>

          {live.counter && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flexShrink: 0, marginLeft: 40 }}>
              <div style={{
                fontSize: 18, fontWeight: 800, letterSpacing: '0.18em',
                color: 'rgba(255,255,255,0.6)', textAlign: 'right',
              }}>
                LAST COUNT BY
              </div>
              <PersonChip
                name={live.counter.name || live.counter.username}
                color={live.counter.color}
                avatar={avatarUrl(live.counter)}
              />
            </div>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}

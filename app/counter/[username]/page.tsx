import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/apiFetch'
import type { Metadata } from 'next'
import { getSession } from '@/lib/session'
import { avatarUrl } from '@/lib/counterUtils'
import { type CounterRankProfileResponse } from '@/lib/rankUtils'
import CounterPageClient from './CounterPageClient'
import type { ContributionDays, SecondsCoverage, EndingsCoverage } from './CoverageGraphs'
import { JsonLd, profileJsonLd } from '@/lib/jsonLd'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { uuidParse } = require('uuid-timestamp')

function counterUuidToTimestamp(uuid: string): number | null {
  try {
    const ms = uuidParse(uuid)
    return Number.isFinite(ms) ? ms : null
  } catch {
    return null
  }
}

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'
const RANK_API = process.env.RANK_API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

export interface CounterProfile {
  uuid: string
  id: number
  username: string
  name: string
  discordId: string
  avatar: string
  color: string
  rainbow: number
  roles: string[]
  xp: number
  pronouns: [string, string, string, string]
  title?: string
  emoji?: string
  cardStyle?: string
}

export interface CounterProfilePage {
  counterUUID: string
  bio: string | null
  socialLinks: { platform: string; handle: string }[] | null
}

export interface CounterStats {
  [threadTitle: string]: {
    posts: number
    counts: number
    mistakes: number
    odds: number
    evens: number
    first_count?: string
    best_speed_us?: number
    best_split_us?: number
    best_speed_start?: number
    best_speed_end?: number
    best_split_start?: number
    best_split_end?: number
    thread_name?: string
    seconds_counted?: number
    seconds_posted?: number
    ranks?: Record<string, number>
  }
}

async function loadCounter(username: string): Promise<{
  counter: CounterProfile
  stats: CounterStats
  contributionDays: ContributionDays
  timeDays: ContributionDays
  secondsCoverage: SecondsCoverage | null
  endingsCoverage: EndingsCoverage | null
} | null> {
  try {
    const res = await apiFetch(`${API}/api/counter/load_counter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid: username }),
      next: { revalidate: 60 },
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`load_counter ${res.status}`)
    const data = await res.json()
    const counter: CounterProfile = data.loadedCounter
    counter.xp = Number(counter.xp) || 0
    return {
      counter,
      stats: data.loadedCounterStats ?? {},
      contributionDays: data.contributionDays ?? {},
      timeDays: data.timeDays ?? {},
      secondsCoverage: data.secondsCoverage ?? null,
      endingsCoverage: data.endingsCoverage ?? null,
    }
  } catch (err) {
    console.error('[counter page]', username, err instanceof Error ? err.message : err)
    throw err
  }
}

async function loadProfilePage(uuid: string): Promise<CounterProfilePage> {
  try {
    const res = await apiFetch(`${API}/api/counter/profile_page/${uuid}`, {
      cache: 'no-store',
    })
    if (!res.ok) return { counterUUID: uuid, bio: null, socialLinks: null }
    return res.json()
  } catch {
    return { counterUUID: uuid, bio: null, socialLinks: null }
  }
}

async function loadRankProfile(username: string): Promise<CounterRankProfileResponse | null> {
  try {
    const res = await fetch(`${RANK_API}/api/rank/counter/${encodeURIComponent(username)}`, {
      next: { revalidate: 120 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function loadAchievements(uuid: string): Promise<{ earned: any[]; all: any[] }> {
  try {
    const res = await apiFetch(`${API}/api/counter/achievements/${uuid}`, {
      next: { revalidate: 120 },
    })
    if (!res.ok) return { earned: [], all: [] }
    const data = await res.json()
    return { earned: data.user_achievements ?? [], all: data.all_achievements ?? [] }
  } catch {
    return { earned: [], all: [] }
  }
}

type PageProps = {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params
  const decoded = decodeURIComponent(username)
  const result = await loadCounter(decoded)
  if (!result) return { title: 'Counter not found | counting.gg' }
  const c = result.counter
  const av = c.discordId && c.avatar?.length > 5
    ? `https://cdn.discordapp.com/avatars/${c.discordId}/${c.avatar}.png?size=128`
    : undefined
  return {
    title: `${c.name} | counting.gg`,
    openGraph: {
      title: `${c.name} | counting.gg`,
      images: [{ url: `/api/og/counter?user=${encodeURIComponent(decoded)}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${c.name} | counting.gg`,
      images: [`/api/og/counter?user=${encodeURIComponent(decoded)}`],
    },
  }
}

export default async function CounterPage({ params }: PageProps) {
  const { username } = await params
  const decoded = decodeURIComponent(username)

  const [result, rankProfile, session] = await Promise.all([
    loadCounter(decoded),
    loadRankProfile(decoded),
    getSession(),
  ])

  if (!result) notFound()

  const { counter, stats, contributionDays, timeDays, secondsCoverage, endingsCoverage } = result
  const isBanned = counter.roles.includes('banned')
  const viewerRoles = session?.counter?.roles ?? []
  const isMod = viewerRoles.some(r => r === 'mod' || r === 'admin')
  const isOwnProfile = session?.uuid === counter.uuid

  if (isBanned && !isMod) {
    return (
      <div style={{ padding: 32, color: '#888' }}>
        This user ({counter.uuid}) is banned.
      </div>
    )
  }

  const [{ earned: earnedAchievements, all: allAchievements }, profilePage] = await Promise.all([
    loadAchievements(counter.uuid),
    loadProfilePage(counter.uuid),
  ])

  const { all: allStats, ...threadStats } = stats
  const sortedStats = Object.entries(threadStats).sort(([, a], [, b]) => b.posts - a.posts)
  const joinTs = counterUuidToTimestamp(counter.uuid)

  return (
    <>
      <JsonLd
        data={profileJsonLd({
          name: counter.name || counter.username,
          username: counter.username,
          path: `/counter/${encodeURIComponent(counter.username)}`,
          avatarUrl: avatarUrl(counter),
          joined: joinTs ?? undefined,
          description: allStats
            ? `${allStats.counts.toLocaleString()} counts on counting.gg`
            : undefined,
        })}
      />
    <CounterPageClient
      counter={counter}
      profilePage={profilePage}
      avatarUrl={avatarUrl(counter)}
      sortedStats={sortedStats}
      allStats={allStats ?? null}
      rankProfile={rankProfile}
      earnedAchievements={earnedAchievements}
      allAchievements={allAchievements}
      isMod={isMod}
      isOwnProfile={isOwnProfile}
      joinTs={joinTs}
      contributionDays={contributionDays}
      timeDays={timeDays}
      secondsCoverage={secondsCoverage}
      endingsCoverage={endingsCoverage}
      viewerUuid={session?.uuid ?? null}
    />
    </>
  )
}

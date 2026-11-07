import type { Metadata } from 'next'
import { apiFetch } from '@/lib/apiFetch'
import { notFound } from 'next/navigation'
import RankThreadClient, {
  type LeaderboardEntry,
  type RankChallenge,
  type VolumeBucket,
} from './RankThreadClient'

const API = process.env.RANK_API_HOST || process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

interface ThreadLeaderboard {
  season?: { id: number; name: string; startedAt: string; endedAt: string | null }
  thread?: { uuid: string; name: string; title: string }
  entries: LeaderboardEntry[]
}

async function getLeaderboard(threadName: string): Promise<ThreadLeaderboard | null> {
  try {
    const res = await apiFetch(`${API}/api/rank/thread/${encodeURIComponent(threadName)}`, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function getChallenges(threadUuid: string): Promise<RankChallenge[]> {
  try {
    const res = await apiFetch(`${API}/api/rank/challenges?threadUuid=${encodeURIComponent(threadUuid)}&limit=500`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.items) ? data.items : []
  } catch {
    return []
  }
}

async function getVolume(threadUuid: string): Promise<VolumeBucket[]> {
  try {
    const q = new URLSearchParams({ bucketDays: '7', threadUuid })
    const res = await apiFetch(`${API}/api/rank/stats/volume?${q}`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: {
  params: Promise<{ name: string }>
}): Promise<Metadata> {
  const { name } = await params
  const threadName = decodeURIComponent(name)
  const lb = await getLeaderboard(threadName)
  const title = lb?.thread?.title ?? threadName
  return {
    title: `${title} rank | counting.gg`,
  }
}

export default async function RankThreadPage({ params }: {
  params: Promise<{ name: string }>
}) {
  const { name } = await params
  const threadName = decodeURIComponent(name)

  const leaderboard = await getLeaderboard(threadName)
  if (!leaderboard) notFound()

  const threadUuid = leaderboard.thread?.uuid
  const [challenges, volume] = threadUuid
    ? await Promise.all([getChallenges(threadUuid), getVolume(threadUuid)])
    : [[], []]

  return (
    <RankThreadClient
      threadName={leaderboard.thread?.name ?? threadName}
      threadTitle={leaderboard.thread?.title ?? threadName}
      season={leaderboard.season ?? null}
      entries={leaderboard.entries ?? []}
      challenges={challenges}
      volume={volume}
    />
  )
}

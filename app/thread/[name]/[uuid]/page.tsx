import type { Metadata } from 'next'
import { apiFetch } from '@/lib/apiFetch'
import { notFound } from 'next/navigation'
import { avatarUrl, buildCounterMap } from '@/lib/counterUtils'
import { getSession } from '@/lib/session'
import { resolvePrefs } from '@/lib/prefs'
import { toRenderPrefs } from '@/lib/renderPrefs'
import type { PostRow } from '@/components/thread/ThreadView'
import CountClient from './CountClient'
import { standardizeCountFormat } from '@/lib/postHelpers'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

interface Counter {
  uuid: string
  username: string
  name: string
  discordId: string
  avatar: string
  color: string
  emoji?: string
}

async function getCount(uuid: string) {
  try {
    const res = await apiFetch(`${API}/api/thread/getCountByUuid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    const post = data?.count?.[0]
    if (!post) return null
    return {
      post,
      counters: (data.counters ?? []) as Counter[],
      thread: data.thread as { uuid?: string; name?: string; title?: string; validationType?: string } | undefined,
    }
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: {
  params: Promise<{ name: string; uuid: string }>
}): Promise<Metadata> {
  const { name, uuid } = await params
  const data = await getCount(decodeURIComponent(uuid))
  if (!data) return { title: 'Count not found | counting.gg' }
  const label = data.post.rawCount
    ? standardizeCountFormat(data.post.rawCount, 'Commas', data.thread?.validationType)
    : data.post.countContent || data.post.rawText || 'Count'
  const threadTitle = data.thread?.title ?? decodeURIComponent(name)
  return {
    title: `${label} in ${threadTitle} | counting.gg`,
    description: data.post.comment || undefined,
  }
}

export default async function IndividualCountPage({ params }: {
  params: Promise<{ name: string; uuid: string }>
}) {
  const { name, uuid } = await params
  const threadName = decodeURIComponent(name)
  const [data, session] = await Promise.all([getCount(decodeURIComponent(uuid)), getSession()])
  if (!data) notFound()

  const counters = buildCounterMap(data.counters)
  const c = counters.get(data.post.authorUUID)
  const row: PostRow = {
    uuid: data.post.uuid,
    rawText: data.post.rawText ?? '',
    countContent: data.post.countContent,
    rawCount: data.post.rawCount,
    comment: data.post.comment,
    isValidCount: data.post.isValidCount,
    stricken: data.post.stricken,
    timestamp: data.post.timestamp,
    timeSinceLastPost: data.post.timeSinceLastPost,
    authorUUID: data.post.authorUUID,
    authorUsername: c?.username ?? 'unknown',
    authorName: c?.name ?? c?.username ?? 'unknown',
    authorColor: c?.color ?? '#888888',
    authorEmoji: c?.emoji,
    authorAvatarUrl: c ? avatarUrl(c) : undefined,
    reactions: data.post.reactions ?? undefined,
  }

  const threadTitle = data.thread?.title ?? threadName
  const prefs = toRenderPrefs(resolvePrefs(session?.userPrefs ?? null, data.thread?.uuid ?? null))

  return (
    <CountClient
      row={row}
      threadName={threadName}
      threadTitle={threadTitle}
      validationType={data.thread?.validationType}
      prefs={prefs}
      viewerUUID={session?.counter?.uuid}
      viewerRoles={session?.counter?.roles}
    />
  )
}

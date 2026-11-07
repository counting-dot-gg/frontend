import type { Metadata } from 'next'
import { apiFetch } from '@/lib/apiFetch'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { resolvePrefs } from '@/lib/prefs'
import { toRenderPrefs } from '@/lib/renderPrefs'
import { avatarUrl, buildCounterMap } from '@/lib/counterUtils'
import type { PostRow } from '@/components/thread/ThreadView'
import MentionsClient, { type MentionItem } from './MentionsClient'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

export const metadata: Metadata = {
  title: 'Mentions | counting.gg',
}

interface RawMentions {
  mentions: { postUUID: string; readStatus: boolean }[]
  posts: any[]
  counters: any[]
  threads: { uuid: string; name: string; title?: string; validationType?: string }[]
}

async function getMentions(cookieHeader: string): Promise<RawMentions | null> {
  try {
    const res = await apiFetch(`${API}/api/counter/getMentions`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export default async function MentionsPage() {
  const session = await getSession()
  if (!session) redirect('/')

  const cookieHeader = (await headers()).get('cookie') ?? ''

  const unreadOnArrival = session.unreadMentionCount ?? 0

  const data = await getMentions(cookieHeader)
  const prefs = toRenderPrefs(resolvePrefs(session.userPrefs ?? null, null))

  const counterMap = buildCounterMap<any>(data?.counters)
  const threadMap = new Map((data?.threads ?? []).map(t => [t.uuid, t]))

  const items: MentionItem[] = (data?.posts ?? []).map((p: any) => {
    const c = counterMap.get(p.authorUUID)
    const thread = threadMap.get(p.thread)
    const row: PostRow = {
      uuid: p.uuid,
      rawText: p.rawText ?? '',
      countContent: p.countContent,
      rawCount: p.rawCount,
      comment: p.comment,
      isValidCount: p.isValidCount,
      stricken: p.stricken,
      timestamp: p.timestamp,
      timeSinceLastPost: p.timeSinceLastPost,
      authorUUID: p.authorUUID,
      authorUsername: c?.username ?? 'unknown',
      authorName: c?.name ?? c?.username ?? 'unknown',
      authorColor: c?.color ?? '#888888',
      authorEmoji: c?.emoji,
      authorAvatarUrl: c ? avatarUrl(c) : undefined,
      reactions: p.reactions ?? undefined,
    }
    return {
      row,
      threadName: thread?.name ?? '',
      threadTitle: thread?.title ?? thread?.name ?? 'Unknown thread',
      validationType: thread?.validationType,
    }
  })

  return <MentionsClient items={items} prefs={prefs} unreadOnArrival={unreadOnArrival} />
}

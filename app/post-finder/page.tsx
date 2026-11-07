import type { Metadata } from 'next'
import { getSession } from '@/lib/session'
import PostFinderClient, { type FinderThread } from './PostFinderClient'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

export const metadata: Metadata = {
  title: 'Post Finder | counting.gg',
}

async function getThreads(): Promise<FinderThread[]> {
  try {
    const res = await fetch(`${API}/api/thread/all`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    const rows = await res.json()
    return (rows ?? []).map((t: any) => ({ uuid: t.uuid, name: t.name, title: t.title, validationType: t.validationType }))
  } catch {
    return []
  }
}

export default async function PostFinderPage() {
  const [threads, session] = await Promise.all([getThreads(), getSession()])
  const roles = session?.counter?.roles ?? []
  const canSearchComments = roles.includes('admin') || roles.includes('mod')
  return <PostFinderClient threads={threads} canSearchComments={canSearchComments} />
}

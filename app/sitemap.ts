import type { MetadataRoute } from 'next'
import { blogPath } from '@/lib/blogUrl'

export const revalidate = 3600

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

const url = (path: string) => `${SITE_URL}${path}`

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API}${path}`, { next: { revalidate } })
    if (!res.ok) return fallback
    return (await res.json()) as T
  } catch {
    return fallback
  }
}

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/', priority: 1.0, changeFrequency: 'hourly' },
  { path: '/threads', priority: 0.9, changeFrequency: 'daily' },
  { path: '/counters', priority: 0.8, changeFrequency: 'daily' },
  { path: '/blogs', priority: 0.7, changeFrequency: 'daily' },
  { path: '/stats', priority: 0.7, changeFrequency: 'daily' },
  { path: '/rank', priority: 0.7, changeFrequency: 'daily' },
  { path: '/achievements', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/bingo', priority: 0.6, changeFrequency: 'daily' },
  { path: '/rewards', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/emotes', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/feedback', priority: 0.5, changeFrequency: 'daily' },
  { path: '/lrwoed', priority: 0.5, changeFrequency: 'daily' },
  { path: '/shuffle', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/rules', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/contest-rules', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/uuid', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/privacy-policy', priority: 0.2, changeFrequency: 'yearly' },
]

type ThreadRow = { name: string; visibleTo?: string[] }
type BlogRow = { id: number; uuid: string; title: string; timestamp?: string; edited_timestamp?: string; hidden?: boolean }
type CounterRow = { username?: string; roles?: string[] }

const COUNTERS_PER_PAGE = 50

async function counterEntries(): Promise<MetadataRoute.Sitemap> {
  const first = await get<{ counters?: CounterRow[]; pageCount?: number | number[] }>(
    '/api/counter/counters/1',
    {},
  )
  const rows = [...(first.counters ?? [])]

  const rawTotal = Array.isArray(first.pageCount) ? first.pageCount[0] : first.pageCount
  const total = Number(rawTotal) || rows.length
  const pages = Math.min(Math.ceil(total / COUNTERS_PER_PAGE), 200)

  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
      get<{ counters?: CounterRow[] }>(`/api/counter/counters/${i + 2}`, {}),
    ),
  )
  for (const page of rest) rows.push(...(page.counters ?? []))

  const seen = new Set<string>()
  const out: MetadataRoute.Sitemap = []
  for (const c of rows) {
    if (!c.username) continue
    if (c.roles?.includes('banned')) continue
    if (seen.has(c.username)) continue
    seen.add(c.username)
    out.push({
      url: url(`/counter/${encodeURIComponent(c.username)}`),
      changeFrequency: 'weekly',
      priority: 0.5,
    })
  }
  return out
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const [threads, blogsPayload, counters] = await Promise.all([
    get<ThreadRow[]>('/api/thread/all', []),
    get<{ blogs?: BlogRow[] }>('/api/thread/blogs/1', {}),
    counterEntries(),
  ])

  const threadEntries: MetadataRoute.Sitemap = (Array.isArray(threads) ? threads : [])
    .filter((t) => t.name && (t.visibleTo ?? ['all']).includes('all'))
    .map((t) => ({
      url: url(`/thread/${encodeURIComponent(t.name)}`),
      lastModified: now,
      changeFrequency: 'hourly' as const,
      priority: 0.8,
    }))

  const blogEntries: MetadataRoute.Sitemap = (blogsPayload.blogs ?? [])
    .filter((b) => !b.hidden)
    .map((b) => {
      const stamp = b.edited_timestamp || b.timestamp
      const parsed = stamp ? new Date(Number(stamp) || stamp) : null
      return {
        url: url(blogPath(b)),
        lastModified: parsed && !isNaN(parsed.getTime()) ? parsed : undefined,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }
    })

  return [
    ...STATIC_ROUTES.map((r) => ({
      url: url(r.path),
      lastModified: now,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    })),
    ...threadEntries,
    ...blogEntries,
    ...counters,
  ]
}

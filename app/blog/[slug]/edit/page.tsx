import type { Metadata } from 'next'
import { apiFetch } from '@/lib/apiFetch'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { blogPath, parseBlogParam } from '@/lib/blogUrl'
import BlogEditClient from './BlogEditClient'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

export const metadata: Metadata = {
  title: 'Edit post | counting.gg',
  robots: { index: false, follow: false },
}

type Blog = {
  id: number
  uuid: string
  title: string
  body: string
  tags?: string[]
  author?: { uuid: string }
}

async function getBlog(param: string): Promise<Blog | null> {
  const { id, uuid } = parseBlogParam(param)
  const key = id ?? uuid
  if (!key) return null
  try {
    const res = await apiFetch(`${API}/api/thread/blog/${encodeURIComponent(String(key))}`, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export default async function BlogEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [blog, session] = await Promise.all([getBlog(slug), getSession()])
  if (!blog) notFound()

  const canEdit = !!session?.counter && session.counter.uuid === blog.author?.uuid
  if (!canEdit) redirect(blogPath(blog))

  return (
    <BlogEditClient
      blog={{ uuid: blog.uuid, title: blog.title, body: blog.body, tags: blog.tags ?? [] }}
    />
  )
}

import type { Metadata } from 'next'
import { blogPath, parseBlogTimestamp } from '@/lib/blogUrl'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Blog | counting.gg',
}

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

type Blog = {
  id: number
  uuid: string
  timestamp: string
  edited_timestamp: string
  title: string
  body: string
  author: { username: string; avatar?: string }
  tags: string[]
  views: number
}

async function getBlogs(page: number): Promise<{ blogs: Blog[]; pageCount: number }> {
  try {
    const res = await fetch(`${API}/api/thread/blogs/${page}`, { next: { revalidate: 60 } })
    if (!res.ok) return { blogs: [], pageCount: 0 }
    const data = await res.json()
    return { blogs: data?.blogs ?? [], pageCount: Number(data?.pageCount ?? 0) }
  } catch {
    return { blogs: [], pageCount: 0 }
  }
}

function blogDate(ts: string): string {
  const d = parseBlogTimestamp(ts)
  return d ? d.toLocaleDateString('en-US') : ''
}

export default async function BlogsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const { blogs, pageCount } = await getBlogs(page)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-0)', padding: '32px 16px 64px' }}>
      <style>{`.blog-card:hover > div { background: rgb(var(--ink-rgb) / 0.045) !important; }`}</style>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, fontFamily: 'monospace', color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>
              BLOG
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-3)', fontFamily: 'monospace' }}>
              news & updates
            </p>
          </div>
          <Link href="/blog/create" style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '8px 20px',
            background: 'rgba(249,115,22,0.12)',
            border: '1px solid rgba(249,115,22,0.35)',
            color: '#f97316',
            fontFamily: 'monospace', fontWeight: 700, fontSize: 11,
            letterSpacing: '0.18em', textDecoration: 'none', textTransform: 'uppercase',
            clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
            transition: 'background 0.15s',
          }}>
            + NEW POST
          </Link>
        </div>

        {blogs.length === 0 ? (
          <div style={{ color: 'var(--ink-3)', fontFamily: 'monospace', fontSize: 13, padding: '48px 0' }}>
            No posts yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {blogs.map((blog, i) => (
              <BlogCard key={blog.uuid} blog={blog} index={i} />
            ))}
          </div>
        )}

        {pageCount > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 32, justifyContent: 'center' }}>
            {page > 1 && (
              <Link href={`/blogs?page=${page - 1}`} style={paginationStyle}>← PREV</Link>
            )}
            <span style={{ ...paginationStyle, color: '#f97316', borderColor: 'rgba(249,115,22,0.3)', cursor: 'default' }}>
              {page} / {pageCount}
            </span>
            {page < pageCount && (
              <Link href={`/blogs?page=${page + 1}`} style={paginationStyle}>NEXT →</Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const paginationStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  padding: '6px 16px',
  background: 'rgb(var(--ink-rgb) / 0.03)',
  border: '1px solid rgb(var(--ink-rgb) / 0.08)',
  color: 'rgb(var(--ink-rgb) / 0.5)',
  fontFamily: 'monospace', fontWeight: 700, fontSize: 10,
  letterSpacing: '0.15em', textDecoration: 'none',
}

function BlogCard({ blog, index }: { blog: Blog; index: number }) {
  const preview = blog.body.replace(/[#*`>\[\]]/g, '').slice(0, 220).trim()
  const accent = ['#f97316', '#38bdf8', '#a78bfa', 'var(--warn)', '#34d399'][index % 5]

  return (
    <Link href={blogPath(blog)} className="blog-card" style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        padding: '20px 24px',
        background: 'rgb(var(--ink-rgb) / 0.025)',
        border: '1px solid rgb(var(--ink-rgb) / 0.06)',
        borderLeft: `3px solid ${accent}`,
        cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--ink-1)', lineHeight: 1.3 }}>
            {blog.title}
          </h2>
          <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--ink-3)', fontFamily: 'monospace', marginTop: 2 }}>
            {blogDate(blog.timestamp)}
          </span>
        </div>

        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10, fontFamily: 'monospace' }}>
          by {blog.author?.username ?? 'unknown'}
        </div>

        {preview && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            {preview}{blog.body.length > 220 ? '…' : ''}
          </p>
        )}

        {blog.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {blog.tags.map(tag => (
              <span key={tag} style={{
                fontSize: 10, padding: '2px 8px',
                background: `${accent}18`, color: accent,
                border: `1px solid ${accent}33`,
                fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.05em',
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}

import type { Metadata } from 'next'
import { apiFetch } from '@/lib/apiFetch'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { avatarUrl } from '@/lib/counterUtils'
import { getSession } from '@/lib/session'
import BlogReactions from './BlogReactions'
import { blogPath, parseBlogParam, parseBlogTimestamp } from '@/lib/blogUrl'
import { JsonLd, articleJsonLd } from '@/lib/jsonLd'
import HideBlogButton from './HideBlogButton'
import remarkGfm from 'remark-gfm'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

type Blog = {
  id: number
  uuid: string
  timestamp: string
  edited_timestamp: string
  title: string
  body: string
  reactions?: Record<string, string[]> | null
  author: { username: string; avatar?: string; uuid: string; discordId?: string }
  hidden?: boolean
  tags: string[]
  views: number
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

function formatBlogDate(timestamp: string): string | null {
  const d = parseBlogTimestamp(timestamp)
  if (!d) return null
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const blog = await getBlog(slug)
  if (!blog) return { title: 'Blog | counting.gg' }
  return {
    title: `${blog.title} | counting.gg`,
    description: blog.body.replace(/[#*`>\[\]]/g, '').slice(0, 160),
  }
}

export default async function BlogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [blog, session] = await Promise.all([getBlog(slug), getSession()])
  if (!blog) notFound()

  const canonical = blogPath(blog)
  if (`/blog/${slug}` !== canonical) permanentRedirect(canonical)

  const canEdit = !!session?.counter && session.counter.uuid === blog.author?.uuid
  const canModerate = !!session?.counter?.roles?.some(r => r === 'admin' || r === 'mod')
  const roles = session?.counter?.roles ?? []
  const canReact = roles.includes('counter') && !roles.includes('banned') && !roles.includes('muted')

  if (blog.hidden && !canEdit && !canModerate) notFound()

  const date = formatBlogDate(blog.timestamp)
  const edited = blog.edited_timestamp && blog.edited_timestamp !== blog.timestamp
    ? formatBlogDate(blog.edited_timestamp)
    : null

  const avatar = blog.author?.discordId && blog.author?.avatar
    ? avatarUrl({ discordId: blog.author.discordId, avatar: blog.author.avatar })
    : undefined

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-0)', padding: '32px 16px 80px' }}>
      {!blog.hidden && (
        <JsonLd
          data={articleJsonLd({
            title: blog.title,
            description: blog.body.replace(/[#*`>\[\]]/g, '').slice(0, 160),
            path: canonical,
            published: blog.timestamp,
            modified: blog.edited_timestamp,
            authorName: blog.author?.username,
            authorPath: blog.author?.username ? `/counter/${blog.author.username}` : undefined,
          })}
        />
      )}
      <style>{`
        .blog-body h1, .blog-body h2, .blog-body h3 {
          color: var(--ink-1); margin: 1.5em 0 0.5em; font-weight: 800; line-height: 1.25;
        }
        .blog-body h1 { font-size: 1.6em; }
        .blog-body h2 { font-size: 1.3em; }
        .blog-body h3 { font-size: 1.1em; }
        .blog-body p { margin: 0 0 1em; color: rgb(var(--ink-rgb) / 0.75); line-height: 1.7; font-size: 15px; }
        .blog-body a { color: #f97316; text-decoration: underline; }
        .blog-body ul, .blog-body ol { margin: 0 0 1em 1.4em; color: rgb(var(--ink-rgb) / 0.75); line-height: 1.7; font-size: 15px; }
        .blog-body li { margin-bottom: 0.25em; }
        .blog-body blockquote { margin: 1em 0; padding: 0.5em 0 0.5em 1em; border-left: 3px solid #f97316; color: rgb(var(--ink-rgb) / 0.45); font-style: italic; }
        .blog-body code { background: rgb(var(--ink-rgb) / 0.08); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.88em; color: var(--warn); }
        .blog-body pre { background: rgb(var(--ink-rgb) / 0.06); padding: 16px; border-radius: 6px; overflow-x: auto; margin: 0 0 1em; }
        .blog-body pre code { background: none; padding: 0; color: var(--ink-1); }
        .blog-body hr { border: none; border-top: 1px solid rgb(var(--ink-rgb) / 0.08); margin: 2em 0; }
        .blog-body table { width: 100%; border-collapse: collapse; margin: 0 0 1em; font-size: 14px; }
        .blog-body th { background: rgb(var(--ink-rgb) / 0.06); color: var(--ink-1); font-weight: 700; padding: 8px 12px; text-align: left; border-bottom: 1px solid rgb(var(--ink-rgb) / 0.1); }
        .blog-body td { padding: 8px 12px; color: rgb(var(--ink-rgb) / 0.65); border-bottom: 1px solid rgb(var(--ink-rgb) / 0.05); }
        .blog-body img { max-width: 100%; border-radius: 6px; }
        .blog-body strong { color: var(--ink-1); font-weight: 700; }
        .blog-body em { color: rgb(var(--ink-rgb) / 0.7); }
      `}</style>

      <div style={{ maxWidth: 740, margin: '0 auto' }}>

        <div style={{ marginBottom: 28, fontSize: 12.5, fontFamily: 'monospace', color: 'rgb(var(--ink-rgb) / 0.5)' }}>
          <Link href="/blogs" style={{ color: 'rgb(var(--ink-rgb) / 0.72)', textDecoration: 'none' }}>BLOG</Link>
          <span style={{ margin: '0 8px' }}>›</span>
          <span style={{ color: 'rgb(var(--ink-rgb) / 0.5)' }}>{blog.title}</span>
        </div>

        <h1 style={{
          margin: '0 0 16px',
          fontSize: 'clamp(24px, 4vw, 40px)',
          fontWeight: 900,
          color: 'var(--ink-1)',
          lineHeight: 1.2,
          letterSpacing: '-0.02em',
        }}>
          {blog.title}
        </h1>

        {blog.hidden && (
          <div style={{
            marginBottom: 20, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.35)',
            color: '#facc15', fontSize: 13, fontWeight: 600,
          }}>
            This post is unpublished: it isn&rsquo;t listed publicly.
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
          {avatar && (
            <img
              src={avatar}
              alt=""
              width={28}
              height={28}
              style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
            />
          )}
          <span style={{ fontSize: 14, color: 'rgb(var(--ink-rgb) / 0.72)', fontFamily: 'monospace' }}>
            by{' '}
            <Link href={`/counter/${blog.author?.username}`} style={{ color: '#f97316', textDecoration: 'none' }}>
              {blog.author?.username ?? 'unknown'}
            </Link>
          </span>
          {date && (
            <span style={{ fontSize: 13, color: 'rgb(var(--ink-rgb) / 0.6)', fontFamily: 'monospace' }}>{date}</span>
          )}
          {edited && (
            <span style={{ fontSize: 12, color: 'rgb(var(--ink-rgb) / 0.45)', fontFamily: 'monospace' }}>
              (edited {edited})
            </span>
          )}
        </div>

        {blog.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 28 }}>
            {blog.tags.map(tag => (
              <span key={tag} style={{
                fontSize: 10, padding: '3px 10px',
                background: 'rgba(249,115,22,0.1)', color: '#f97316',
                border: '1px solid rgba(249,115,22,0.25)',
                fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.05em',
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(249,115,22,0.35), transparent)', marginBottom: 32 }} />

        <div className="blog-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {blog.body}
          </ReactMarkdown>
        </div>

        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid rgb(var(--ink-rgb) / 0.08)' }}>
          <BlogReactions
            blogUuid={blog.uuid}
            initial={blog.reactions ?? null}
            meUuid={session?.counter?.uuid ?? null}
            canReact={canReact}
          />
        </div>

        <div style={{
          marginTop: 32, paddingTop: 24,
          borderTop: '1px solid rgb(var(--ink-rgb) / 0.12)',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <Link href="/blogs" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 10,
            background: 'rgb(var(--ink-rgb) / 0.06)',
            border: '1px solid rgb(var(--ink-rgb) / 0.16)',
            fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
            color: 'var(--ink-1)', textDecoration: 'none',
          }}>
            ← All posts
          </Link>

          {canModerate && <HideBlogButton uuid={blog.uuid} hidden={!!blog.hidden} />}

          {canEdit && (
            <Link href={`${blogPath(blog)}/edit`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 10,
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              border: '1px solid transparent',
              fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
              color: '#fff', textDecoration: 'none',
            }}>
              Edit post
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

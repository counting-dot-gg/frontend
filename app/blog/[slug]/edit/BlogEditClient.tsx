'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { API } from '@/lib/apiBase'

export interface EditableBlog {
  uuid: string
  title: string
  body: string
  tags?: string[]
}

export default function BlogEditClient({ blog }: { blog: EditableBlog }) {
  const router = useRouter()
  const [title, setTitle] = useState(blog.title)
  const [body, setBody] = useState(blog.body)
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(blog.tags ?? [])
  const [preview, setPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addTag(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const t = tagInput.trim().toLowerCase().slice(0, 20)
    if (t && tags.length < 4 && !tags.includes(t)) {
      setTags(prev => [...prev, t])
    }
    setTagInput('')
  }

  function removeTag(tag: string) {
    setTags(prev => prev.filter(t => t !== tag))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/api/updateBlogPost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uuid: blog.uuid, title: title.trim(), body: body.trim(), tags }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Failed to save changes')
      router.push(`/blog/${blog.uuid}`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-0)', padding: '32px 16px 80px' }}>
      <style>{`
        .blog-preview h1, .blog-preview h2, .blog-preview h3 { color: var(--ink-1); margin: 1.4em 0 0.4em; font-weight: 800; }
        .blog-preview h1 { font-size: 1.5em; }
        .blog-preview h2 { font-size: 1.25em; }
        .blog-preview h3 { font-size: 1.05em; }
        .blog-preview p { margin: 0 0 1em; color: rgb(var(--ink-rgb) / 0.75); line-height: 1.7; font-size: 15px; }
        .blog-preview a { color: #f97316; }
        .blog-preview ul, .blog-preview ol { margin: 0 0 1em 1.4em; color: rgb(var(--ink-rgb) / 0.75); font-size: 15px; line-height: 1.7; }
        .blog-preview blockquote { margin: 1em 0; padding: 0.5em 0 0.5em 1em; border-left: 3px solid #f97316; color: rgb(var(--ink-rgb) / 0.45); font-style: italic; }
        .blog-preview code { background: rgb(var(--ink-rgb) / 0.08); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.88em; color: var(--warn); }
        .blog-preview pre { background: rgb(var(--ink-rgb) / 0.06); padding: 16px; border-radius: 6px; overflow-x: auto; margin: 0 0 1em; }
        .blog-preview pre code { background: none; padding: 0; color: var(--ink-1); }
        .blog-preview hr { border: none; border-top: 1px solid rgb(var(--ink-rgb) / 0.08); margin: 2em 0; }
        .blog-preview strong { color: var(--ink-1); }
      `}</style>

      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 28px', fontSize: 28, fontWeight: 900, fontFamily: 'monospace', color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>
          EDIT POST
        </h1>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgb(var(--ink-rgb) / 0.08)' }}>
          {(['write', 'preview'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setPreview(tab === 'preview')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '8px 16px', fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: (preview ? tab === 'preview' : tab === 'write') ? '#f97316' : 'rgb(var(--ink-rgb) / 0.3)',
                borderBottom: (preview ? tab === 'preview' : tab === 'write') ? '2px solid #f97316' : '2px solid transparent',
                marginBottom: -1, transition: 'color 0.15s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {preview ? (
          <div style={{ padding: '24px 0' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 28, fontWeight: 900, color: 'var(--ink-1)' }}>{title || 'Untitled'}</h2>
            <div className="blog-preview">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body || '*Nothing to preview.*'}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Title"
              maxLength={200}
              required
              style={{
                background: 'rgb(var(--ink-rgb) / 0.04)',
                border: '1px solid rgb(var(--ink-rgb) / 0.1)',
                borderRadius: 6,
                padding: '12px 16px',
                fontSize: 20, fontWeight: 700, color: 'var(--ink-1)',
                outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
            />

            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your post (Markdown supported)…"
              maxLength={20000}
              rows={18}
              required
              style={{
                background: 'rgb(var(--ink-rgb) / 0.04)',
                border: '1px solid rgb(var(--ink-rgb) / 0.1)',
                borderRadius: 6,
                padding: '12px 16px',
                fontSize: 14, color: 'rgb(var(--ink-rgb) / 0.8)',
                fontFamily: 'monospace', lineHeight: 1.6,
                outline: 'none', resize: 'vertical',
                width: '100%', boxSizing: 'border-box',
              }}
            />

            <div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgb(var(--ink-rgb) / 0.3)', marginBottom: 8, letterSpacing: '0.1em' }}>
                TAGS (max 4, press Enter)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {tags.map(tag => (
                  <span key={tag} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 11, padding: '3px 10px',
                    background: 'rgba(249,115,22,0.12)', color: '#f97316',
                    border: '1px solid rgba(249,115,22,0.3)',
                    fontFamily: 'monospace', fontWeight: 700,
                  }}>
                    {tag}
                    <button onClick={() => removeTag(tag)} type="button" style={{
                      background: 'none', border: 'none', color: '#f97316', cursor: 'pointer',
                      padding: 0, fontSize: 12, lineHeight: 1,
                    }}>×</button>
                  </span>
                ))}
              </div>
              {tags.length < 4 && (
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={addTag}
                  placeholder="add tag…"
                  maxLength={20}
                  style={{
                    background: 'rgb(var(--ink-rgb) / 0.04)',
                    border: '1px solid rgb(var(--ink-rgb) / 0.08)',
                    borderRadius: 4, padding: '6px 12px',
                    fontSize: 12, color: 'var(--ink-1)', fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
              )}
            </div>

            {error && (
              <div style={{ fontSize: 13, color: 'var(--danger)', fontFamily: 'monospace' }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="submit"
                disabled={submitting || !title.trim() || !body.trim()}
                style={{
                  padding: '10px 28px',
                  background: submitting ? 'rgba(249,115,22,0.3)' : '#f97316',
                  border: 'none', color: '#000',
                  fontFamily: 'monospace', fontWeight: 900, fontSize: 12,
                  letterSpacing: '0.15em', textTransform: 'uppercase',
                  clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {submitting ? 'SAVING…' : 'SAVE CHANGES'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

'use client'

import { useMemo, useSyncExternalStore } from 'react'
import DOMPurify from 'dompurify'
import { LC_THREAD_ID } from '@/lib/reddit'
import type { LagStats, RedditAbout } from './useRedditFeed'

const label: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
  color: 'rgb(var(--ink-rgb) / 0.3)', marginBottom: 4,
}

function decodeEntities(html: string): string {
  return html
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function cleanRedditHtml(html: string): string {
  const fragment = DOMPurify.sanitize(decodeEntities(html), {
    RETURN_DOM_FRAGMENT: true,
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'],
  })
  fragment.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href') ?? ''
    if (href.startsWith('/') && !href.startsWith('//')) a.setAttribute('href', `https://www.reddit.com${href}`)
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noreferrer noopener')
  })
  const holder = document.createElement('div')
  holder.appendChild(fragment)
  return holder.innerHTML
}

const subscribeNever = () => () => {}

function Markup({ html }: { html: string }) {
  const onClient = useSyncExternalStore(subscribeNever, () => true, () => false)
  const clean = useMemo(() => (onClient ? cleanRedditHtml(html) : ''), [onClient, html])
  return (
    <div
      className="reddit-markup"
      style={{ fontSize: 13, lineHeight: 1.6, color: 'rgb(var(--ink-rgb) / 0.75)', overflowWrap: 'anywhere' }}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}

const linkStyle: React.CSSProperties = {
  color: 'var(--primary, #f97316)', textDecoration: 'none', fontSize: 12,
}

export function RedditAboutTab({ about, reddit, isLoggedIn, lag, latency, status }: {
  about: RedditAbout | null
  reddit?: string
  isLoggedIn?: boolean
  lag?: LagStats
  latency?: LagStats
  status?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12,
        paddingBottom: 12, borderBottom: '1px solid rgb(var(--ink-rgb) / 0.08)',
      }}>
        <a href={`https://reddit.com/live/${LC_THREAD_ID}`} target="_blank" rel="noreferrer" style={linkStyle}>
          Open on Reddit →
        </a>
        {reddit ? (
          <>
            <span style={{ fontSize: 12, color: 'rgb(var(--ink-rgb) / 0.4)' }}>
              Posting as <strong style={{ color: 'rgb(var(--ink-rgb) / 0.65)' }}>/u/{reddit}</strong>
            </span>
            <a href="/api/auth/reddit_logout" style={{ ...linkStyle, color: 'var(--danger)', marginLeft: 'auto' }}>
              Log out
            </a>
          </>
        ) : (
          <a
            href={isLoggedIn ? '/api/auth/reddit_login' : (process.env.NEXT_PUBLIC_LOGIN ?? '/api/auth/login')}
            style={{ ...linkStyle, marginLeft: 'auto' }}
          >
            {isLoggedIn ? 'Link your Reddit account →' : 'Sign in to post →'}
          </a>
        )}
      </div>

      {((lag && lag.samples.length > 0) || (latency && latency.samples.length > 0)) && (
        <div style={{ paddingBottom: 16, borderBottom: '1px solid rgb(var(--ink-rgb) / 0.08)' }}>
          <RedditLagTab
            lag={lag ?? { samples: [], median: null, mean: null, min: null, max: null }}
            latency={latency}
            status={status ?? ''}
          />
        </div>
      )}

      {!about ? (
        <div style={{ fontSize: 13, color: '#666' }}>Loading Reddit thread info…</div>
      ) : (
        <RedditSidebar about={about} />
      )}
    </div>
  )
}

function RedditSidebar({ about }: { about: RedditAbout }) {
  if (!about.resourcesHtml) {
    return <div style={{ fontSize: 13, color: '#666' }}>This thread has no sidebar.</div>
  }
  return (
    <div>
      <style>{`
        .reddit-markup a { color: var(--primary, #f97316); }
        .reddit-markup h1, .reddit-markup h2, .reddit-markup h3 { font-size: 14px; margin: 10px 0 4px; color: var(--ink-1); }
        .reddit-markup p { margin: 0 0 8px; }
        .reddit-markup ul, .reddit-markup ol { margin: 0 0 8px; padding-left: 20px; }
        .reddit-markup hr { border: none; border-top: 1px solid rgb(var(--ink-rgb) / 0.1); margin: 10px 0; }
        .reddit-markup table { border-collapse: collapse; font-size: 12px; }
        .reddit-markup td, .reddit-markup th { border: 1px solid rgb(var(--ink-rgb) / 0.12); padding: 3px 6px; }
        .reddit-markup img { max-width: 100%; height: auto; }
      `}</style>
      <Markup html={about.resourcesHtml} />
    </div>
  )
}

export function RedditLagTab({ lag, latency, status }: {
  lag: LagStats
  latency?: LagStats
  status: string
}) {
  const primary = latency && latency.samples.length ? latency : lag
  const isLatency = primary === latency
  const { samples, median, mean, min, max } = primary

  const stat = (v: number | null, name: string, tint?: string) => (
    <div>
      <div style={{
        fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
        color: tint ?? 'var(--ink-1)',
      }}>
        {v == null ? '-' : `${v > 0 ? '+' : ''}${v.toLocaleString()}`}
        {v != null && <span style={{ fontSize: 11, fontWeight: 400, color: '#666' }}>ms</span>}
      </div>
      <div style={{ ...label, marginTop: 2, marginBottom: 0 }}>{name}</div>
    </div>
  )

  const signed = !isLatency
  const bound = Math.max(50, ...samples.map(s => Math.abs(s)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{ ...label, marginBottom: 0, cursor: 'help' }}
        title={isLatency
          ? 'Round trip from pressing send to Reddit confirming your post came back. Measured only on your own posts.'
          : 'counting.gg shows your post immediately using a predicted timestamp, then Reddit confirms the real one. This is the gap between the two.'}
      >
        {isLatency ? 'Your post latency' : 'Your post lag'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(78px, 1fr))', gap: 14 }}>
        {stat(median, 'Median', median != null && Math.abs(median) < 250 ? 'var(--success)' : 'var(--warn)')}
        {stat(mean, 'Mean')}
        {stat(min, 'Best')}
        {stat(max, 'Worst')}
      </div>

      {isLatency && lag.median != null && (
        <div style={{ fontSize: 11, color: '#666' }}>
          Timestamp prediction off by{' '}
          <strong style={{ color: '#9aa4b8', fontVariantNumeric: 'tabular-nums' }}>
            {lag.median > 0 ? '+' : ''}{lag.median.toLocaleString()}ms
          </strong>{' '}
          median over {lag.samples.length} post{lag.samples.length === 1 ? '' : 's'}
        </div>
      )}

      {samples.length === 0 ? (
        <div style={{ fontSize: 12, color: '#666' }}>
          {status === 'live'
            ? 'No samples yet: post a count to start measuring.'
            : 'Waiting for the Reddit feed to connect.'}
        </div>
      ) : (
        <div>
          <div style={label}>Last {samples.length} posts</div>
          <div style={{
            display: 'flex', alignItems: 'stretch', gap: 2, height: 64,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', left: 0, right: 0, top: signed ? '50%' : '100%',
              borderTop: '1px dashed rgb(var(--ink-rgb) / 0.15)',
            }} />
            {samples.map((s, i) => {
              const frac = Math.min(1, Math.abs(s) / bound)
              return (
                <div key={i} title={`${s > 0 ? '+' : ''}${s}ms`} style={{
                  flex: '1 1 0', minWidth: 2, maxWidth: 10, position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', left: 0, right: 0,
                    top: signed ? (s >= 0 ? `${50 - frac * 50}%` : '50%') : `${100 - frac * 100}%`,
                    height: signed ? `${frac * 50}%` : `${frac * 100}%`,
                    background: Math.abs(s) < 250 ? 'var(--success)' : 'var(--warn)',
                    borderRadius: 1,
                  }} />
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>
            {signed
              ? `▲ Reddit slower than predicted · ▼ faster · scale ±${bound}ms`
              : `scale 0–${bound}ms · lower is better`}
          </div>
        </div>
      )}
    </div>
  )
}

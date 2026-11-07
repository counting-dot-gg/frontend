'use client'

import { useEffect, useState } from 'react'
import { loadRedditUserColors, redditUserColor } from '@/lib/redditUserColors'

const POLL_MS = 20_000

interface HocRow { author: string; counts: number; has_wrc_req?: boolean }
interface Board { hoc: HocRow[]; total_counts: number }
interface Feed {
  day?: Board
  '100k'?: Board
  latest_count?: number
}

const MEDALS: Record<number, { bg: string; color: string }> = {
  1: { bg: 'rgba(255,215,0,0.14)',   color: 'var(--gold)' },
  2: { bg: 'rgba(192,192,192,0.14)', color: '#c0c0c0' },
  3: { bg: 'rgba(205,127,50,0.14)',  color: '#cd7f32' },
}

export default function RedditStatsTab() {
  const [feed, setFeed] = useState<Feed | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [colorsReady, setColorsReady] = useState(false)

  useEffect(() => { loadRedditUserColors().then(() => setColorsReady(true)) }, [])

  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetch('/api/reddit-daily-stats')
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then(d => {
          if (cancelled) return
          if (d?.error) throw new Error(d.error)
          setFeed(d)
          setError(null)
        })
        .catch(() => { if (!cancelled) setError('Could not load /r/livecounting stats.') })

    load()
    const timer = setInterval(load, POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  if (error && !feed) {
    return <div style={{ flex: 1, padding: '12px 16px', fontSize: 13, color: 'var(--danger)' }}>{error}</div>
  }
  if (!feed) {
    return <div style={{ flex: 1, padding: '12px 16px', fontSize: 13, color: '#666' }}>Loading stats…</div>
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
      {feed.latest_count != null && (
        <div style={{ fontSize: 11, color: '#666', marginBottom: 14 }}>
          Stats as of {feed.latest_count.toLocaleString()}
        </div>
      )}

      <Board title="Today" board={feed.day} colorsReady={colorsReady} />
      <Board title="This 100k" board={feed['100k']} colorsReady={colorsReady} />
    </div>
  )
}

function Board({ title, board, colorsReady }: { title: string; board?: Board; colorsReady: boolean }) {
  if (!board?.hoc?.length) return null
  const sorted = [...board.hoc].sort((a, b) => b.counts - a.counts)

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{title}</span>
        <span style={{ fontSize: 11, color: '#555' }}>
          {board.total_counts.toLocaleString()} counts
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <tbody>
          {sorted.map((row, i) => {
            const m = MEDALS[i + 1]
            const color = colorsReady ? redditUserColor(row.author) : '#8ea2c6'
            return (
              <tr key={row.author} style={{ borderBottom: '1px solid rgb(var(--ink-rgb) / 0.04)' }}>
                <td style={{
                  padding: '4px 6px', textAlign: 'center', width: 28, fontSize: 11,
                  background: m?.bg ?? 'transparent', color: m?.color ?? '#666', fontWeight: m ? 700 : 400,
                }}>{i + 1}</td>
                <td style={{ padding: '4px 6px' }}>
                  <a
                    href={`https://reddit.com/user/${row.author}`}
                    target="_blank" rel="noreferrer"
                    style={{ color, textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                  >
                    {row.author}
                  </a>
                  {row.has_wrc_req && (
                    <span title="Has the counts required for WRC" style={{ marginLeft: 6, fontSize: 10, color: 'var(--success-ink)' }}>
                      WRC
                    </span>
                  )}
                </td>
                <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace', color: '#aaa' }}>
                  {row.counts.toLocaleString()}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import { LOGO_DATA_URI } from '../logo'

export const runtime = 'edge'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'
const MAX_POSTS = 5000

interface ApiPost {
  uuid: string
  isCount: boolean
  isValidCount: boolean
  stricken: boolean
  rawCount?: string | number
  validCountNumber?: number
  timeSinceLastCount?: number
  timeSinceLastPost?: number
  timestamp: string
  authorUUID: string
}

interface ApiCounter {
  uuid: string
  username: string
  name: string
  discordId: string
  avatar: string
  color: string
}

interface Thread {
  uuid: string
  name: string
  title: string
  countsPerSplit?: number
  splitsPerGet?: number
}

async function getThread(name: string): Promise<Thread | null> {
  try {
    const r = await fetch(`${API}/api/thread/${encodeURIComponent(name)}`, { next: { revalidate: 300 } })
    return r.ok ? r.json() : null
  } catch { return null }
}

async function findStartPost(threadUuid: string, number: number): Promise<{ uuid: string; timestamp?: string } | null> {
  try {
    const r = await fetch(`${API}/api/thread/findPostByThreadAndNumber`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number, thread: threadUuid }),
      cache: 'no-store',
    })
    if (!r.ok) return null
    const data = await r.json()
    const post = data.posts?.[0]
    return post ? { uuid: post.uuid, timestamp: post.timestamp } : null
  } catch { return null }
}

async function loadPosts(
  threadName: string, startUuid: string, end: number | null
): Promise<{ posts: ApiPost[]; counters: ApiCounter[]; truncated: boolean }> {
  const allPosts: ApiPost[] = []
  const counterMap = new Map<string, ApiCounter>()
  let cursor = startUuid
  let loadedNewest = false
  let reachedEnd = false

  while (!loadedNewest && allPosts.length < MAX_POSTS) {
    try {
      const r = await fetch(
        `${API}/api/thread/loadNewerCounts?thread_name=${encodeURIComponent(threadName)}&uuid=${cursor}&limit=1000`,
        { cache: 'no-store' }
      )
      if (!r.ok) break
      const data = await r.json()
      for (const c of data.counters ?? []) if (c?.uuid) counterMap.set(c.uuid, c)
      const batch: ApiPost[] = data.counts ?? []

      if (end != null) {
        const cut = batch.findIndex(p => p.validCountNumber != null && p.validCountNumber > end)
        if (cut !== -1) { allPosts.push(...batch.slice(0, cut)); reachedEnd = true; break }
      }
      allPosts.push(...batch)
      loadedNewest = data.loadedNewest ?? false
      if (!batch.length) break
      cursor = batch[batch.length - 1].uuid
    } catch { break }
  }

  const truncated = !reachedEnd && !loadedNewest && allPosts.length >= MAX_POSTS

  return { posts: allPosts, counters: Array.from(counterMap.values()), truncated }
}

function avatarUrl(c: ApiCounter): string {
  return c.discordId && c.avatar && c.avatar.length > 5
    ? `https://cdn.discordapp.com/avatars/${c.discordId}/${c.avatar}.png?size=64`
    : ''
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms))
  const hours = Math.floor(total / 3_600_000)
  const minutes = Math.floor((total % 3_600_000) / 60_000)
  const seconds = Math.floor((total % 60_000) / 1000)
  const millis = total % 1000

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
  }
  return `${seconds}.${String(millis).padStart(3, '0')}`
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

type PaceResult = {
  replayType: 'get' | 'split' | 'range'
  getSize: number
  splitSize: number
  medianPaceMs: number
  totalTimeMs: number
  cleanTimeMs: number
  timeLostMs: number
  totalMistakes: number
  mistakesPerSplit: number
  mistakesPerGet: number
}

function computePace(posts: ApiPost[], countsPerSplit: number, splitsPerGet: number, anchorTimestamp?: string | null): PaceResult {
  const getSize = countsPerSplit * splitsPerGet

  const counts = posts.filter(p => p.isCount)

  const gapByIndex: (number | null)[] = new Array(counts.length).fill(null)
  {
    const anchor = Number(anchorTimestamp)
    let prevValid: number | null = Number.isFinite(anchor) ? anchor : null
    for (let i = 0; i < counts.length; i++) {
      const p = counts[i]
      if (!p.isValidCount || p.stricken) continue
      const cur = Number(p.timestamp)
      if (!Number.isFinite(cur)) continue
      if (prevValid == null) {
        const t = Number(p.timeSinceLastCount)
        gapByIndex[i] = Number.isFinite(t) && t > 0 ? t : null
      } else if (cur > prevValid) {
        gapByIndex[i] = cur - prevValid
      }
      prevValid = cur
    }
  }

  const validGaps: number[] = []
  let totalTimeMs = 0
  let totalMistakes = 0
  let totalValidCounts = 0

  counts.forEach((p, i) => {
    const gap = gapByIndex[i]
    if (gap != null) totalTimeMs += gap
    if (!p.isValidCount || p.stricken) { totalMistakes++; return }
    totalValidCounts++
    if (gap != null) validGaps.push(gap)
  })

  const medianPaceMs = medianOf(validGaps)
  const THRESHOLD = 1.5
  const RECOVERY_STABLE = 3

  type CountEv = { valid: boolean; gap: number | null }
  const events: CountEv[] = counts.map((p, i) => ({
    valid: p.isValidCount && !p.stricken,
    gap: gapByIndex[i],
  }))

  let timeLostMs = 0
  let i = 0
  while (i < events.length) {
    const ev = events[i]
    if (ev.valid) { i++; continue }
    if (ev.gap != null && ev.gap > medianPaceMs) timeLostMs += ev.gap - medianPaceMs
    i++
    let stableStreak = 0
    while (i < events.length) {
      const rec = events[i]
      const gap = rec.gap ?? medianPaceMs
      if (!rec.valid) {
        stableStreak = 0
        timeLostMs += Math.max(0, gap - medianPaceMs)
        i++; continue
      }
      if (gap > medianPaceMs * THRESHOLD) { timeLostMs += gap - medianPaceMs; stableStreak = 0 }
      else stableStreak++
      i++
      if (stableStreak >= RECOVERY_STABLE) break
    }
  }

  const cleanTimeMs = Math.max(0, totalTimeMs - timeLostMs)

  const validPosts = posts.filter(p => p.isCount && p.isValidCount && !p.stricken)
  const lastVCN = validPosts[validPosts.length - 1]?.validCountNumber
  const firstVCN = validPosts[0]?.validCountNumber
  let replayType: 'get' | 'split' | 'range' = 'range'
  if (lastVCN != null && lastVCN % getSize === 0) replayType = 'get'
  else if (lastVCN != null && lastVCN % countsPerSplit === 0) replayType = 'split'
  else if (firstVCN != null && firstVCN % getSize === 0) replayType = 'get'
  else if (firstVCN != null && firstVCN % countsPerSplit === 0) replayType = 'split'

  const splitCount = Math.max(totalValidCounts / countsPerSplit, 1)
  const getCount = Math.max(totalValidCounts / getSize, 1)

  return {
    replayType, getSize, splitSize: countsPerSplit,
    medianPaceMs, totalTimeMs, cleanTimeMs, timeLostMs, totalMistakes,
    mistakesPerSplit: totalMistakes / splitCount,
    mistakesPerGet: totalMistakes / getCount,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const threadName = searchParams.get('thread') ?? ''
  const startNum = searchParams.get('start') ? parseInt(searchParams.get('start')!) : null
  const endNum = searchParams.get('end') ? parseInt(searchParams.get('end')!) : null

  if (!threadName || startNum == null) {
    return new Response('Missing params', { status: 400 })
  }

  const thread = await getThread(threadName)
  if (!thread) return new Response('Thread not found', { status: 404 })

  const startPost = await findStartPost(thread.uuid, startNum)
  if (!startPost) return new Response('Start post not found', { status: 404 })

  const { posts, counters, truncated } = await loadPosts(threadName, startPost.uuid, endNum)
  const counterMap = new Map(counters.map(c => [c.uuid, c]))

  const countsPerSplit = thread.countsPerSplit ?? 100
  const splitsPerGet = thread.splitsPerGet ?? 10
  const pace = computePace(posts, countsPerSplit, splitsPerGet, startPost.timestamp)

  const countsByCounter = new Map<string, number>()
  let firstRawCount = ''
  let lastRawCount = ''
  let firstTimestamp = ''
  let lastTimestamp = ''

  for (const p of posts) {
    if (!p.isCount || !p.isValidCount || p.stricken) continue
    countsByCounter.set(p.authorUUID, (countsByCounter.get(p.authorUUID) ?? 0) + 1)
    if (!firstRawCount && p.rawCount) { firstRawCount = String(p.rawCount); firstTimestamp = p.timestamp }
    if (p.rawCount) { lastRawCount = String(p.rawCount); lastTimestamp = p.timestamp }
  }

  const participants = Array.from(countsByCounter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([uuid, cnt]) => ({ counter: counterMap.get(uuid)!, counts: cnt }))
    .filter(p => p.counter)

  const totalCounts = Array.from(countsByCounter.values()).reduce((s, n) => s + n, 0)

  const firstMs = Number(firstTimestamp)
  const dateStr = Number.isFinite(firstMs) && firstMs > 0
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York',
      }).format(new Date(firstMs))
    : ''

  const lastMs = Number(lastTimestamp)
  const spanMs = Number.isFinite(firstMs) && Number.isFinite(lastMs) && lastMs > firstMs
    ? lastMs - firstMs
    : 0
  const elapsedMs = pace.totalTimeMs > 0 ? pace.totalTimeMs : spanMs
  const cleanMs = Math.max(0, elapsedMs - pace.timeLostMs)
  const maxCounts = participants[0]?.counts ?? 1

  const isGet = pace.replayType === 'get'
  const isSplit = pace.replayType === 'split'
  const mistakeLabel = String(pace.totalMistakes)
  const replayTypeLabel = isGet ? `GET · ${pace.getSize}` : isSplit ? `SPLIT · ${pace.splitSize}` : ''

  const statRows = [
    { label: 'COUNTS', value: totalCounts.toLocaleString() },
    { label: 'MISTAKES', value: mistakeLabel, accent: pace.totalMistakes > 0 ? '#f44336' : undefined },
  ]

  const elapsedLabel = elapsedMs > 0 ? formatDuration(elapsedMs) : '--'

  const topParticipants = participants.slice(0, 4)
  const extraCounters = Math.max(0, countsByCounter.size - topParticipants.length)

  return new ImageResponse(
    (
      <div style={{
        width: '1200px', height: '630px',
        background: 'linear-gradient(180deg, #141d38 0%, #232c52 32%, #3d4470 58%, #6b5570 76%, #3c5636 84%, #223727 100%)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'monospace',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', bottom: 40, right: 120,
          width: 620, height: 620, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(246,183,116,0.20) 0%, rgba(239,154,92,0.06) 45%, transparent 68%)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(100deg, rgba(6,8,16,0.88) 0%, rgba(6,8,16,0.72) 42%, rgba(6,8,16,0.34) 78%, rgba(6,8,16,0.22) 100%)',
          display: 'flex',
        }} />

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '30px 52px 0', position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_DATA_URI} width={150} height={84} />
            <div style={{ width: 2, height: 58, background: 'rgba(255,255,255,0.24)', display: 'flex' }} />
            <div style={{
              fontSize: 54, fontWeight: 900, color: '#fff',
              letterSpacing: '-0.02em',
              textShadow: '0 3px 16px rgba(0,0,0,0.55)',
            }}>
              {thread.title}
            </div>
          </div>
          {dateStr && (
            <div style={{ fontSize: 30, fontWeight: 800, color: 'rgba(255,255,255,0.92)', letterSpacing: '0.03em', textShadow: '0 3px 14px rgba(0,0,0,0.65)' }}>
              {dateStr}
            </div>
          )}
        </div>

        <div style={{
          display: 'flex', flex: 1,
          padding: '0 52px 34px', alignItems: 'center', position: 'relative',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'baseline',
              fontSize: truncated ? 150 : elapsedLabel.length > 8 ? 176 : 208,
              fontWeight: 900, color: '#fff',
              letterSpacing: '-0.05em', lineHeight: 0.9,
              textShadow: '0 6px 34px rgba(0,0,0,0.5)',
            }}>
              {truncated ? `${totalCounts.toLocaleString()} counts` : elapsedLabel}
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 18, marginTop: 14,
              fontSize: 58, fontWeight: 900, color: '#fff',
              letterSpacing: '-0.03em',
            }}>
              <span>{firstRawCount || String(startNum)}</span>
              <div style={{ width: 34, height: 4, background: 'rgba(249,115,22,0.85)', display: 'flex' }} />
              <span>{lastRawCount || (endNum ? String(endNum) : '?')}</span>
            </div>

            <div style={{
              display: 'flex', alignItems: 'stretch', gap: 34, marginTop: 34,
              alignSelf: 'flex-start',
              padding: '16px 26px', borderRadius: 16,
              background: 'rgba(8,10,18,0.82)',
              border: '2px solid rgba(255,255,255,0.14)',
            }}>
              {truncated ? (
                <div style={{
                  display: 'flex', alignItems: 'center',
                  fontSize: 28, fontWeight: 800, color: '#ffb27a', letterSpacing: '0.01em',
                }}>
                  Partial replay: too long to measure
                </div>
              ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.72)' }}>
                  PACE + LOST
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, fontSize: 46, fontWeight: 900 }}>
                  <span style={{ color: '#5ddc72' }}>
                    {cleanMs > 0 ? formatDuration(cleanMs) : '-'}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>+</span>
                  <span style={{ color: pace.timeLostMs > 0 ? '#ff5f52' : 'rgba(255,255,255,0.5)' }}>
                    {pace.timeLostMs > 0 ? formatDuration(pace.timeLostMs) : '0.000'}
                  </span>
                </div>
              </div>
              )}

              {!truncated && statRows.map(({ label, value, accent }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.72)' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 46, fontWeight: 900, color: accent || '#fff' }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 16,
            flexShrink: 0, marginLeft: 40,
          }}>
            {topParticipants.map((p) => {
              const color = p.counter.color || '#e6e9f0'
              const av = avatarUrl(p.counter)
              return (
                <div key={p.counter.uuid} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '8px 22px 8px 8px', borderRadius: 999,
                  background: 'rgba(8,10,18,0.82)',
                  border: '2px solid rgba(255,255,255,0.14)',
                  borderLeft: `6px solid ${color}`,
                }}>
                  {av ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={av} width={64} height={64} style={{ borderRadius: '50%', flexShrink: 0 }} />
                  ) : (
                    <div style={{
                      width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
                      background: color + '44',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 26, fontWeight: 900, color: '#fff',
                    }}>
                      {p.counter.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span style={{
                    fontSize: 38, fontWeight: 900, color: '#fff',
                    whiteSpace: 'nowrap', letterSpacing: '-0.01em',
                  }}>
                    {p.counter.name || p.counter.username}
                  </span>
                </div>
              )
            })}
            {extraCounters > 0 && (
              <span style={{ fontSize: 28, fontWeight: 800, color: 'rgba(255,255,255,0.5)', marginLeft: 84 }}>
                +{extraCounters} more
              </span>
            )}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}

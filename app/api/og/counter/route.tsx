import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import { CardHeader, Eyebrow, Headline, Scrim, StatPanel, SunGlow, avatarUrl, cardShellStyle } from '../shared'

export const runtime = 'edge'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

interface CounterProfile {
  uuid: string
  username: string
  name: string
  color: string
  discordId: string
  avatar: string
  title?: string
  xp?: number | string
}

interface AllStats {
  posts?: number
  counts?: number
  mistakes?: number
}

async function loadCounter(username: string): Promise<{ counter: CounterProfile; all: AllStats } | null> {
  try {
    const res = await fetch(`${API}/api/counter/load_counter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid: username }),
      next: { revalidate: 120 },
    })
    if (!res.ok) return null
    const data = await res.json()
    const counter: CounterProfile | undefined = data.loadedCounter
    if (!counter) return null
    return { counter, all: data.loadedCounterStats?.all ?? {} }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('user') ?? ''
  if (!username) return new Response('Missing user', { status: 400 })

  const loaded = await loadCounter(username)
  if (!loaded) return new Response('Counter not found', { status: 404 })

  const { counter, all } = loaded
  const counts = Number(all.counts) || 0
  const posts = Number(all.posts) || 0
  const mistakes = Number(all.mistakes) || 0

  const attempts = counts + mistakes
  const accuracy = attempts > 0 ? (counts / attempts) * 100 : null

  const xp = Number(counter.xp) || 0

  const items: { label: string; value: string; accent?: string }[] = []
  if (posts > 0) items.push({ label: 'POSTS', value: posts.toLocaleString() })
  if (accuracy != null) items.push({ label: 'ACCURACY', value: `${accuracy.toFixed(1)}%` })
  if (xp > 0) items.push({ label: 'XP', value: xp.toLocaleString() })

  const displayName = counter.name || counter.username
  const av = avatarUrl(counter)

  return new ImageResponse(
    (
      <div style={cardShellStyle()}>
        <SunGlow />
        <Scrim />

        <CardHeader subject={displayName} right={counter.title || undefined} />

        <div style={{
          display: 'flex', flex: 1,
          padding: '0 52px 34px', alignItems: 'center', position: 'relative',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <Eyebrow>TOTAL COUNTS</Eyebrow>

            <Headline>{counts.toLocaleString()}</Headline>

            <div style={{ display: 'flex', marginTop: 34 }}>
              <StatPanel items={items} />
            </div>
          </div>

          {av && (
            <div style={{ display: 'flex', flexShrink: 0, marginLeft: 44 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={av}
                width={260}
                height={260}
                style={{
                  borderRadius: '50%',
                  border: `10px solid ${counter.color || '#e6e9f0'}`,
                }}
              />
            </div>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}

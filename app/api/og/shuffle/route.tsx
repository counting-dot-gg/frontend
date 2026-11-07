import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import { CardHeader, Eyebrow, PersonChip, Scrim, SunGlow, avatarUrl, cardShellStyle, GOOD, ACCENT } from '../shared'

export const runtime = 'edge'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

interface ShuffleRecord {
  cheated?: boolean
  size?: number
  score?: number
  day?: string | null
  counter?: { username: string; name: string; color: string; discordId: string; avatar: string } | null
}

async function getGame(seed: string): Promise<ShuffleRecord | null> {
  try {
    const r = await fetch(`${API}/api/thread/shuffle/${encodeURIComponent(seed)}`, {
      next: { revalidate: 60 },
    })
    return r.ok ? r.json() : null
  } catch { return null }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const score = Math.max(0, Math.min(500, Number(sp.get('score')) || 0))
  const size = Math.max(1, Math.min(500, Number(sp.get('size')) || 1))
  const seed = (sp.get('seed') ?? '').slice(0, 64)

  const record = seed ? await getGame(seed) : null
  const player = record?.counter?.name || record?.counter?.username || null
  const daily = record?.day || null
  const cheated = !!record?.cheated

  const perfect = score >= size
  const pct = Math.round((score / size) * 100)
  const accent = perfect ? '#ffd700' : pct >= 66 ? GOOD : pct >= 33 ? ACCENT : '#ff5f52'

  const shown = Math.min(size, 20)
  const slots = Array.from({ length: shown }, (_, i) => i < Math.min(score, shown))
  const slotW = Math.max(18, Math.min(56, Math.floor(760 / shown) - 10))

  return new ImageResponse(
    (
      <div style={cardShellStyle()}>
        <SunGlow />
        <Scrim />

        <CardHeader subject="Number Shuffle" right={daily ? `Daily · ${daily}` : 'Freeplay'} />

        <div style={{
          display: 'flex', flex: 1,
          padding: '0 52px 34px', alignItems: 'center', position: 'relative',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <Eyebrow>SCORE</Eyebrow>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
              <div style={{
                display: 'flex', fontSize: 200, fontWeight: 900, color: accent,
                letterSpacing: '-0.05em', lineHeight: 0.9,
                textShadow: '0 6px 34px rgba(0,0,0,0.5)',
              }}>
                {score}
              </div>
              <div style={{
                display: 'flex', fontSize: 84, fontWeight: 900,
                color: 'rgba(255,255,255,0.55)', letterSpacing: '-0.03em',
              }}>
                / {size}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 26 }}>
              {slots.map((filled, i) => (
                <div key={i} style={{
                  width: slotW, height: 26, borderRadius: 6,
                  background: filled ? accent : 'rgba(255,255,255,0.10)',
                  border: filled ? 'none' : '2px solid rgba(255,255,255,0.16)',
                  display: 'flex',
                }} />
              ))}
              {size > shown && (
                <div style={{
                  display: 'flex', marginLeft: 10,
                  fontSize: 24, fontWeight: 800, color: 'rgba(255,255,255,0.5)',
                }}>
                  +{size - shown}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 32 }}>
              {player && (
                <PersonChip
                  name={player}
                  color={record?.counter?.color || accent}
                  avatar={avatarUrl(record?.counter ?? {})}
                />
              )}

              {cheated && (
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '12px 22px', borderRadius: 999,
                  background: 'rgba(220,38,38,0.22)', border: '3px solid #ff5f52',
                  fontSize: 34, fontWeight: 900, color: '#ff8a80', letterSpacing: '0.06em',
                }}>
                  CHEATED
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}

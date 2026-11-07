import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import { CardHeader, Eyebrow, Headline, Scrim, StatPanel, SunGlow, cardShellStyle } from '../shared'

export const runtime = 'edge'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

const TEAM_COLORS: Record<string, string> = {
  wave: '#1f8bff',
  blaze: '#f4511e',
  radiant: '#f6b71e',
}

interface Square {
  index: number
  isUnlocked: boolean
  mostRecentUnlockerTeamId?: number
}

interface Team { id: number; key?: string; name: string }

function teamColor(team?: Team | null): string | null {
  if (!team) return null
  const k = (team.key || team.name || '').toLowerCase().trim()
  return TEAM_COLORS[k] ?? null
}

interface Game {
  id: number
  status: string
  mode: string
  rank: string
  winnerTeamId: number | null
  winnerUsername: string | null
}

async function getFinished(gameId: number): Promise<{ game: Game; teams: Team[]; squares: Square[] } | null> {
  try {
    const r = await fetch(`${API}/api/bingo/completed?offset=0&limit=25`, { next: { revalidate: 60 } })
    if (!r.ok) return null
    const data = await r.json()
    const row = (data.games ?? []).find((g: { id: number }) => g.id === gameId)
    if (!row) return null
    return {
      game: {
        id: row.id, status: row.status, mode: row.mode ?? 'bingo', rank: row.rank ?? '',
        winnerTeamId: row.winnerTeamId ?? null, winnerUsername: row.winnerUsername ?? null,
      },
      teams: row.teams ?? [],
      squares: row.squares ?? [],
    }
  } catch { return null }
}

export async function GET(req: NextRequest) {
  const gameId = Number(req.nextUrl.searchParams.get('game'))
  if (!gameId) return new Response('Missing game', { status: 400 })

  const loaded = await getFinished(gameId)
  if (!loaded) return new Response('Game not found', { status: 404 })

  const { game, teams, squares } = loaded

  const colorFor = (teamId?: number | null) =>
    teamColor(teams.find(x => x.id === teamId)) ?? '#94a3b8'

  const scores = teams
    .map(t => ({
      team: t,
      color: teamColor(t) ?? '#94a3b8',
      score: squares.filter(s => s.isUnlocked && s.mostRecentUnlockerTeamId === t.id).length,
    }))
    .sort((a, b) => b.score - a.score)

  const winner = scores.find(s => s.team.id === game.winnerTeamId) ?? null
  const byIndex = new Map(squares.map(s => [s.index, s]))

  return new ImageResponse(
    (
      <div style={cardShellStyle()}>
        <SunGlow />
        <Scrim />

        <CardHeader subject={`Bingo #${game.id}`} right={game.rank ? game.rank.toUpperCase() : undefined} />

        <div style={{
          display: 'flex', flex: 1,
          padding: '0 52px 34px', alignItems: 'center', position: 'relative',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <Eyebrow>{winner ? 'WINNER' : 'RESULT'}</Eyebrow>

            <div style={{ display: 'flex', color: winner?.color ?? '#fff' }}>
              <Headline max={176}>{winner ? winner.team.name : 'No winner'}</Headline>
            </div>

            {game.winnerUsername && (
              <div style={{
                display: 'flex', marginTop: 12,
                fontSize: 34, fontWeight: 800, color: 'rgba(255,255,255,0.7)',
              }}>
                line by {game.winnerUsername}
              </div>
            )}

            <div style={{ display: 'flex', marginTop: 30 }}>
              <StatPanel
                items={scores.map(s => ({
                  label: s.team.name.toUpperCase(),
                  value: String(s.score),
                  accent: s.color,
                }))}
              />
            </div>
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 6,
            flexShrink: 0, marginLeft: 44,
            padding: 14, borderRadius: 18,
            background: 'rgba(8,10,18,0.82)', border: '2px solid rgba(255,255,255,0.14)',
          }}>
            {[0, 1, 2, 3, 4].map(row => (
              <div key={row} style={{ display: 'flex', gap: 6 }}>
                {[0, 1, 2, 3, 4].map(col => {
                  const sq = byIndex.get(row * 5 + col)
                  const fill = sq?.isUnlocked ? colorFor(sq.mostRecentUnlockerTeamId) : null
                  return (
                    <div key={col} style={{
                      width: 62, height: 62, borderRadius: 9,
                      background: fill ?? 'rgba(255,255,255,0.07)',
                      border: fill ? 'none' : '2px solid rgba(255,255,255,0.14)',
                      display: 'flex',
                    }} />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}

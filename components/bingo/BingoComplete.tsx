'use client'

import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { avatarUrl } from '@/lib/counterUtils'
import { teamColorById, teamScores } from '@/lib/bingo'
import type { BingoGameState } from '@/lib/bingo'

interface Props {
  state: BingoGameState
  meUuid: string | null
  onDismiss: () => void
  board?: React.ReactNode
  openHref?: string
}

export default function BingoComplete({ state, onDismiss, board, openHref }: Props) {
  const { game, members, teams, squares } = state
  const winner = teamColorById(teams, game.winnerTeamId)
  const scores = teamScores(squares, teams, { ranked: true }).filter(({ team }) => members.some(m => m.teamId === team.id))

  return (
    <div role="status" aria-label="Game complete" style={{ marginBottom: 12 }}>
      <style>{`
        @keyframes bingo-win-pop {
          0%   { transform: scale(0.96) translateY(8px); opacity: 0; }
          100% { transform: scale(1) translateY(0);      opacity: 1; }
        }
        .bingo-win-card { animation: bingo-win-pop 0.35s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .bingo-win-card { animation: none; }
        }
      `}</style>

      <div
        className="bingo-win-card"
        style={{
          width: '100%', borderRadius: 14, padding: '16px 14px 14px',
          background: 'var(--card)', color: 'var(--card-foreground)',
          border: `1px solid ${winner?.fill ?? 'var(--border)'}`,
          boxShadow: `0 0 0 3px ${winner ? `${winner.fill}22` : 'transparent'}`,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', opacity: 0.5 }}>
          #{game.id}
        </div>
        <div style={{
          fontSize: 30, fontWeight: 900, lineHeight: 1.1, margin: '4px 0 0',
          letterSpacing: '0.01em', textTransform: 'uppercase',
          color: winner?.fill ?? 'var(--muted-foreground)',
        }}>
          {winner ? `${winner.label} wins` : 'No winner'}
        </div>

        {board && <div style={{ margin: '16px 0 0', padding: '0 8px' }}>{board}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
          {scores.map(({ team, score, color }) => {
            const roster = members.filter(m => m.teamId === team.id)
            return (
              <div
                key={team.id}
                style={{
                  padding: '8px 10px', borderRadius: 9, textAlign: 'left',
                  background: color.soft,
                  border: `1px solid ${team.id === game.winnerTeamId ? color.fill : 'transparent'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: color.fill, flexShrink: 0 }} />
                  <span style={{ fontWeight: 800, fontSize: 13, flex: 1 }}>{team.name}</span>
                  <span style={{ fontWeight: 900, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 7 }}>
                  {roster.map(m => (
                    <span
                      key={m.counter.uuid}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0,
                        opacity: m.status === 'active' ? 1 : 0.5,
                      }}
                    >
                      <Avatar style={{ width: 20, height: 20, boxShadow: `0 0 0 2px ${color.fill}` }}>
                        <AvatarImage src={avatarUrl(m.counter)} alt="" />
                        <AvatarFallback style={{ background: color.fill, color: color.ink, fontSize: 9 }}>
                          {(m.counter.emoji ?? m.counter.username?.[0] ?? '?').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                        {m.counter.name || m.counter.username}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          {openHref && (
            <Link prefetch={false} href={openHref} style={{
              flex: 1, padding: '9px 0', borderRadius: 9, fontSize: 13, fontWeight: 800, textDecoration: 'none',
              border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)',
            }}>
              Open game
            </Link>
          )}
          <button type="button" onClick={onDismiss} style={{
            flex: 1, padding: '9px 0', borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: 'pointer', border: 'none',
            background: 'var(--primary)', color: 'var(--primary-foreground)',
          }}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

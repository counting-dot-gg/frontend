'use client'

import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { avatarUrl } from '@/lib/counterUtils'
import { formatClock, secondsLeft, teamColor, teamScores } from '@/lib/bingo'
import BingoSettings from './BingoSettings'
import ForfeitButton from './ForfeitButton'
import { GameClock } from './GameBits'
import BingoAdminPanel, { type AdminBrush } from './BingoAdminPanel'
import type { BingoGameState, BingoMember } from '@/lib/bingo'

interface Props {
  state: BingoGameState
  meUuid: string | null
  isAdmin: boolean
  brush: AdminBrush
  onBrushChange: (brush: AdminBrush) => void
  pending: boolean
  send: (event: string, data?: Record<string, unknown>) => void
  onLeaveView: () => void
}

export default function BingoRail({ state, meUuid, isAdmin, brush, onBrushChange, pending, send, onLeaveView }: Props) {
  const { game, members, teams, squares } = state
  const isHost = !!meUuid && game.hostUserUuid === meUuid
  const me = members.find(m => m.counter.uuid === meUuid) ?? null
  const inGame = !!me && me.status === 'active'

  const scores = teamScores(squares, teams)
  const gameId = game.id

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <Header game={state} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {game.status === 'lobby' && (
          <StatusChip
            label={game.joinMode === 'closed' ? 'Closed' : game.joinMode === 'code' ? 'Code only' : 'Open'}
            tone={game.joinMode === 'closed' ? 'off' : 'on'}
            onClick={isHost
              ? () => send('bingo_update_settings', {
                  gameId, joinMode: game.joinMode === 'closed' ? 'free' : 'closed',
                })
              : undefined}
          />
        )}
        <StatusChip label={game.mode === 'lockout' ? 'Lockout' : 'Classic'} tone="neutral" />
        <StatusChip label={game.rank} tone="neutral" />
      </div>

      {isAdmin && game.status !== 'lobby' && (
        <BingoAdminPanel
          state={state}
          brush={brush}
          onBrushChange={onBrushChange}
          pending={pending}
          send={send}
        />
      )}

      <BingoSettings state={state} isHost={isHost} pending={pending} send={send} />

      <Teams
        teams={teams}
        members={members}
        scores={game.status === 'lobby' ? null : new Map(scores.map(({ team, score }) => [team.id, score]))}
        meUuid={meUuid}
        isHost={isHost}
        canSwap={state.teamSwapMode === 'open' || isHost}
        status={game.status}
        pending={pending}
        onMove={(targetUserUuid, targetTeamId) =>
          send('bingo_move_member', { gameId, targetUserUuid, targetTeamId })}
        onKick={targetUserUuid => send('bingo_kick', { gameId, targetUserUuid })}
        onToggleLock={teamId => {
          const team = teams.find(t => t.id === teamId)
          send('bingo_update_team_lock', { gameId, teamId, locked: !team?.locked })
        }}
      />

      <Actions
        state={state}
        isHost={isHost}
        inGame={inGame}
        pending={pending}
        send={send}
        onLeaveView={onLeaveView}
      />
    </aside>
  )
}

function StatusChip({ label, tone, mono, onClick }: {
  label: string
  tone: 'on' | 'off' | 'neutral'
  mono?: boolean
  onClick?: () => void
}) {
  const palette = tone === 'on'
    ? { bg: 'rgba(34,197,94,0.14)', border: 'rgba(34,197,94,0.45)', ink: 'var(--success)' }
    : tone === 'off'
      ? { bg: 'rgba(220,38,38,0.12)', border: 'rgba(220,38,38,0.4)', ink: 'var(--danger)' }
      : { bg: 'var(--muted)', border: 'transparent', ink: 'var(--muted-foreground)' }

  const Tag: any = onClick ? 'button' : 'span'
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick, title: 'Click to change' } : {})}
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '3px 8px', borderRadius: 999,
        fontSize: 10.5, fontWeight: 800, letterSpacing: '0.03em',
        textTransform: mono ? 'none' : 'capitalize',
        fontFamily: mono ? 'var(--font-mono, monospace)' : undefined,
        background: palette.bg, border: '1px solid ' + palette.border, color: palette.ink,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {label}
    </Tag>
  )
}

function Header({ game: state }: { game: BingoGameState }) {
  const { game } = state
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (game.status !== 'running') return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [game.status])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Game #{game.id}</h2>
        <span style={{
          fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
          fontWeight: 800, padding: '2px 6px', borderRadius: 4,
          background: game.status === 'running' ? '#16a34a' : game.status === 'lobby' ? 'var(--muted)' : '#71717a',
          color: game.status === 'lobby' ? 'var(--muted-foreground)' : '#fff',
        }}>
          {game.status}
        </span>
      </div>

      {game.status === 'running' && (
        <div style={{ marginTop: 4 }}>
          <GameClock game={game} now={now} size={26} />
        </div>
      )}

      {game.status === 'finished' && (
        <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700 }}>
          {game.winnerTeamId
            ? `${teams(state, game.winnerTeamId)} wins`
            : 'Ended with no winner'}
        </div>
      )}
    </div>
  )
}

function teams(state: BingoGameState, teamId: number) {
  return state.teams.find(t => t.id === teamId)?.name ?? 'A team'
}

export function Teams({ teams, members, scores, meUuid, isHost, canSwap, status, pending, onMove, onKick, onToggleLock }: {
  teams: BingoGameState['teams']
  members: BingoMember[]
  scores: Map<number, number> | null
  meUuid: string | null
  isHost: boolean
  canSwap: boolean
  status: string
  pending: boolean
  onMove: (userUuid: string, teamId: number) => void
  onKick: (userUuid: string) => void
  onToggleLock: (teamId: number) => void
}) {
  const canRearrange = status === 'lobby'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {teams.map(team => {
        const color = teamColor(team.key)
        const roster = members.filter(m => m.teamId === team.id && m.status === 'active')
        if (!canRearrange && roster.length === 0) return null
        const meElsewhere = canRearrange && canSwap && !!meUuid
          && !roster.some(m => m.counter.uuid === meUuid)

        return (
          <div key={team.id} style={{
            borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', background: color.soft,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: color.fill }} />
              <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{team.name}</span>
              {scores
                ? <span style={{ fontWeight: 800, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{scores.get(team.id) ?? 0}</span>
                : <span style={{ fontSize: 11, opacity: 0.6 }}>{roster.length}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {roster.map(m => (
                <div key={m.counter.uuid} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                }}>
                  <Avatar size="sm">
                    <AvatarImage src={avatarUrl(m.counter)} alt={m.counter.username} />
                    <AvatarFallback>{(m.counter.emoji ?? m.counter.username?.[0] ?? '?').toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span style={{
                    fontSize: 13, flex: 1, minWidth: 0, fontWeight: 600,
                    color: m.counter.color || 'var(--foreground)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {m.counter.username}
                  </span>
                  {m.role === 'host' && (
                    <span style={{ fontSize: 10, opacity: 0.55, fontWeight: 700 }}>HOST</span>
                  )}
                  {isHost && canRearrange && m.counter.uuid !== meUuid && (
                    <button
                      type="button"
                      onClick={() => onKick(m.counter.uuid)}
                      disabled={pending}
                      title="Remove from game"
                      style={{
                        border: 'none', background: 'none', cursor: 'pointer',
                        color: 'var(--muted-foreground)', fontSize: 15, lineHeight: 1, padding: 2,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              {roster.length === 0 && (
                <div style={{ padding: '8px 10px', fontSize: 12, opacity: 0.5 }}>Empty</div>
              )}

              {isHost && canRearrange && (
                <button
                  type="button"
                  onClick={() => onToggleLock(team.id)}
                  disabled={pending}
                  aria-pressed={team.locked}
                  style={{
                    margin: '0 8px 8px', padding: '6px 0', borderRadius: 6,
                    width: 'calc(100% - 16px)',
                    border: '1px solid ' + (team.locked ? 'var(--danger)' : 'var(--border)'),
                    background: 'transparent',
                    color: team.locked ? 'var(--danger)' : 'var(--muted-foreground)',
                    fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}
                >
                  {team.locked ? 'Unlock ' + team.name : 'Lock ' + team.name}
                </button>
              )}

              {meElsewhere && team.locked && !isHost && (
                <div style={{
                  margin: '0 8px 8px', padding: '5px 0', fontSize: 11,
                  textAlign: 'center', opacity: 0.5,
                }}>
                  Locked
                </div>
              )}

              {meElsewhere && !team.locked && (
                <button
                  type="button"
                  onClick={() => onMove(meUuid!, team.id)}
                  disabled={pending}
                  style={{
                    margin: '0 8px 8px', padding: '6px 0', borderRadius: 6,
                    border: `1px solid ${color.fill}`, background: 'transparent',
                    color: color.fill, fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Join {team.name}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Actions({ state, isHost, inGame, pending, send, onLeaveView }: {
  state: BingoGameState
  isHost: boolean
  inGame: boolean
  pending: boolean
  send: (event: string, data?: Record<string, unknown>) => void
  onLeaveView: () => void
}) {
  const { game } = state
  const gameId = game.id

  const primary = (label: string, event: string, tone: 'go' | 'warn' = 'go', disabled = false) => (
    <button
      type="button"
      onClick={() => send(event, { gameId })}
      disabled={pending || disabled}
      style={{
        width: '100%', padding: '11px 0', borderRadius: 9, border: 'none',
        background: disabled ? 'var(--muted)' : tone === 'go' ? 'var(--primary)' : '#dc2626',
        color: disabled ? 'var(--muted-foreground)' : '#fff',
        fontWeight: 800, fontSize: 14,
        cursor: disabled || pending ? 'default' : 'pointer',
        opacity: pending ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  )

  const secondary = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      style={{
        width: '100%', padding: '8px 0', borderRadius: 8,
        border: '1px solid var(--border)', background: 'transparent',
        color: 'var(--muted-foreground)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
      {game.status === 'lobby' && isHost && primary('Start game', 'bingo_start')}

      {game.status === 'lobby' && !isHost && inGame && (
        <div style={{ fontSize: 13, opacity: 0.7, textAlign: 'center', padding: '8px 0' }}>
          Waiting for the host to start.
        </div>
      )}

      {game.status === 'lobby' && isHost && secondary('Cancel game', () => send('bingo_cancel', { gameId }))}
      {game.status === 'lobby' && !isHost && inGame && secondary('Leave', () => send('bingo_leave', { gameId }))}

      {game.status === 'running' && inGame &&
        <ForfeitButton gameId={gameId} pending={pending} send={send} />}

      {game.status === 'finished' && inGame &&
        secondary('Leave game', () => send('bingo_leave_game', { gameId }))}

      {secondary('Back to games', onLeaveView)}
    </div>
  )
}

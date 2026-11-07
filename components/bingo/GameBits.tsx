'use client'

import { ChevronRight, Lock, LockOpen } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { avatarUrl } from '@/lib/counterUtils'
import { RANK_COLORS, RANK_LABELS, type RankName } from '@/lib/rankUtils'
import { formatClock, secondsLeft, teamColor } from '@/lib/bingo'
import type { BingoGameInfo, BingoGameState, BingoLobbyGame, BingoMember, BingoTeam } from '@/lib/bingo'

export function GameRank({ rank }: { rank: string }) {
  const r = (rank || '').toLowerCase() as RankName
  if (!RANK_LABELS[r]) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: RANK_COLORS[r], flexShrink: 0 }} />
      {RANK_LABELS[r]}
    </span>
  )
}

export function TeamFaces({ members, teams, max = 3 }: {
  members: BingoMember[]
  teams: BingoTeam[]
  max?: number
}) {
  const groups = teams
    .map(team => ({ team, roster: members.filter(m => m.teamId === team.id && m.status === 'active') }))
    .filter(g => g.roster.length > 0)
  if (groups.length === 0) return null

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {groups.map(({ team, roster }) => {
        const color = teamColor(team.key)
        return (
          <span key={team.id} title={`${team.name}: ${roster.map(m => m.counter.username).join(', ')}`}
            style={{ display: 'inline-flex', alignItems: 'center' }}>
            {roster.slice(0, max).map((m, i) => (
              <Avatar key={m.counter.uuid} style={{
                width: 20, height: 20, marginLeft: i === 0 ? 0 : -6,
                boxShadow: `0 0 0 2px ${color.fill}`,
              }}>
                <AvatarImage src={avatarUrl(m.counter)} alt={m.counter.username} />
                <AvatarFallback style={{ background: color.fill, color: color.ink, fontSize: 9 }}>
                  {(m.counter.emoji ?? m.counter.username?.[0] ?? '?').toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {roster.length > max && (
              <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 3, color: color.fill }}>+{roster.length - max}</span>
            )}
          </span>
        )
      })}
    </span>
  )
}

export function boardState(game: BingoLobbyGame): BingoGameState {
  return {
    game: {
      id: game.id, status: game.status, mode: game.mode,
      winnerTeamId: game.winnerTeamId ?? null, winningLines: game.winningLines ?? [],
    } as BingoGameInfo,
    members: game.members,
    teams: game.teams,
    squares: game.squares,
    teamSwapMode: 'locked',
  }
}

export function TeamPicker({ members, teams, myTeamId, onPick, onToggleLock, disabled }: {
  members: BingoMember[]
  teams: BingoTeam[]
  myTeamId: number | null
  onPick: (teamId: number) => void
  onToggleLock?: (teamId: number) => void
  disabled?: boolean
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {teams.map(team => {
        const color = teamColor(team.key)
        const roster = members.filter(m => m.teamId === team.id && m.status === 'active')
        const mine = team.id === myTeamId
        const blocked = disabled || mine || team.locked
        const badge = team.locked || !!onToggleLock
        const LockIcon = team.locked ? Lock : LockOpen
        return (
          <span key={team.id} style={{ position: 'relative', display: 'inline-flex' }}>
            <button
              type="button"
              disabled={blocked}
              onClick={() => onPick(team.id)}
              title={team.locked ? `${team.name} (locked)` : mine ? team.name : `Join ${team.name}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: roster.length && !blocked ? '3px 8px 3px 3px' : 3,
                borderRadius: 999, minWidth: 28, minHeight: 28, justifyContent: 'center',
                border: mine ? `2px solid ${color.fill}` : blocked ? '2px solid transparent' : `2px dashed ${color.fill}`,
                background: mine ? color.soft : 'transparent',
                filter: team.locked ? 'grayscale(1)' : undefined,
                opacity: team.locked ? 0.45 : 1,
                cursor: blocked ? 'default' : 'pointer',
                transition: 'filter 0.15s, opacity 0.15s',
              }}
            >
              {roster.length > 0 && <TeamFaces members={roster} teams={[team]} max={4} />}
              {(!blocked || !roster.length) && (
                <span style={{ color: color.fill, fontWeight: 900, fontSize: 14, lineHeight: 1 }}>+</span>
              )}
            </button>
            {badge && (() => {
              const look: React.CSSProperties = {
                position: 'absolute', top: -5, right: -6,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 18, height: 18, padding: 0, borderRadius: 999,
                border: '1px solid var(--border)',
                background: team.locked ? 'var(--foreground)' : 'var(--card)',
                color: team.locked ? 'var(--background)' : 'var(--muted-foreground)',
                boxShadow: '0 1px 2px rgb(0 0 0 / 0.18)',
              }
              const icon = <LockIcon size={10} strokeWidth={2.6} />
              return onToggleLock ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onToggleLock(team.id)}
                  aria-pressed={team.locked}
                  aria-label={team.locked ? `Unlock ${team.name}` : `Lock ${team.name}`}
                  title={team.locked ? `Unlock ${team.name}` : `Lock ${team.name}`}
                  style={{ ...look, cursor: disabled ? 'default' : 'pointer' }}
                >
                  {icon}
                </button>
              ) : (
                <span aria-label={`${team.name} locked`} style={look}>{icon}</span>
              )
            })()}
          </span>
        )
      })}
    </span>
  )
}

export function GameClock({ game, now, size = 12 }: {
  game: BingoGameInfo
  now: number
  size?: number
}) {
  if (game.status !== 'running') return null
  const left = secondsLeft(game, now)
  const graceEnds = game.minTimeSeconds ? Number(game.startedAt) + game.minTimeSeconds * 1000 : 0
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: size, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
      {left != null && (
        <span style={{ color: left < 60 ? 'var(--danger)' : 'inherit', opacity: left < 60 ? 1 : 0.65 }}>
          {formatClock(left)}
        </span>
      )}
      {graceEnds > now && (
        <span title="Grace period: no bingo counts until it ends" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, color: 'var(--muted-foreground)' }}>
          <span style={{ fontSize: Math.max(9, Math.round(size * 0.5)), fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Grace</span>
          {formatClock(Math.max(0, Math.round((graceEnds - now) / 1000)))}
        </span>
      )}
    </span>
  )
}

export function Chevron({ open, size = 14 }: { open: boolean; size?: number }) {
  return (
    <ChevronRight
      size={size} strokeWidth={2.4} aria-hidden
      style={{ flexShrink: 0, opacity: 0.6, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
    />
  )
}

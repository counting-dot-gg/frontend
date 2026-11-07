'use client'

import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { avatarUrl } from '@/lib/counterUtils'
import { formatClock, teamColor } from '@/lib/bingo'
import { sortLobby } from './useBingo'
import BingoBoard from './BingoBoard'
import BingoWindowAdmin from './BingoWindowAdmin'
import { boardState, GameRank, TeamFaces } from './GameBits'
import type { BingoLobbyData, BingoLobbyGame } from '@/lib/bingo'

interface Props {
  lobby: BingoLobbyData | null
  pending: boolean
  onCreate: () => void
  onJoin: (game: BingoLobbyGame) => void
  onOpen: (gameId: number) => void
  isAdmin?: boolean
  activeGameId?: number | null
}

function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const d = Math.floor(s / 86400)
  const hms = [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':')
  return d > 0 ? `${d}d ${hms}` : hms
}

export default function BingoLobby({ lobby, pending, onCreate, onJoin, onOpen, isAdmin = false, activeGameId = null }: Props) {
  const games = sortLobby(lobby?.activeGames ?? [])
  const win = lobby?.window
  const closed = win != null && !win.open
  const [now, setNow] = useState(() => Date.now())
  const anyRunning = games.some(g => g.status === 'running')
  const ticking = anyRunning || win?.next != null
  useEffect(() => {
    if (!ticking) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [ticking])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {closed && (
        <div style={{
          padding: '18px 0', borderRadius: 12, textAlign: 'center',
          border: '1px solid var(--border)', background: 'var(--card)',
        }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 800, opacity: 0.6 }}>
            {win.next != null ? 'Opens in' : 'Closed'}
          </div>
          {win.next != null && (
            <div style={{ fontSize: 32, fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
              {countdown(win.next - now)}
            </div>
          )}
        </div>
      )}
      {(!closed || isAdmin) && <div>
      <button
        type="button"
        onClick={onCreate}
        disabled={pending}
        style={{
          width: '100%', padding: '16px 0', borderRadius: 12, border: 'none',
          background: 'var(--primary)', color: 'var(--primary-foreground)',
          fontSize: 17, fontWeight: 800, cursor: pending ? 'default' : 'pointer',
          opacity: pending ? 0.6 : 1,
        }}
      >
        + New game
      </button>
      {!closed && win?.next != null && (
        <div style={{ marginTop: 6, textAlign: 'right', fontSize: 12, opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>
          Closes in {countdown(win.next - now)}
        </div>
      )}
      </div>}

      {games.length > 0 && <section>
        <h2 style={{
          fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.09em',
          opacity: 0.6, margin: '0 0 8px', fontWeight: 800,
        }}>
          Open games
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {games.map(game => (
              <GameRow
                key={game.id}
                game={game}
                now={now}
                pending={pending}
                joinable={game.id !== activeGameId}
                onJoin={() => onJoin(game)}
                onOpen={() => onOpen(game.id)}
              />
            ))}
        </div>
      </section>}

      {isAdmin && <BingoWindowAdmin live={win} />}
    </div>
  )
}

function clockLabel(game: BingoLobbyGame, now: number): string | null {
  if (game.status !== 'running') return null
  if (!game.endsAt) return null
  return formatClock(Math.max(0, Math.round((game.endsAt - now) / 1000)))
}

function GameRow({ game, now, pending, joinable, onJoin, onOpen }: {
  game: BingoLobbyGame
  now: number
  pending: boolean
  joinable: boolean
  onJoin: () => void
  onOpen: () => void
}) {
  const running = game.status === 'running'
  const canJoin = !running && game.allowJoin && joinable
  const dealt = game.squares.length > 0
  const clock = clockLabel(game, now)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px', borderRadius: 10,
      border: '1px solid var(--border)', background: 'var(--card)',
    }}>
      {dealt && (
        <div style={{ width: 72, flexShrink: 0 }}>
          <BingoBoard state={boardState(game)} density="mini" onSquareClick={() => onOpen()} />
        </div>
      )}
      <div
        role="link"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={e => { if (e.key === 'Enter') onOpen() }}
        style={{ minWidth: 0, flex: 1, cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>#{game.id}</span>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.07em',
            textTransform: 'uppercase', padding: '2px 5px', borderRadius: 3,
            background: running ? '#16a34a' : 'var(--muted)',
            color: running ? '#fff' : 'var(--muted-foreground)',
          }}>
            {running ? 'Live' : 'Lobby'}
          </span>
          {clock && (
            <span style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums', opacity: 0.8, whiteSpace: 'nowrap' }}>
              {clock}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
          <GameRank rank={game.rank} />
          <TeamFaces members={game.members} teams={game.teams} />
        </div>
        <div style={{
          fontSize: 11, opacity: 0.55, marginTop: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          Hosted by {game.host}
        </div>
      </div>

      <button
        type="button"
        onClick={canJoin ? onJoin : onOpen}
        disabled={pending}
        style={{
          padding: '7px 14px', borderRadius: 7, flexShrink: 0,
          border: canJoin ? 'none' : '1px solid var(--border)',
          background: canJoin ? 'var(--primary)' : 'transparent',
          color: canJoin ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
          fontWeight: 700, fontSize: 13, cursor: pending ? 'default' : 'pointer',
        }}
      >
        {canJoin ? 'Join' : running ? 'Watch' : 'View'}
      </button>
    </div>
  )
}

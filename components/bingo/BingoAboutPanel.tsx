'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import BingoBoard from './BingoBoard'
import { boardState, Chevron, GameClock, GameRank, TeamFaces, TeamPicker } from './GameBits'
import { Teams } from './BingoRail'
import BingoComplete from './BingoComplete'
import BingoSettings from './BingoSettings'
import ForfeitButton from './ForfeitButton'
import ThreadSquare, { sitewideFeeds } from './ThreadSquare'
import { useBingo } from './useBingo'
import { useFeatureFlag } from '@/lib/featureFlags'
import { formatClock, secondsLeft, teamScores } from '@/lib/bingo'

export default function BingoAboutPanel({ isLoggedIn, meUuid = null, threadUuid = null }: {
  isLoggedIn: boolean
  meUuid?: string | null
  threadUuid?: string | null
}) {
  const bingoEnabled = useFeatureFlag('bingo')
  const { game: followed, lobby, lastUnlock, dismissFinished, send, pending, error, clearError } = useBingo(isLoggedIn && bingoEnabled)
  const game = followed && !(followed.game.status === 'finished' && followed.squares.length === 0) ? followed : null
  const [now, setNow] = useState(() => Date.now())
  const [wantTeam, setWantTeam] = useState<{ gameId: number; teamId: number } | null>(null)
  useEffect(() => {
    if (!wantTeam || !meUuid) return
    const members = game?.game.id === wantTeam.gameId
      ? game.members
      : lobby?.activeGames.find(g => g.id === wantTeam.gameId)?.members
    const me = members?.find(m => m.counter.uuid === meUuid && m.status === 'active')
    if (!me) return
    if (me.teamId !== wantTeam.teamId) {
      send('bingo_move_member', { gameId: wantTeam.gameId, targetUserUuid: meUuid, targetTeamId: wantTeam.teamId })
    }
    setWantTeam(null)
  }, [wantTeam, game, lobby, meUuid, send])
  const errorLine = error ? (
    <button type="button" onClick={clearError} style={{
      display: 'block', width: '100%', textAlign: 'left', margin: '0 0 6px', padding: 0,
      border: 'none', background: 'none', color: 'var(--danger)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
    }}>{error}</button>
  ) : null
  const pickTeam = (gameId: number, teamId: number, joined: boolean) => {
    if (!meUuid) return
    if (joined) {
      send('bingo_move_member', { gameId, targetUserUuid: meUuid, targetTeamId: teamId })
    } else {
      setWantTeam({ gameId, teamId })
      send('bingo_join', { gameId })
    }
  }
  useEffect(() => {
    if (game?.game.status !== 'running') return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [game?.game.status])

  if (!bingoEnabled) return null

  if (!game) {
    const mine = (g: { members?: { counter?: { uuid?: string } }[] }) =>
      !!meUuid && (g.members ?? []).some(m => m.counter?.uuid === meUuid)

    const visible = (lobby?.activeGames ?? []).filter(g =>
      g.status === 'running' ||
      (g.status === 'lobby' && ((g.joinMode === 'free' && g.allowJoin) || mine(g))),
    )
    const canCreate = !!meUuid && lobby != null && lobby.window?.open !== false
    if (visible.length === 0 && !canCreate) return null

    return (
      <section style={{ marginBottom: 18 }}>
        {errorLine}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <h3 style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0, opacity: 0.7 }}>
            Bingo
          </h3>
          <Link prefetch={false} href="/bingo" style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, opacity: 0.7 }}>
            All games →
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visible.map(g => {
            const joined = mine(g)
            const running = g.status === 'running'
            const dealt = running && g.squares.length > 0
            return (
              <div
                key={g.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '7px 9px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--muted)',
                }}
              >
                {dealt && (
                  <Link prefetch={false} href={`/bingo/${g.id}`} style={{ width: 52, flexShrink: 0 }} aria-label={`Open game #${g.id}`}>
                    <BingoBoard state={boardState(g)} density="mini" onSquareClick={() => undefined} />
                  </Link>
                )}

                <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase',
                      padding: '2px 6px', borderRadius: 4, flexShrink: 0,
                      background: running ? '#16a34a' : 'var(--background)',
                      color: running ? '#fff' : 'var(--muted-foreground)',
                    }}>
                      {running ? 'Live' : 'Lobby'}
                    </span>
                    <GameRank rank={g.rank} />
                  </div>
                  {g.status === 'lobby' && meUuid && (g.teamSwapMode === 'open'
                    || (g.members ?? []).some(m => m.counter.uuid === meUuid && m.role === 'host')) ? (
                    <TeamPicker
                      members={g.members ?? []}
                      teams={g.teams ?? []}
                      myTeamId={(g.members ?? []).find(m => m.counter.uuid === meUuid && m.status === 'active')?.teamId ?? null}
                      onPick={teamId => pickTeam(g.id, teamId, joined)}
                      disabled={pending}
                    />
                  ) : (
                    <TeamFaces members={g.members ?? []} teams={g.teams ?? []} />
                  )}
                </div>

                {joined || running ? (
                  <Link prefetch={false}
                    href={`/bingo/${g.id}`}
                    style={{
                      marginLeft: 'auto', flexShrink: 0, padding: '3px 10px', borderRadius: 6,
                      fontSize: 11, fontWeight: 700, textDecoration: 'none',
                      border: '1px solid var(--border)', background: 'var(--background)', color: 'inherit',
                    }}
                  >
                    {joined ? 'Open' : 'Watch'}
                  </Link>
                ) : (
                  <span style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', gap: 5 }}>
                  <Link prefetch={false}
                    href={`/bingo/${g.id}`}
                    style={{
                      padding: '3px 10px', borderRadius: 6,
                      fontSize: 11, fontWeight: 700, textDecoration: 'none',
                      border: '1px solid var(--border)', background: 'transparent', color: 'inherit',
                    }}
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => send('bingo_join', { gameId: g.id })}
                    style={{
                      padding: '3px 10px', borderRadius: 6,
                      fontSize: 11, fontWeight: 700,
                      border: '1px solid var(--border)',
                      background: 'var(--background)', color: 'inherit',
                      cursor: pending ? 'default' : 'pointer',
                      opacity: pending ? 0.6 : 1,
                    }}
                  >
                    Join
                  </button>
                  </span>
                )}
              </div>
            )
          })}
          {canCreate && (
            <button
              type="button"
              disabled={pending}
              onClick={() => send('bingo_create', { allowJoin: true })}
              style={{
                padding: '7px 0', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 800,
                background: 'var(--primary)', color: 'var(--primary-foreground)',
                cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.6 : 1,
              }}
            >
              + New game
            </button>
          )}
        </div>
      </section>
    )
  }

  if (game.game.status === 'finished') {
    return (
      <section style={{ marginBottom: 18 }}>
        {errorLine}
        <BingoComplete
          state={game}
          meUuid={meUuid}
          onDismiss={dismissFinished}
          openHref={`/bingo/${game.game.id}`}
          board={<BingoBoard state={game} density="compact" meUuid={meUuid} />}
        />
      </section>
    )
  }

  const left = secondsLeft(game.game, now)
  const scores = teamScores(game.squares, game.teams)
  const here = threadUuid ? game.squares.filter(s => s.threadUuid === threadUuid) : []
  const feeds = sitewideFeeds(game)


  return (
    <section style={{ marginBottom: 18 }}>
      {errorLine}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <h3 style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0, opacity: 0.7 }}>
          Bingo
        </h3>
        <GameClock game={game.game} now={now} />
        <Link prefetch={false}
          href={`/bingo/${game.game.id}`}
          style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, opacity: 0.7 }}
        >
          Open →
        </Link>
      </div>

      {game.game.status === 'lobby' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {game.teamSwapMode === 'open' || game.game.hostUserUuid === meUuid ? (
              <TeamPicker
                members={game.members}
                teams={game.teams}
                myTeamId={game.members.find(m => m.counter.uuid === meUuid && m.status === 'active')?.teamId ?? null}
                onPick={teamId => pickTeam(game.game.id, teamId, true)}
                onToggleLock={game.game.hostUserUuid === meUuid ? teamId => {
                  const team = game.teams.find(t => t.id === teamId)
                  send('bingo_update_team_lock', { gameId: game.game.id, teamId, locked: !team?.locked })
                } : undefined}
                disabled={pending}
              />
            ) : (
              <TeamFaces members={game.members} teams={game.teams} />
            )}
            <span style={{ marginLeft: 'auto' }}><GameRank rank={game.game.rank} /></span>
          </div>
          {game.game.hostUserUuid === meUuid ? (
            <>
              <BingoSettings state={game} isHost pending={pending} send={send} />
              <HostRoster state={game} meUuid={meUuid} pending={pending} send={send} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => send('bingo_start', { gameId: game.game.id })}
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 800,
                    background: 'var(--primary)', color: 'var(--primary-foreground)', cursor: 'pointer',
                  }}
                >
                  Start
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => send('bingo_cancel', { gameId: game.game.id })}
                  style={{
                    padding: '7px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                    border: '1px solid var(--border)', background: 'var(--background)', color: 'inherit', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ color: 'var(--muted-foreground)' }}>
                Waiting for <strong style={{ color: 'var(--foreground)' }}>
                  {game.members.find(m => m.counter.uuid === game.game.hostUserUuid)?.counter.username ?? 'the host'}
                </strong>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => send('bingo_leave', { gameId: game.game.id })}
                style={{
                  marginLeft: 'auto', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  border: '1px solid var(--border)', background: 'var(--background)', color: 'inherit', cursor: 'pointer',
                }}
              >
                Leave
              </button>
            </div>
          )}
        </div>
      ) : (
        <BingoBoard
          state={game}
          lastUnlock={lastUnlock}
          density="compact"
          highlight={new Set(here.map(s => s.index))}
          related={new Set(threadUuid ? feeds.map(s => s.index) : [])}
          meUuid={meUuid}
        />
      )}

      {game.game.status !== 'lobby' && here.map(sq => (
        <ThreadSquare key={sq.id} state={game} square={sq} meUuid={meUuid} />
      ))}

      {game.game.status !== 'lobby' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
          {scores
            .filter(({ team }) => game.members.some(m => m.teamId === team.id && m.status === 'active'))
            .map(({ team, score, color }) => (
              <div
                key={team.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 8px', borderRadius: 7,
                  background: color.soft, border: `1px solid ${color.fill}33`,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 2, background: color.fill, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 800 }}>{team.name}</span>
                <span style={{ fontSize: 13, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
                <span style={{ marginLeft: 'auto' }}>
                  <TeamFaces members={game.members} teams={[team]} max={6} />
                </span>
              </div>
            ))}
        </div>
      )}

      {game.game.status === 'running' && game.members.some(m => m.counter.uuid === meUuid && m.status === 'active') && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <ForfeitButton gameId={game.game.id} pending={pending} send={send} size="small" />
        </div>
      )}
    </section>
  )
}

function HostRoster({ state, meUuid, pending, send }: {
  state: NonNullable<ReturnType<typeof useBingo>['game']>
  meUuid: string | null
  pending: boolean
  send: (event: string, data?: Record<string, unknown>) => void
}) {
  const [open, setOpen] = useState(false)
  const gameId = state.game.id
  const players = state.members.filter(m => m.status === 'active').length
  const locked = state.teams.filter(t => t.locked).length
  return (
    <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', border: 'none', background: 'transparent',
          color: 'var(--foreground)', cursor: 'pointer', fontWeight: 700, fontSize: 13,
        }}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>Teams</span>
        <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 600 }}>
          {players}{locked ? ` · ${locked} locked` : ''}
        </span>
        <Chevron open={open} />
      </button>
      {open && (
        <div style={{ padding: '4px 10px 10px', borderTop: '1px solid var(--border)' }}>
          <Teams
            teams={state.teams}
            members={state.members}
            scores={null}
            meUuid={meUuid}
            isHost
            canSwap
            status={state.game.status}
            pending={pending}
            onMove={(targetUserUuid, targetTeamId) => send('bingo_move_member', { gameId, targetUserUuid, targetTeamId })}
            onKick={targetUserUuid => send('bingo_kick', { gameId, targetUserUuid })}
            onToggleLock={teamId => {
              const team = state.teams.find(t => t.id === teamId)
              send('bingo_update_team_lock', { gameId, teamId, locked: !team?.locked })
            }}
          />
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import BingoBoard from '@/components/bingo/BingoBoard'
import { GameRank } from '@/components/bingo/GameBits'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { avatarUrl } from '@/lib/counterUtils'
import {
  formatClock, isLockout, squareDisplay, squareName, teamColor,
  type BingoGameState, type BingoSquare as LiveSquare,
} from '@/lib/bingo'
import { scoreGame, type BingoGameView } from '@/lib/bingoResult'

type Member = BingoGameView['members'][number]

export default function GameDetailClient({ game }: { game: BingoGameView }) {
  const { scores, outcome, durationMs, winner } = useMemo(() => scoreGame(game), [game])
  const state = useMemo(() => toState(game), [game])
  const narrow = useNarrow()
  const started = Number(game.startedAt)

  const memberByUuid = useMemo(() => new Map(game.members.map(m => [m.userUuid, m])), [game.members])
  const teamKey = (teamId: number | null | undefined) =>
    game.teams.find(t => t.id === teamId)?.key ?? game.teams.find(t => t.id === teamId)?.name?.toLowerCase() ?? null

  const held = useMemo(() => {
    const byPlayer = new Map<string, number>()
    for (const sq of game.squares) {
      if (sq.isUnlocked && sq.mostRecentUnlockerUserUuid) {
        byPlayer.set(sq.mostRecentUnlockerUserUuid, (byPlayer.get(sq.mostRecentUnlockerUserUuid) ?? 0) + 1)
      }
    }
    return byPlayer
  }, [game.squares])

  const claims = useMemo(
    () => state.squares
      .filter(sq => sq.isUnlocked && sq.mostRecentUnlockerTeamId)
      .sort((a, b) => Number(a.mostRecentUnlockAt ?? 0) - Number(b.mostRecentUnlockAt ?? 0)),
    [state.squares],
  )

  const standings = scores.filter(s => game.members.some(m => m.teamId === s.id))
  const winColor = winner ? teamColor(teamKey(winner.id)) : null
  const finished = Number(game.finishedAt)
  const playedAt = Number.isFinite(finished) && finished > 0
    ? new Date(finished).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <main style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 16px 80px' }}>
      <style>{`
        .bg-result { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 20px; align-items: start; }
        @media (max-width: 860px) { .bg-result { grid-template-columns: minmax(0, 1fr); } }
        .bg-claim { display: grid; grid-template-columns: 52px 34px minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1fr); gap: 10px; align-items: center; }
        @media (max-width: 600px) { .bg-claim { grid-template-columns: 46px 30px minmax(0, 1fr) minmax(0, 1fr); } .bg-claim .bg-thread { display: none; } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>Bingo #{game.id}</h1>
        <GameRank rank={game.rank} />
        {isLockout(state.game) && <Chip>lockout</Chip>}
        <span style={{ flex: 1 }} />
        <Link href="/bingo/completed" style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 700, textDecoration: 'none' }}>
          All games
        </Link>
      </div>
      <div style={{ color: 'var(--muted-foreground)', fontSize: 13, margin: '4px 0 18px', fontVariantNumeric: 'tabular-nums' }}>
        {game.host}
        {playedAt ? ` · ${playedAt}` : ''}
        {durationMs != null ? ` · ${formatClock(durationMs / 1000)}` : ''}
        {game.timeLimitSeconds ? ` / ${formatClock(game.timeLimitSeconds)}` : ''}
      </div>

      <div style={{
        fontSize: 22, fontWeight: 900, marginBottom: 16,
        color: winColor?.fill ?? 'var(--foreground)',
      }}>
        {outcome}
      </div>

      <div className="bg-result">
        <BingoBoard state={state} density={narrow ? 'compact' : 'large'} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {standings.map(s => {
            const c = teamColor(teamKey(s.id))
            const members = game.members
              .filter(m => m.teamId === s.id)
              .sort((a, b) => (held.get(b.userUuid) ?? 0) - (held.get(a.userUuid) ?? 0))
            return (
              <div key={s.id} style={{
                borderRadius: 10, padding: '10px 12px', background: 'var(--card)',
                border: `1px solid ${s.id === winner?.id ? c.fill : 'var(--border)'}`,
                borderLeft: `4px solid ${c.fill}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontWeight: 900, color: c.fill }}>{s.name}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 22, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{s.squares}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {members.map(m => (
                    <div key={m.userUuid} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <Face member={m} ring={c.fill} />
                      <Link href={`/counter/${m.username}`} style={{ color: 'var(--foreground)', textDecoration: 'none', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.displayName}
                      </Link>
                      <span style={{ flex: 1 }} />
                      <span style={{ color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>{held.get(m.userUuid) ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {claims.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 8px' }}>Claims</h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {claims.map(sq => {
              const c = teamColor(teamKey(sq.mostRecentUnlockerTeamId))
              const who = sq.mostRecentUnlockerUserUuid ? memberByUuid.get(sq.mostRecentUnlockerUserUuid) : undefined
              const at = Number(sq.mostRecentUnlockAt)
              const d = squareDisplay(sq)
              return (
                <div key={sq.id} className="bg-claim" style={{ padding: '7px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
                  <span style={{ color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>
                    {Number.isFinite(at) && started > 0 ? formatClock((at - started) / 1000) : ''}
                  </span>
                  <span style={{
                    fontWeight: 800, fontSize: 12, textAlign: 'center', borderRadius: 6, padding: '2px 0',
                    background: c.fill, color: c.ink,
                  }}>
                    {squareName(sq.index)}
                  </span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 0 }}>
                    {d.big} <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>{d.label}</span>
                  </span>
                  <span className="bg-thread" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sq.threadName
                      ? <Link href={`/thread/${sq.threadName}`} style={{ color: 'var(--muted-foreground)', textDecoration: 'none' }}>{sq.threadTitle || sq.threadName}</Link>
                      : null}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    {who && <Face member={who} ring={c.fill} />}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{who?.displayName ?? ''}</span>
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </main>
  )
}

function useNarrow() {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const q = window.matchMedia('(max-width: 600px)')
    const on = () => setNarrow(q.matches)
    on()
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  return narrow
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 999, border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}>
      {children}
    </span>
  )
}

function Face({ member, ring }: { member: Member; ring: string }) {
  const url = avatarUrl({ discordId: member.discordId ?? '', avatar: member.avatar ?? '' }, 32)
  return (
    <Avatar style={{ width: 22, height: 22, flexShrink: 0, boxShadow: `0 0 0 2px ${ring}` }}>
      {url && <AvatarImage src={url} alt="" />}
      <AvatarFallback style={{ fontSize: 10, fontWeight: 800 }}>{(member.displayName || '?').slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

function toState(g: BingoGameView): BingoGameState {
  const teams = g.teams.map(t => ({ id: t.id, key: t.key ?? t.name.toLowerCase(), name: t.name, locked: true }))
  return {
    game: {
      id: g.id, hostUserUuid: '', status: 'finished', mode: g.mode ?? 'bingo', rank: g.rank,
      allowJoin: false, joinMode: 'closed', joinCode: null,
      timeLimitSeconds: g.timeLimitSeconds ?? 0, minTimeSeconds: null,
      createdAt: 0, startedAt: Number(g.startedAt), endsAt: 0, graceEndsAt: 0, finishedAt: Number(g.finishedAt),
      winnerUserUuid: null, winnerTeamId: g.winnerTeamId ?? null, winnerAt: Number(g.winnerAt) || null,
      winnerTeamSize: null, winnerUsername: null, winningLines: g.winningLines ?? [],
    },
    members: g.members.map(m => ({
      counter: {
        uuid: m.userUuid, id: 0, discordId: m.discordId ?? '', name: m.displayName, username: m.username,
        color: m.color ?? '', roles: [], rainbow: 0, avatar: m.avatar ?? '', emoji: null, title: '', xp: 0,
      },
      role: m.role, status: 'active', teamId: m.teamId ?? 0, teamName: m.teamName ?? '',
      teamKey: teams.find(t => t.id === m.teamId)?.key ?? '',
    })),
    teams,
    teamSwapMode: 'locked',
    squares: g.squares.map((sq): LiveSquare => ({
      id: sq.id, index: sq.index, challengeType: sq.challengeType ?? '', rank: sq.rank ?? g.rank,
      threadUuid: sq.threadUuid ?? null, threadName: sq.threadName ?? null, threadTitle: sq.threadTitle ?? null,
      target: Number(sq.target) || 0, params: sq.params ?? null, scoreToBeat: sq.scoreToBeat,
      progressValue: Number(sq.progressValue) || 0, isUnlocked: sq.isUnlocked,
      mostRecentUnlockerUserUuid: sq.mostRecentUnlockerUserUuid ?? undefined,
      mostRecentUnlockerTeamId: sq.mostRecentUnlockerTeamId ?? undefined,
      mostRecentUnlockAt: sq.mostRecentUnlockAt != null ? Number(sq.mostRecentUnlockAt) : undefined,
    })),
  }
}

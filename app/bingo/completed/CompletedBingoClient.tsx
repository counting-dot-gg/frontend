'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { squareName, teamColor as palette } from '@/lib/bingo'
import { outcomeText, type WinReason } from '@/lib/bingoResult'
import { formatClock } from '@/lib/paceScale'
import Boundary from '@/components/Boundary'

import { API } from '@/lib/apiBase'
const PAGE = 25

interface Member {
  userUuid: string
  username: string
  displayName: string
  avatar: string
  teamId: number | null
  teamName: string | null
  role: string
}
interface Team { id: number; name: string }
interface Square {
  id: number
  index: number
  isUnlocked: boolean
  mostRecentUnlockerTeamId: number | null
  mostRecentUnlockerUserUuid: string | null
}
interface Game {
  id: number
  host: string
  status: string
  rank: string
  players: number
  startedAt: string
  finishedAt: string
  members: Member[]
  teams: Team[]
  squares: Square[]
  winnerTeamId?: number | null
  winReason?: WinReason | null
}

const NEUTRAL = 'rgb(var(--ink-rgb) / 0.07)'

function teamColor(name: string | null | undefined): string {
  return name ? palette(name.toLowerCase()).fill : 'var(--ink-3)'
}

function MiniBoard({ squares, teams }: { squares: Square[]; teams: Team[] }) {
  const byId = useMemo(() => new Map(teams.map(t => [t.id, t.name])), [teams])
  const side = Math.max(1, Math.round(Math.sqrt(squares.length || 25)))
  const ordered = [...squares].sort((a, b) => a.index - b.index)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${side}, 1fr)`,
        gap: 2,
        width: side * 16,
        flexShrink: 0,
      }}
      aria-label="Final board"
    >
      {ordered.map(sq => {
        const name = sq.mostRecentUnlockerTeamId != null ? byId.get(sq.mostRecentUnlockerTeamId) : null
        return (
          <div
            key={sq.id}
            title={sq.isUnlocked ? `${squareName(sq.index)}: ${name ?? 'Unknown'}` : squareName(sq.index)}
            style={{
              width: 14, height: 14, borderRadius: 3,
              background: sq.isUnlocked ? teamColor(name) : NEUTRAL,
              border: sq.isUnlocked ? 'none' : '1px solid rgb(var(--ink-rgb) / 0.08)',
            }}
          />
        )
      })}
    </div>
  )
}

function GameCard({ game }: { game: Game }) {
  const started = Number(game.startedAt)
  const finished = Number(game.finishedAt)
  const duration = Number.isFinite(started) && Number.isFinite(finished) && finished > started
    ? finished - started
    : null

  const scores = useMemo(() => {
    const counts = new Map<number, number>()
    for (const sq of game.squares) {
      if (!sq.isUnlocked || sq.mostRecentUnlockerTeamId == null) continue
      counts.set(sq.mostRecentUnlockerTeamId, (counts.get(sq.mostRecentUnlockerTeamId) ?? 0) + 1)
    }
    return game.teams
      .map(t => ({ ...t, squares: counts.get(t.id) ?? 0 }))
      .sort((a, b) => b.squares - a.squares)
  }, [game])

  const winner = game.teams.find(t => t.id === game.winnerTeamId) ?? null
  const playedAt = Number.isFinite(finished)
    ? new Date(finished).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : '-'

  return (
    <li style={{
      display: 'flex', gap: 14, alignItems: 'flex-start',
      padding: 14, borderRadius: 10,
      background: 'rgb(var(--ink-rgb) / 0.025)', border: '1px solid rgb(var(--ink-rgb) / 0.07)',
    }}>
      <MiniBoard squares={game.squares} teams={game.teams} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <Link
            href={`/bingo/${game.id}`}
            style={{ fontWeight: 800, fontSize: 14, color: winner ? teamColor(winner.name) : 'var(--foreground)', textDecoration: 'none' }}
          >
            {outcomeText(winner?.name, game.winReason)}
            <span style={{ color: 'var(--muted-foreground)', fontWeight: 700 }}> #{game.id}</span>
          </Link>
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {scores.map(s => s.squares).join('–')}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'var(--ink-3)', border: '1px solid rgb(var(--ink-rgb) / 0.12)', borderRadius: 999, padding: '1px 7px',
          }}>
            {game.rank}
          </span>
        </div>

        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
          {playedAt}
          {duration != null && <> · {formatClock(duration)}</>}
          {' · '}hosted by {game.host}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {game.members.map(m => (
            <span
              key={m.userUuid}
              title={m.teamName ? `${m.displayName}: ${m.teamName}` : m.displayName}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '2px 9px 2px 2px', borderRadius: 999,
                background: 'rgb(var(--ink-rgb) / 0.05)',
                borderLeft: `3px solid ${teamColor(m.teamName)}`,
                fontSize: 11,
              }}
            >
              <span style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: `${teamColor(m.teamName)}33`,
                color: teamColor(m.teamName), fontSize: 9, fontWeight: 900,
              }}>
                {(m.displayName || m.username || '?').slice(0, 1).toUpperCase()}
              </span>
              <Link href={`/counter/${m.username}`} style={{ color: 'var(--foreground)', textDecoration: 'none' }}>
                {m.displayName}
              </Link>
            </span>
          ))}
        </div>
      </div>
    </li>
  )
}

export default function CompletedBingoClient() {
  const router = useRouter()
  const params = useSearchParams()
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
  const [games, setGames] = useState<Game[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`${API}/api/bingo/completed?offset=${(p - 1) * PAGE}&limit=${PAGE}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      setGames(data?.games ?? [])
      setTotal(Number(data?.total) || 0)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(page) }, [load, page])

  const pages = Math.max(1, Math.ceil(total / PAGE))
  const go = (p: number) => {
    router.push(p === 1 ? '/bingo/completed' : `/bingo/completed?page=${p}`)
    window.scrollTo({ top: 0 })
  }

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>
          Bingo history
        </h1>
        <Link href="/bingo" style={{ fontSize: 13, color: '#f97316', fontWeight: 700, textDecoration: 'none' }}>
          Back to bingo →
        </Link>
      </div>

      <Boundary name="Bingo history">
        {error ? (
          <div style={{ fontSize: 13, color: 'var(--danger)' }}>
            Couldn’t load games.{' '}
            <button
              onClick={() => load(page)}
              style={{ background: 'none', border: 'none', color: '#f97316', cursor: 'pointer', fontWeight: 700, padding: 0 }}
            >
              Try again
            </button>
          </div>
        ) : loading && games.length === 0 ? (
          <GameSkeleton />
        ) : games.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
            No games have finished yet. <Link href="/bingo" style={{ color: '#f97316' }}>Start one.</Link>
          </div>
        ) : (
          <>
            <ul style={{
              listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10,
              opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s',
            }}>
              {games.map(g => <GameCard key={g.id} game={g} />)}
            </ul>
            {pages > 1 && <Pager page={page} pages={pages} onGo={go} />}
          </>
        )}
      </Boundary>
    </main>
  )
}

function Pager({ page, pages, onGo }: { page: number; pages: number; onGo: (p: number) => void }) {
  const list = [...new Set([1, pages, page - 1, page, page + 1].filter(p => p >= 1 && p <= pages))].sort((a, b) => a - b)
  const btn = (active: boolean): React.CSSProperties => ({
    minWidth: 34, height: 34, padding: '0 8px', borderRadius: 8, fontSize: 13, fontWeight: 700,
    border: '1px solid ' + (active ? 'var(--primary)' : 'rgb(var(--ink-rgb) / 0.15)'),
    background: active ? 'var(--primary)' : 'transparent',
    color: active ? 'var(--primary-foreground)' : 'var(--foreground)',
    cursor: active ? 'default' : 'pointer', fontVariantNumeric: 'tabular-nums',
  })
  return (
    <nav aria-label="Pages" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 18, flexWrap: 'wrap' }}>
      <button style={{ ...btn(false), opacity: page === 1 ? 0.35 : 1 }} disabled={page === 1} onClick={() => onGo(page - 1)} aria-label="Previous page">‹</button>
      {list.map((p, i) => (
        <span key={p} style={{ display: 'contents' }}>
          {i > 0 && p - list[i - 1] > 1 && <span style={{ color: 'var(--muted-foreground)' }}>…</span>}
          <button style={btn(p === page)} aria-current={p === page ? 'page' : undefined} onClick={() => p !== page && onGo(p)}>{p}</button>
        </span>
      ))}
      <button style={{ ...btn(false), opacity: page === pages ? 0.35 : 1 }} disabled={page === pages} onClick={() => onGo(page + 1)} aria-label="Next page">›</button>
    </nav>
  )
}

function GameSkeleton() {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <style>{`@keyframes bgShimmer{0%{background-position:-360px 0}100%{background-position:360px 0}}`}</style>
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} style={{
          display: 'flex', gap: 14, padding: 14, borderRadius: 10,
          background: 'rgb(var(--ink-rgb) / 0.025)', border: '1px solid rgb(var(--ink-rgb) / 0.07)',
          opacity: 1 - i * 0.18,
        }}>
          <div style={{ ...shimmer, width: 80, height: 80, borderRadius: 4, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ ...shimmer, width: '45%', height: 14, borderRadius: 4 }} />
            <div style={{ ...shimmer, width: '65%', height: 10, borderRadius: 4 }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ ...shimmer, width: 90, height: 20, borderRadius: 999 }} />
              <div style={{ ...shimmer, width: 76, height: 20, borderRadius: 999 }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

const shimmer: React.CSSProperties = {
  background: 'linear-gradient(90deg,rgb(var(--ink-rgb) / 0.04) 25%,rgb(var(--ink-rgb) / 0.09) 50%,rgb(var(--ink-rgb) / 0.04) 75%)',
  backgroundSize: '360px 100%',
  animation: 'bgShimmer 1.3s infinite linear',
}

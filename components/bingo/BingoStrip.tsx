'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import BingoBoard from './BingoBoard'
import { TeamFaces } from './GameBits'
import { scoreText } from './ThreadSquare'
import { useBingo } from './useBingo'
import { useFeatureFlag } from '@/lib/featureFlags'
import { asSeenBy, formatClock, secondsLeft, squareFace, squareName, teamColorById, teamProgress, teamScores } from '@/lib/bingo'

const noop = () => {}

export function BingoStripSkeleton({ style }: { style?: React.CSSProperties }) {
  const block = (w: number | string, h: number, r = 4): React.CSSProperties =>
    ({ width: w, height: h, borderRadius: r, background: 'var(--muted)', flexShrink: 0 })
  return (
    <div aria-hidden style={{ flexShrink: 0, borderBottom: '1px solid var(--thread-line)', background: 'var(--card)', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px' }}>
        <div style={block(48, 48, 6)} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={block('45%', 14)} />
          <div style={block('100%', 6, 999)} />
        </div>
        <div style={block(62, 28, 7)} />
      </div>
    </div>
  )
}

export default function BingoStrip({ isLoggedIn, meUuid, threadUuid, expectGame = false, style }: {
  isLoggedIn: boolean
  expectGame?: boolean
  meUuid: string | null
  threadUuid: string | null
  style?: React.CSSProperties
}) {
  const bingoEnabled = useFeatureFlag('bingo')
  const { game, activeGameId, activeKnown } = useBingo(isLoggedIn && (bingoEnabled || expectGame), { list: false })
  const [now, setNow] = useState(() => Date.now())
  const [open, setOpen] = useState(false)
  const running = game?.game.status === 'running'

  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [running])

  if (!game) return expectGame && (!activeKnown || activeGameId != null) ? <BingoStripSkeleton style={style} /> : null
  if (!running) return null
  const myTeamId = game.members.find(m => m.counter.uuid === meUuid && m.status === 'active')?.teamId ?? null
  if (myTeamId == null) return null
  const myColor = teamColorById(game.teams, myTeamId)
  const shell: React.CSSProperties = {
    flexShrink: 0, borderBottom: '1px solid var(--thread-line)', background: 'var(--card)',
    ...style,
  }
  const square = threadUuid ? game.squares.find(s => s.threadUuid === threadUuid) ?? null : null
  const left = secondsLeft(game.game, now)
  const href = `/bingo/${game.game.id}`

  const clock = left != null && (
    <span style={{
      flexShrink: 0, fontSize: 16, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
      ...(myColor ? { background: myColor.fill, color: myColor.ink, padding: '3px 8px', borderRadius: 7 } : {}),
    }}>
      {formatClock(left)}
    </span>
  )
  const row = (children: React.ReactNode) => (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={() => setOpen(o => !o)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o) } }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', cursor: 'pointer' }}
    >
      {children}
    </div>
  )
  const board = (highlight: Set<number>) => (
    <div style={{ width: 48, flexShrink: 0 }}>
      <BingoBoard state={game} density="mini" highlight={highlight} onSquareClick={noop} meUuid={meUuid} />
    </div>
  )
  const full = (highlight: Set<number>) => open && (
    <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <BingoBoard state={game} density="compact" highlight={highlight} meUuid={meUuid} />
      <Link prefetch={false} href={href} style={{ alignSelf: 'flex-end', fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>
        Open game →
      </Link>
    </div>
  )

  if (!square) {
    const lockout = game.game.mode === 'lockout'
    const playing = teamScores(game.squares, game.teams)
      .filter(({ team }) => game.members.some(m => m.teamId === team.id && m.status === 'active'))
    const none = new Set<number>()
    return (
      <div style={shell}>
        {row(<>
          {board(none)}
          <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
            {playing.map(({ team, score, color }) => (
              <span key={team.id} style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                {lockout && (
                  <span style={{ fontSize: 16, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: color.fill }}>{score}</span>
                )}
                <TeamFaces members={game.members} teams={[team]} max={4} />
              </span>
            ))}
          </span>
          {clock}
        </>)}
        {full(none)}
      </div>
    )
  }

  const bars = teamProgress(square, game.teams)
  const mine = bars.find(b => b.teamId === myTeamId) ?? null
  const rival = bars.filter(b => b.teamId !== myTeamId).sort((a, b) => b.pct - a.pct)[0] ?? null
  const holder = square.isUnlocked ? teamColorById(game.teams, square.mostRecentUnlockerTeamId) : null
  const unclaimed = { ...square, isUnlocked: false }
  const goal = squareFace({ ...unclaimed, progressValue: 0, scoreToBeat: undefined })
  const toward = squareFace(asSeenBy(unclaimed, myTeamId))
  const name = squareName(square.index)

  const here = new Set([square.index])

  return (
    <div style={shell}>
    {row(<>
      {board(here)}

      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
          <span style={{
            fontSize: 11, fontWeight: 800, padding: '1px 5px', borderRadius: 4, flexShrink: 0,
            background: holder?.fill ?? 'var(--muted)', color: holder?.ink ?? 'var(--muted-foreground)',
          }}>
            {name}
          </span>
          <span style={{
            fontSize: 20, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
            color: mine ? myColor?.fill ?? 'var(--foreground)' : 'var(--muted-foreground)',
          }}>
            {mine ? scoreText(square, mine.score) : goal.big}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', color: 'var(--muted-foreground)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {mine ? toward.sub : goal.sub}
          </span>
          {rival && (
            <span style={{
              marginLeft: 'auto', fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums', flexShrink: 0,
              color: rival.color.fill,
            }}>
              {scoreText(square, rival.score)}
            </span>
          )}
        </span>
        <span style={{ position: 'relative', display: 'block', height: 6, borderRadius: 3, background: 'var(--muted)', overflow: 'hidden' }}>
          {rival && (
            <span style={{ position: 'absolute', inset: '0 auto 0 0', width: `${rival.pct}%`, background: rival.color.fill, opacity: 0.4 }} />
          )}
          {mine && (
            <span style={{ position: 'absolute', inset: '0 auto 0 0', width: `${mine.pct}%`, background: mine.color.fill }} />
          )}
        </span>
      </span>

      {clock}
    </>)}
    {full(here)}
    </div>
  )
}

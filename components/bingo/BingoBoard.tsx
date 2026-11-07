'use client'

import { forwardRef, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { SpreadRows } from '@/components/rank/SpreadBreakdown'
import { getChallengeTitle, getProgressLabel } from '@/lib/rankUtils'
import {
  asSeenBy, BOARD_DIM, isLockout, shortLabel, shortCount, squareDisplay, squareFace, squareGap, squareName, squareThreshold, teamColorById, teamProgress, winningIndices,
  type BoardDensity,
} from '@/lib/bingo'
import type { BingoGameState, BingoSquare, BingoTeam } from '@/lib/bingo'

interface Props {
  state: BingoGameState
  lastUnlock?: { index: number; unlockSeq: number } | null
  density?: BoardDensity
  onSquareClick?: (index: number) => void
  highlight?: Set<number>
  related?: Set<number>
  meUuid?: string | null
}

const GRID_GAP = 'clamp(3px, 0.7vw, 8px)'
const AXIS: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, color: 'var(--muted-foreground)', textAlign: 'center', lineHeight: 1,
}

export default function BingoBoard({ state, lastUnlock, density = 'large', onSquareClick, highlight, related, meUuid }: Props) {
  const { squares, teams, game } = state
  const cellGame = useMemo(() => ({ status: game.status, mode: game.mode }), [game.status, game.mode])
  const clickRef = useRef(onSquareClick)
  clickRef.current = onSquareClick
  const stableClick = useCallback((i: number) => clickRef.current?.(i), [])
  const clickable = !!onSquareClick
  const myTeamId = meUuid
    ? state.members?.find(m => m.counter.uuid === meUuid && m.status === 'active')?.teamId ?? null
    : null
  const lines = game.status === 'finished' ? (game.winningLines ?? []) : []
  const wins = game.status === 'finished' ? winningIndices(game) : new Set<number>()
  const barred = new Set<number>()
  const ringOf = new Map<number, string>()
  for (const entry of lines) {
    const straight = new Set(entry.line.map(i => Math.floor(i / BOARD_DIM))).size === 1
      || new Set(entry.line.map(i => i % BOARD_DIM)).size === 1
    for (const i of entry.line) {
      if (straight) barred.add(i)
      else ringOf.set(i, teamColorById(teams, entry.teamId)?.fill ?? 'var(--primary)')
    }
  }
  const [flash, setFlash] = useState<{ index: number; seq: number } | null>(null)
  const lastSeq = useRef(0)
  useEffect(() => {
    if (!lastUnlock || lastUnlock.unlockSeq <= lastSeq.current) return
    lastSeq.current = lastUnlock.unlockSeq
    setFlash({ index: lastUnlock.index, seq: lastUnlock.unlockSeq })
    const t = window.setTimeout(() => setFlash(null), 1400)
    return () => window.clearTimeout(t)
  }, [lastUnlock])

  const [spread, setSpread] = useState<number | null>(null)
  const spreadRef = useRef<HTMLDivElement>(null)
  const openSpread = useCallback((i: number) => setSpread(s => (s === i ? null : i)), [])
  useEffect(() => {
    if (spread == null) return
    const away = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (spreadRef.current?.contains(t) || t?.closest?.('[data-spread-cell]')) return
      setSpread(null)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setSpread(null) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [spread])

  const axes = density !== 'mini'
  const byIndex = new Map<number, BingoSquare>()
  for (const sq of squares) byIndex.set(sq.index, sq)

  return (
    <>
      <style>{`
        @keyframes bingo-claim {
          0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgb(var(--ink-rgb) / 0.9); }
          40%  { transform: scale(1.06); box-shadow: 0 0 0 8px rgb(var(--ink-rgb) / 0); }
          100% { transform: scale(1);    box-shadow: 0 0 0 0 rgb(var(--ink-rgb) / 0); }
        }
        .bingo-flash { animation: bingo-claim 1.2s ease-out; }

        @media (prefers-reduced-motion: reduce) {
          .bingo-flash { animation: none; }
        }
      `}</style>

      <div style={{
        display: 'grid', gridTemplateColumns: axes ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)',
        columnGap: axes ? 6 : 0, rowGap: axes ? 4 : 0,
      }}>
        {axes && <span />}
        {axes && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${BOARD_DIM}, 1fr)`, gap: GRID_GAP }}>
            {Array.from({ length: BOARD_DIM }, (_, c) => (
              <span key={c} style={AXIS}>{String.fromCharCode(65 + c)}</span>
            ))}
          </div>
        )}
        {axes && (
          <div style={{ display: 'grid', gridTemplateRows: `repeat(${BOARD_DIM}, 1fr)`, gap: GRID_GAP }}>
            {Array.from({ length: BOARD_DIM }, (_, r) => (
              <span key={r} style={{ ...AXIS, display: 'flex', alignItems: 'center' }}>{r + 1}</span>
            ))}
          </div>
        )}
      <div
        role="grid"
        aria-label="Bingo board"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${BOARD_DIM}, 1fr)`,
          gridAutoRows: '1fr',
          aspectRatio: density === 'compact' ? '1 / 1.25' : '1 / 1',
          gap: density === 'mini' ? 2 : GRID_GAP,
          width: '100%',
          position: 'relative',
          containerType: 'inline-size',
          contain: 'layout style',
        }}
      >
        {lines.map(entry => {
          const rows = entry.line.map(i => Math.floor(i / BOARD_DIM))
          const cols = entry.line.map(i => i % BOARD_DIM)
          const straight = new Set(rows).size === 1 || new Set(cols).size === 1
          if (!straight) return null
          const color = teamColorById(teams, entry.teamId)?.fill ?? 'var(--primary)'
          const pad = density === 'mini' ? 1 : 5
          return (
            <div
              key={`${entry.teamId}-${entry.line.join('-')}`}
              aria-hidden
              style={{
                gridRow: `${Math.min(...rows) + 1} / ${Math.max(...rows) + 2}`,
                gridColumn: `${Math.min(...cols) + 1} / ${Math.max(...cols) + 2}`,
                margin: -pad, borderRadius: density === 'mini' ? 4 : 12,
                background: color, zIndex: 0, pointerEvents: 'none',
                boxShadow: density === 'mini' ? 'none' : `0 0 0 3px var(--background), 0 0 0 5px ${color}, 0 8px 24px rgb(var(--shadow-rgb) / 0.3)`,
              }}
            />
          )
        })}

        {Array.from({ length: BOARD_DIM * BOARD_DIM }, (_, i) => (
          <Cell
            key={i}
            index={i}
            square={byIndex.get(i) ?? null}
            teams={teams}
            density={density}
            lockout={isLockout(game)}
            onSquareClick={clickable ? stableClick : undefined}
            isWinning={wins.has(i)}
            inBar={barred.has(i)}
            dimmed={lines.length > 0 && !wins.has(i)}
            ringColor={ringOf.get(i) ?? null}
            isFlashing={flash?.index === i}
            isHighlighted={!!highlight?.has(i)}
            isRelated={!!related?.has(i)}
            game={cellGame}
            myTeamId={myTeamId}
            onSpread={!clickable && density !== 'mini' ? openSpread : undefined}
          />
        ))}
        {spread != null && byIndex.get(spread) && (
          <SpreadPopup
            ref={spreadRef}
            index={spread}
            square={byIndex.get(spread)!}
            teams={teams}
            myTeamId={myTeamId}
            onClose={() => setSpread(null)}
          />
        )}
      </div>
      </div>

    </>
  )
}

function squareDestination(square: BingoSquare): { href: string; label: string } {
  switch (square.challengeType) {
    case 'lrwoed_score':
      return { href: '/lrwoed', label: 'Play lrwoed' }
    case 'number_shuffle_win':
      return { href: '/shuffle', label: 'Play Number Shuffle' }
    default: {
      if (square.threadName) {
        return { href: `/thread/${square.threadName}`, label: `Go to ${square.threadTitle || square.threadName}` }
      }
      return { href: '/threads', label: 'Pick a thread' }
    }
  }
}

function estimateTextWidth(text: string, weight: number): number {
  let w = 0
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') w += 55
    else if ('.,:'.includes(ch)) w += 28
    else if ('/|'.includes(ch)) w += 30
    else if (ch === ' ') w += 26
    else if ('≤≥%'.includes(ch)) w += 60
    else if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) w += 62
    else w += 52
  }
  return Math.max(1, w * (weight >= 800 ? 1.06 : 1))
}

function FitText({ children, weight = 900, height, style }: {
  children: string
  weight?: number
  height: string
  style?: React.CSSProperties
}) {
  const text = children ?? ''
  const ref = useRef<SVGTextElement>(null)
  const [measured, setMeasured] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let live = true
    const measure = () => {
      if (!live) return
      try {
        const m = el.getComputedTextLength()
        if (m > 0) setMeasured(m * 1.03)
      } catch {}
    }
    measure()
    document.fonts?.ready.then(measure).catch(() => {})
    return () => { live = false }
  }, [text, weight])
  const w = measured ?? estimateTextWidth(text, weight)
  return (
    <svg
      viewBox={`0 0 ${w} 100`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={text}
      style={{ display: 'block', width: '100%', height, overflow: 'visible', ...style }}
    >
      <text
        ref={ref}
        x={w / 2}
        y={76}
        textAnchor="middle"
        fontSize={100}
        fontWeight={weight}
        fill="currentColor"
        style={{ fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }}
      >
        {text}
      </text>
    </svg>
  )
}

const SpreadPopup = forwardRef<HTMLDivElement, {
  index: number
  square: BingoSquare
  teams: BingoTeam[]
  myTeamId: number | null
  onClose: () => void
}>(function SpreadPopup({ index, square, teams, myTeamId, onClose }, ref) {
  const per = (square.params?._teamThreadCounts ?? {}) as Record<string, Record<string, number>>
  const leader = [...teamProgress(square, teams)].sort((a, b) => b.pct - a.pct)[0]?.teamId ?? null
  const teamId = myTeamId ?? (square.isUnlocked ? square.mostRecentUnlockerTeamId : null) ?? leader
  const color = teamColorById(teams, teamId)
  const goal = squareFace({ ...square, isUnlocked: false, progressValue: 0, scoreToBeat: undefined })
  const row = Math.floor(index / BOARD_DIM)
  const below = row < BOARD_DIM - 2
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${squareName(index)} by thread`}
      style={{
        position: 'absolute', left: 0, right: 0, zIndex: 5,
        ...(below ? { top: `calc(${((row + 1) / BOARD_DIM) * 100}% + 2px)` } : { bottom: `calc(${((BOARD_DIM - row) / BOARD_DIM) * 100}% + 2px)` }),
        borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--card-foreground)',
        borderLeft: `4px solid ${color?.fill ?? 'var(--border)'}`,
        boxShadow: '0 8px 24px rgb(var(--shadow-rgb) / 0.3)', padding: '6px 0 6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 0 10px' }}>
        <span style={{ fontSize: 11, fontWeight: 800 }}>{squareName(index)}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {goal.big} {goal.sub}
        </span>
        <button type="button" onClick={onClose} aria-label="Close" style={{
          border: 'none', background: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px',
        }}>×</button>
      </div>
      <SpreadRows
        tallies={teamId != null ? per[String(teamId)] ?? {} : {}}
        need={Number(square.params?.minThreads) || 1}
        target={square.target}
        links
      />
    </div>
  )
})

const Cell = memo(function Cell({ index, square, teams, density, lockout, onSquareClick, onSpread, isWinning, inBar, dimmed, ringColor, isFlashing, isHighlighted, isRelated, game, myTeamId }: {
  index: number
  square: BingoSquare | null
  teams: BingoTeam[]
  density: BoardDensity
  lockout: boolean
  onSquareClick?: (index: number) => void
  onSpread?: (index: number) => void
  isWinning: boolean
  inBar: boolean
  dimmed: boolean
  ringColor: string | null
  isFlashing: boolean
  isHighlighted?: boolean
  isRelated?: boolean
  game: { status: string; mode: string }
  myTeamId: number | null
}) {
  if (!square) {
    return <div style={{ borderRadius: density === 'mini' ? 3 : 8, background: 'var(--muted)', opacity: 0.4 }} />
  }

  const claim = square.isUnlocked ? teamColorById(teams, square.mostRecentUnlockerTeamId) : null
  const src = { type: square.challengeType, target: square.target, params: square.params as Record<string, any> | null }
  const title = getChallengeTitle(src)

  const seen = asSeenBy(square, myTeamId)
  const disp = squareDisplay(seen)
  const face = squareFace(seen)
  const bars = teamProgress(square, teams)
  const lead = !claim || lockout ? null
    : myTeamId != null ? squareGap(square, game, myTeamId)?.text ?? null
    : holderLead(square)

  const dest = squareDestination(square)
  const scope = square.threadTitle || square.threadName || (square.threadUuid ? '…' : 'sitewide')

  const label = `${squareName(index)}: ${title} (${scope})${claim ? `, claimed by ${claim.label}` : ''}`

  const spreadable = !!onSpread && square.challengeType === 'thread_breadth'
  const interactive = onSquareClick
    ? { as: 'button' as const, type: 'button' as const, onClick: () => onSquareClick(index) }
    : spreadable
      ? { as: 'button' as const, type: 'button' as const, onClick: () => onSpread(index) }
      : { as: 'link' as const, href: dest.href }

  const Tag: any = interactive.as === 'button' ? 'button' : Link

  return (
    <Tag
      {...(interactive.as === 'button'
        ? { type: 'button', onClick: interactive.onClick }
        : { href: interactive.href, prefetch: false })}
      className={isFlashing ? 'bingo-flash' : undefined}
      aria-label={label}
      data-spread-cell={spreadable ? '' : undefined}
      title={[label, getProgressLabel(src, seen.progressValue), disp.exact]
        .filter(Boolean).join(' · ')}
      style={{
        textDecoration: 'none',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: density === 'large' ? 3 : 1,
        padding: density === 'mini' ? 0 : 'clamp(3px, 0.8cqw, 7px) clamp(2px, 0.8vw, 8px) clamp(8px, 1.6cqw, 14px)',
        borderRadius: density === 'mini' ? 3 : 8,
        gridRow: Math.floor(index / BOARD_DIM) + 1,
        gridColumn: (index % BOARD_DIM) + 1,
        contain: 'layout style',
        zIndex: 1,
        opacity: dimmed ? 0.4 : 1,
        border: inBar || density === 'mini' ? '1px solid transparent' : '1px solid var(--border)',
        background: claim ? claim.fill : density === 'mini' ? 'rgb(var(--ink-rgb) / 0.14)' : 'var(--card)',
        color: claim ? claim.ink : 'var(--card-foreground)',
        cursor: 'pointer',
        overflow: 'hidden',
        textAlign: 'center',
        boxShadow: ringColor && density !== 'mini'
          ? `0 0 0 3px var(--background), 0 0 0 5px ${ringColor}`
          : isHighlighted
            ? (density === 'mini' ? '0 0 0 1.5px var(--foreground)' : '0 0 0 2px var(--background), 0 0 0 4px var(--primary)')
            : 'none',
        outline: isRelated && !isHighlighted ? '2px dashed var(--primary)' : undefined,
        outlineOffset: 2,
        transition: 'background 0.25s, border-color 0.25s',
      }}
    >

      {density !== 'mini' && (
        <span style={{
          flexShrink: 0, width: '100%', boxSizing: 'border-box',
          fontSize: nameSize(scope, density === 'compact' ? 'clamp(8px, 1.9cqw, 14px)' : 'clamp(10px, 1.7cqw, 16px)'),
          fontWeight: 800, letterSpacing: '0.01em', textAlign: 'center',
          opacity: claim ? 0.9 : 0.75,
          padding: '0 2px',
          lineHeight: 1.1,
          height: '2.2em',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          overflowWrap: 'break-word',
          hyphens: 'auto',
          pointerEvents: 'none',
        }}>
          {scope}
        </span>
      )}

      {density !== 'mini' && (
        <span style={{
          flex: 1, minHeight: 0, width: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: density === 'large' ? 3 : 1,
        }}>
          <FitText
            weight={900}
            height={density === 'compact' ? 'clamp(15px, 4.6cqw, 34px)' : 'clamp(16px, 3.6cqw, 40px)'}
            style={{ opacity: face.started ? 1 : 0.5 }}
          >
            {face.big}
          </FitText>
          <FitText
            weight={800}
            height={density === 'compact' ? 'clamp(8px, 2.2cqw, 15px)' : 'clamp(9px, 1.8cqw, 18px)'}
            style={{ opacity: claim ? 0.85 : 0.65, letterSpacing: '0.04em' }}
          >
            {face.sub}
          </FitText>
        </span>
      )}

      {density !== 'mini' && (!claim || !lockout) && bars.length > 0 && (
        <span style={{
          position: 'absolute',
          left: 0, right: 0, bottom: 0,
          background: claim ? 'rgb(var(--shadow-rgb) / 0.55)' : 'transparent',
          borderRadius: '0 0 7px 7px',
          padding: '3px 5px 4px',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {bars.map(bar => (
            <span
              key={bar.teamId}
              style={{
                display: 'block',
                height: 3,
                background: claim ? 'rgb(var(--ink-rgb) / 0.16)' : 'var(--muted)',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <span style={{
                display: 'block', height: '100%', width: `${bar.pct}%`,
                background: bar.color.fill,
                borderRadius: 999,
                transition: 'width 0.4s ease-out',
              }} />
            </span>
          ))}
          </span>
          {lead && (
            <span style={{
              fontSize: density === 'compact' ? 'clamp(8px, 1.9cqw, 12px)' : 'clamp(9px, 1.6cqw, 14px)',
              fontWeight: 900, lineHeight: 1, color: '#fff',
              fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
            }}>
              {lead}
            </span>
          )}
        </span>
      )}
    </Tag>
  )
})

function nameSize(name: string, base: string): string {
  const longest = Math.max(0, ...name.split(/\s+/).map(w => w.length))
  if (longest < 8) return base
  return `max(7px, min(${base}, ${(24 / longest).toFixed(2)}cqw))`
}

function holderLead(square: BingoSquare): string | null {
  const holder = square.mostRecentUnlockerTeamId
  if (!square.isUnlocked || holder == null) return null
  const scores = (square.params?._teamScores ?? {}) as Record<string, number>
  const mine = Number(scores[String(holder)])
  const others = Object.entries(scores)
    .filter(([k]) => Number(k) !== holder).map(([, v]) => Number(v)).filter(Number.isFinite)
  if (!Number.isFinite(mine) || !others.length) return null
  const { mode } = squareThreshold(square)
  const lead = mode === 'higher' ? mine - Math.max(...others) : Math.min(...others) - mine
  if (!(lead > 0)) return null
  const timed = ['split_under_ms', 'get_under_ms', 'bars_within_ms'].includes(square.challengeType)
  return `+${timed ? (lead / 1000).toFixed(3) : shortCount(lead)}`
}

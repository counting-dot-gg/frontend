'use client'

import { asSeenBy, squareDisplay, squareGap, squareName, squareThreshold, teamColorById, teamProgress } from '@/lib/bingo'
import type { BingoGameState, BingoSquare } from '@/lib/bingo'

export default function ThreadSquare({ state, square, meUuid }: {
  state: BingoGameState
  square: BingoSquare
  meUuid: string | null
}) {
  const { teams, members } = state
  const myTeamId = members.find(m => m.counter.uuid === meUuid && m.status === 'active')?.teamId ?? null
  const holder = square.isUnlocked ? teams.find(t => t.id === square.mostRecentUnlockerTeamId) ?? null : null
  const holderColor = teamColorById(teams, square.mostRecentUnlockerTeamId)
  const disp = squareDisplay(asSeenBy(square, myTeamId))
  const bars = teamProgress(square, teams)
  const delta = squareGap(square, state.game, myTeamId)
  const myColor = teamColorById(teams, myTeamId)

  return (
    <div style={{
      marginTop: 10, borderRadius: 12, overflow: 'hidden',
      border: `2px solid ${holderColor?.fill ?? 'var(--primary)'}`,
      background: 'var(--card)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
        background: holderColor?.soft ?? 'var(--muted)',
      }}>
        <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: '0.02em' }}>
          {squareName(square.index)}
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
          background: holderColor?.fill ?? 'var(--background)',
          color: holderColor?.ink ?? 'var(--muted-foreground)',
        }}>
          {holder ? `${holder.name} ✓` : 'Open'}
        </span>
      </div>

      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 34, fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{disp.big}</span>
          <span style={{ fontSize: 14, fontWeight: 700, opacity: 0.6 }}>
            {disp.threshold ? `/${disp.threshold} ` : ''}{disp.label}
          </span>
          {delta && (
            <span style={{
              marginLeft: 'auto', fontSize: 18, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
              color: delta.lead ? myColor?.fill ?? 'var(--foreground)' : 'var(--muted-foreground)',
            }}>
              {delta.text}
            </span>
          )}
        </div>

        {bars.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'max-content 1fr max-content',
            alignItems: 'stretch', rowGap: 2, marginTop: 12,
          }}>
            {bars.map(b => {
              const team = teams.find(t => t.id === b.teamId)
              const mine = b.teamId === myTeamId
              const cell: React.CSSProperties = {
                padding: '5px 0', display: 'flex', alignItems: 'center', background: mine ? b.color.soft : 'transparent',
              }
              return (
                <div key={b.teamId} style={{ display: 'contents' }}>
                  <span style={{ ...cell, paddingLeft: 8, paddingRight: 10, borderRadius: '6px 0 0 6px', fontSize: 12, fontWeight: mine ? 900 : 700, whiteSpace: 'nowrap' }}>
                    {team?.name ?? 'Team'}
                  </span>
                  <span style={cell}>
                    <span style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--muted)', overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${b.pct}%`, background: b.color.fill }} />
                    </span>
                  </span>
                  <span style={{ ...cell, paddingLeft: 10, paddingRight: 8, borderRadius: '0 6px 6px 0', justifyContent: 'flex-end', fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                    {scoreText(square, b.score)}
                  </span>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

export function scoreText(square: BingoSquare, score: number): string {
  const { mode } = squareThreshold(square)
  if (mode === 'lower' && ['split_under_ms', 'get_under_ms', 'bars_within_ms'].includes(square.challengeType)) {
    return `${(score / 1000).toFixed(3)}s`
  }
  return Math.round(score).toLocaleString()
}

export function sitewideFeeds(state: BingoGameState): BingoSquare[] {
  return state.squares.filter(s => s.threadUuid == null && ['thread_counts', 'thread_breadth'].includes(s.challengeType))
}

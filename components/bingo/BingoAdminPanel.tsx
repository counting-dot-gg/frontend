'use client'

import { teamColor } from '@/lib/bingo'
import type { BingoGameState } from '@/lib/bingo'

export type AdminBrush = { teamId: number | null } | null

interface Props {
  state: BingoGameState
  brush: AdminBrush
  onBrushChange: (brush: AdminBrush) => void
  pending: boolean
  send: (event: string, data?: Record<string, unknown>) => void
}

export default function BingoAdminPanel({ state, brush, onBrushChange, pending, send }: Props) {
  const { game, teams, squares } = state
  const gameId = game.id

  const fillLine = (teamId: number, line: number[]) => {
    for (const index of line) send('bingo_admin_square', { gameId, index, teamId })
  }

  const clearAll = () => {
    for (const sq of squares) {
      if (sq.isUnlocked) send('bingo_admin_square', { gameId, index: sq.index, teamId: null })
    }
  }

  return (
    <div style={{
      borderRadius: 10, border: '1px dashed #f59e0b66', background: 'rgba(245,158,11,0.06)',
      padding: 10, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', color: '#f59e0b',
      }}>
        ADMIN · TEST
      </div>

      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {teams.map(team => {
            const color = teamColor(team.key)
            const active = brush?.teamId === team.id
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => onBrushChange(active ? null : { teamId: team.id })}
                style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer',
                  border: `1px solid ${color.fill}`,
                  background: active ? color.fill : 'transparent',
                  color: active ? color.ink : color.fill,
                }}
              >
                {team.name}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => onBrushChange(brush?.teamId === null && brush ? null : { teamId: null })}
            style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: '1px solid var(--border)',
              background: brush && brush.teamId === null ? 'var(--muted)' : 'transparent',
              color: 'var(--muted-foreground)',
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 5 }}>Force a win</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {teams.map(team => {
            const color = teamColor(team.key)
            return (
              <button
                key={team.id}
                type="button"
                disabled={pending}
                onClick={() => fillLine(team.id, [0, 1, 2, 3, 4])}
                style={{
                  padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', border: `1px solid ${color.fill}66`,
                  background: 'transparent', color: color.fill,
                }}
              >
                {team.name} top row
              </button>
            )
          })}
        </div>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={clearAll}
        style={{
          padding: '6px 0', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--muted-foreground)',
        }}
      >
        Reset board
      </button>
    </div>
  )
}

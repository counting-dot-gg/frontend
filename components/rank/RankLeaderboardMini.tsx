'use client'

import { Fragment, useState } from 'react'
import { CounterProgressMini } from './CounterProgressMini'
import { loadProgress } from '@/lib/rankCache'
import { RANK_COLORS, divCeil, divFloor, type RankName } from '@/lib/rankUtils'
import { RankIconBadge } from './RankIconBadge'
import { avatarUrl } from '@/lib/counterUtils'

export type LeaderboardEntry = {
  counterUuid: string
  username: string
  name: string
  avatar: string
  discordId: string
  color: string
  rank: RankName
  division: 1 | 2 | 3
  gg: number
  ggTotal: number
}

type Props = {
  entries: LeaderboardEntry[]
  meUsername?: string
  scope?: string | null
}

type Ranked = { entry: LeaderboardEntry; position: number }

const COLLAPSED_COUNT = 5

export function RankLeaderboardMini({ entries: allEntries, meUsername, scope }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [openUser, setOpenUser] = useState<string | null>(null)
  const clickable = scope !== undefined

  const ranked: Ranked[] = allEntries
    .filter((e) => e.ggTotal > 0)
    .slice()
    .sort((a, b) => b.ggTotal - a.ggTotal || a.counterUuid.localeCompare(b.counterUuid))
    .map((entry, i) => ({ entry, position: i + 1 }))

  if (ranked.length === 0) return null

  const visible = expanded ? ranked : ranked.slice(0, COLLAPSED_COUNT)
  const me = meUsername ? ranked.find((r) => r.entry.username === meUsername) : undefined
  const meIdx = me ? me.position - 1 : -1
  const around: Ranked[] = !expanded && meIdx >= COLLAPSED_COUNT
    ? ranked.slice(Math.max(COLLAPSED_COUNT, meIdx - 1), meIdx + 2)
    : []
  const gapBeforeAround = around.length > 0 && around[0].position - 1 > COLLAPSED_COUNT
  const canExpand = !expanded && ranked.length > COLLAPSED_COUNT

  const th: React.CSSProperties = {
    padding: '4px 8px', textAlign: 'left', fontSize: '0.7rem',
    color: 'var(--ink-3)', fontWeight: 600, borderBottom: '1px solid rgb(var(--ink-rgb) / 0.08)',
  }
  const td: React.CSSProperties = {
    padding: '4px 8px', fontSize: '0.75rem', borderBottom: '1px solid rgb(var(--ink-rgb) / 0.05)',
  }

  function renderRow({ entry, position }: Ranked, isMe: boolean) {
    const rankColor = RANK_COLORS[entry.rank] ?? 'rgb(var(--ink-rgb) / 0.15)'
    const imgUrl = avatarUrl({ discordId: entry.discordId, avatar: entry.avatar })
    const displayName = entry.name || entry.username
    const rowStyle: React.CSSProperties = isMe
      ? { background: 'rgb(var(--ink-rgb) / 0.05)' }
      : {}

    const open = openUser === entry.username
    const toggle = () => setOpenUser(open ? null : entry.username)
    return (
      <Fragment key={entry.counterUuid}>
      <tr
        style={{ ...rowStyle, cursor: clickable ? 'pointer' : undefined }}
        onClick={clickable ? toggle : undefined}
        onPointerEnter={clickable ? () => { void loadProgress(entry.username) } : undefined}
        aria-expanded={clickable ? open : undefined}
      >
        <td style={{ ...td, fontWeight: isMe ? 700 : 400 }}>{position}</td>
        <td style={td}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
              {imgUrl ? (
                <img src={imgUrl} alt="" width={24} height={24} style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  backgroundColor: (entry.color || '#888') + '33',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, fontWeight: 700, color: entry.color || 'var(--ink-2)',
                }}>
                  {entry.username.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <a
              href={`/counter/${entry.username}`}
              style={{
                color: entry.color || 'var(--ink-2)',
                textDecoration: 'none',
                fontSize: '0.75rem',
                fontWeight: isMe ? 700 : 400,
              }}
              onClick={e => e.stopPropagation()}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              {displayName}
            </a>
          </div>
        </td>
        <td style={td}>
          <RankIconBadge rank={entry.rank} division={entry.division} size="mini" />
        </td>
        <td style={{ ...td, textAlign: 'right' }}>
          <span style={{ color: rankColor, fontSize: '0.7rem' }}>
            {entry.ggTotal.toLocaleString()} GG
          </span>
          {(() => {
            const div = (entry.division ?? 1) as 1 | 2 | 3
            const lo = divFloor(entry.rank, div), hi = divCeil(entry.rank, div)
            const pct = entry.rank === 'peak' || !isFinite(hi) ? 100 : Math.max(0, Math.min(100, ((entry.gg - lo) / (hi - lo)) * 100))
            return (
              <div style={{ width: 64, height: 4, marginLeft: 'auto', marginTop: 2, borderRadius: 2, background: 'rgb(var(--ink-rgb) / 0.1)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: rankColor }} />
              </div>
            )
          })()}
        </td>
      </tr>
      {clickable && open && (
        <tr>
          <td colSpan={4} style={{ padding: 0, borderBottom: '1px solid rgb(var(--ink-rgb) / 0.05)' }}>
            <CounterProgressMini username={entry.username} scope={scope ?? null} />
          </td>
        </tr>
      )}
      </Fragment>
    )
  }

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>#</th>
            <th style={th}>Name</th>
            <th style={th}>Tier</th>
            <th style={{ ...th, textAlign: 'right' }}>GG</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => renderRow(r, r.entry.username === meUsername))}
          {around.length > 0 && (
            <>
              {gapBeforeAround && (
                <tr aria-hidden>
                  <td colSpan={4} style={{ padding: '2px 8px', textAlign: 'center', color: 'var(--ink-3)', fontSize: '0.7rem', letterSpacing: 2 }}>
                    ⋯
                  </td>
                </tr>
              )}
              {around.map((r) => renderRow(r, r.entry.username === meUsername))}
            </>
          )}
        </tbody>
      </table>
      {canExpand && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            marginTop: 4, fontSize: '0.7rem', background: 'none', border: 'none',
            color: 'var(--ink-3)', cursor: 'pointer', padding: '2px 8px',
          }}
        >
          Show all {ranked.length}
        </button>
      )}
    </div>
  )
}

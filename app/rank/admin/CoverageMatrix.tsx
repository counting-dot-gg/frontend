'use client'

import { useMemo, useState } from 'react'
import { getPrettyTypeName, type RankChallenge } from '@/lib/challengeTypes'
import { getChallengeTitle, RANK_LABELS, type RankName } from '@/lib/rankUtils'
import {
  busiestThread,
  coverageByRank,
  emptyRanks,
  forThread,
  UNDERFUNDED_RATIO,
  underfundedRanks,
} from '@/lib/rankCoverage'
import type { ThreadOption } from './ChallengeForm'
import { Field, inputStyle, panel, th } from './ui'

const cell: React.CSSProperties = {
  padding: '5px 10px',
  fontSize: 12,
  color: '#cbd5e1',
  borderBottom: '1px solid rgb(var(--ink-rgb) / 0.05)',
  whiteSpace: 'nowrap',
}
const num: React.CSSProperties = {
  ...cell,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

export default function CoverageMatrix({ challenges, threads }: {
  challenges: RankChallenge[]
  threads: ThreadOption[]
}) {
  const [picked, setPicked] = useState<string | undefined>(undefined)
  const [expanded, setExpanded] = useState<RankName | null>(null)

  const selected = picked !== undefined ? picked : (busiestThread(challenges) ?? '')
  const threadUuid = selected === '' ? null : selected

  const rows = useMemo(
    () => coverageByRank(forThread(challenges, threadUuid)),
    [challenges, threadUuid],
  )
  const underfunded = underfundedRanks(rows)
  const empties = emptyRanks(rows)
  const total = rows.reduce((n, r) => n + r.challenges.length, 0)

  const label = threadUuid === null
    ? 'Sitewide'
    : (threads.find(t => t.uuid === threadUuid)?.name ?? 'Unknown thread')

  return (
    <section style={{ ...panel, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink-1)' }}>Design</h2>
        <Field label="Thread" style={{ minWidth: 240 }}>
          <select value={selected} onChange={e => setPicked(e.target.value)} style={inputStyle}>
            <option value="">Sitewide</option>
            {threads.map(t => (
              <option key={t.uuid} value={t.uuid}>{t.name}</option>
            ))}
          </select>
        </Field>
        <div style={{ fontSize: 12, color: '#6b7280', paddingBottom: 6 }}>
          {total} challenge{total === 1 ? '' : 's'} on {label}
        </div>
      </div>

      {(underfunded.length > 0 || empties.length > 0) && (
        <div style={{
          marginBottom: 12, padding: '8px 12px', borderRadius: 8, fontSize: 12,
          background: 'rgba(248,113,113,0.10)', color: 'var(--danger)',
          border: '1px solid rgba(248,113,113,0.25)',
        }}>
          {empties.length > 0 && (
            <div>
              No challenges at: {empties.map(r => RANK_LABELS[r.rank] ?? r.rank).join(', ')} — a
              counter cannot progress through these on this thread.
            </div>
          )}
          {underfunded.map(r => (
            <div key={r.rank}>
              {RANK_LABELS[r.rank] ?? r.rank} offers {r.ggOnePass.toLocaleString()} GG on one pass
              against a cost of {r.ggToRankUp.toLocaleString()} — under{' '}
              {Math.round(UNDERFUNDED_RATIO * 100)}%, so most of this rank is repeating one
              challenge rather than working through the ladder.
            </div>
          ))}
        </div>
      )}

      <div style={{ overflow: 'auto', maxHeight: 620, borderRadius: 10, border: '1px solid rgb(var(--ink-rgb) / 0.08)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--background)', zIndex: 1 }}>
            <tr>
              <th style={th}>Rank</th>
              <th style={{ ...th, textAlign: 'right' }}>Challenges</th>
              <th style={{ ...th, textAlign: 'right' }}>Chains</th>
              <th style={{ ...th, textAlign: 'right' }}>Deepest</th>
              <th style={{ ...th, textAlign: 'right' }}>GG / pass</th>
              <th style={{ ...th, textAlign: 'right' }}>GG to rank up</th>
              <th style={{ ...th, textAlign: 'right' }}>Covered</th>
              <th style={th}>Types</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const covered = r.ggCoverage
              const short = r.challenges.length > 0 && isFinite(r.ggToRankUp)
                && covered < UNDERFUNDED_RATIO
              const ample = r.challenges.length > 0 && isFinite(r.ggToRankUp) && covered >= 1
              const open = expanded === r.rank
              return [
                <tr
                  key={r.rank}
                  onClick={() => setExpanded(open ? null : r.rank)}
                  style={{ cursor: r.challenges.length > 0 ? 'pointer' : 'default' }}
                >
                  <td style={{ ...cell, fontWeight: 700, color: 'var(--ink-1)' }}>
                    {r.challenges.length > 0 ? (open ? '▾ ' : '▸ ') : '   '}
                    {RANK_LABELS[r.rank] ?? r.rank}
                  </td>
                  <td style={{
                    ...num,
                    color: r.challenges.length === 0 && r.rank !== 'peak' ? 'var(--danger)' : '#cbd5e1',
                  }}>
                    {r.challenges.length || '–'}
                  </td>
                  <td style={num}>{r.chains || '–'}</td>
                  <td style={num}>{r.longestChain || '–'}</td>
                  <td style={{ ...num, fontWeight: 700, color: 'var(--ink-1)' }}>
                    {r.ggOnePass.toLocaleString()}
                  </td>
                  <td style={num}>
                    {isFinite(r.ggToRankUp) ? r.ggToRankUp.toLocaleString() : '–'}
                  </td>
                  <td style={{
                    ...num, fontWeight: 700,
                    color: short ? 'var(--danger)' : ample ? 'var(--success-ink)' : '#94a3b8',
                  }}>
                    {r.challenges.length === 0 || !isFinite(r.ggToRankUp)
                      ? '–'
                      : `${Math.round(covered * 100)}%`}
                  </td>
                  <td style={{ ...cell, color: '#94a3b8', whiteSpace: 'normal' }}>
                    {r.types.map(t => getPrettyTypeName(t)).join(', ') || '–'}
                  </td>
                </tr>,
                open ? (
                  <tr key={`${r.rank}-detail`}>
                    <td colSpan={8} style={{ padding: 0, background: 'rgb(var(--ink-rgb) / 0.03)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          {r.challenges.map(c => (
                            <tr key={c.id}>
                              <td style={{ ...cell, paddingLeft: 28, width: 170, color: '#94a3b8' }}>
                                {getPrettyTypeName(c.type)}
                              </td>
                              <td style={{ ...num, width: 40 }}>{c.sequence}</td>
                              <td style={{ ...cell, color: 'var(--ink-1)' }}>
                                {getChallengeTitle(c)}
                                {c.target > 1 && ` ×${c.target}`}
                              </td>
                              <td style={{ ...num, width: 80 }}>{c.ggReward.toLocaleString()} GG</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                ) : null,
              ]
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
        Click a rank to see every challenge in it. <strong>Covered</strong> is what one clear of
        each challenge pays as a share of the rank&rsquo;s cost. Terminal steps re-assign
        themselves, so the rest arrives from repeats — a generated design sits around 80% here
        by construction, and only the red ones need attention.
        <strong> Deepest</strong> is the longest chain, in steps.
      </div>
    </section>
  )
}

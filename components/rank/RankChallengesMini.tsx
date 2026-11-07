'use client'

import { useEffect, useState } from 'react'
import { loadScope, peekScope, type Template } from '@/lib/rankCache'
import { challengeTypeOrder, getChallengeTitle, RANK_COLORS, type RankName } from '@/lib/rankUtils'
import { getPrettyTypeName } from '@/lib/challengeTypes'

const chainOf = (t: Template) => `${t.type}|${t.params?.validationType ?? ''}|${t.params?.direction ?? ''}`

export function RankChallengesMini({ rank, scope, seasonId }: {
  rank: RankName
  scope: string | null
  seasonId?: number | null
}) {
  const ofRank = (all: Template[]) => all.filter(t => t.rank === rank)
  const cached = peekScope(scope, seasonId)
  const [items, setItems] = useState<Template[] | null>(cached ? ofRank(cached) : null)
  useEffect(() => {
    let live = true
    loadScope(scope, seasonId).then(all => { if (live) setItems(ofRank(all)) })
    return () => { live = false }
  }, [rank, scope, seasonId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!items) return <div style={{ padding: '4px 8px 8px 38px', fontSize: 12, color: 'var(--ink-3)' }}>…</div>
  const chains = new Map<string, Template[]>()
  for (const t of items) {
    if (t.type === 'thread_breadth') continue
    const k = chainOf(t)
    if (!chains.has(k)) chains.set(k, [])
    chains.get(k)!.push(t)
  }
  if (chains.size === 0) return <div style={{ padding: '4px 8px 8px 38px', fontSize: 12, color: 'var(--ink-3)' }}>None yet</div>
  const ordered = [...chains.values()]
    .map(steps => steps.sort((a, b) => a.sequence - b.sequence))
    .sort((a, b) => challengeTypeOrder(a[0].type) - challengeTypeOrder(b[0].type))

  return (
    <div style={{
      margin: '2px 8px 8px 38px', padding: '6px 10px', borderRadius: 8,
      borderLeft: `3px solid ${RANK_COLORS[rank]}`, background: 'rgb(var(--ink-rgb) / 0.035)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {ordered.map(steps => (
        <div key={chainOf(steps[0])} style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {getPrettyTypeName(steps[0].type)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 6px', fontSize: 12, color: 'var(--ink-1)' }}>
            {steps.map((s, i) => (
              <span key={s.id} style={{ whiteSpace: 'nowrap' }}>
                {i > 0 && <span style={{ color: 'var(--ink-3)', marginRight: 6 }}>→</span>}
                {getChallengeTitle({ type: s.type, target: s.target, params: s.params })}
                <span style={{ color: '#f97316', fontWeight: 700, marginLeft: 4, fontVariantNumeric: 'tabular-nums' }}>+{s.ggReward}</span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

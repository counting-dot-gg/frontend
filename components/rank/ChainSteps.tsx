'use client'

import { useEffect, useState } from 'react'
import { loadScope, peekScope, type Template } from '@/lib/rankCache'
import { getChallengeTitle, type ChallengeLog } from '@/lib/rankUtils'

type Step = Template

function stepsOf(all: Template[], log: ChallengeLog): Step[] {
  const vt = log.params?.validationType ?? null
  const dir = log.params?.direction ?? null
  return all
    .filter(s => s.type === log.type && s.rank === log.rank)
    .filter(s => (s.params?.validationType ?? null) === vt && (s.params?.direction ?? null) === dir)
    .sort((a, b) => a.sequence - b.sequence)
}

export function ChainSteps({ log }: { log: ChallengeLog }) {
  const cached = peekScope(log.threadUuid, log.seasonId)
  const [steps, setSteps] = useState<Step[] | null>(cached ? stepsOf(cached, log) : null)
  useEffect(() => {
    let live = true
    loadScope(log.threadUuid, log.seasonId).then(all => { if (live) setSteps(stepsOf(all, log)) })
    return () => { live = false }
  }, [log])

  if (!steps) return <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--ink-3)' }}>…</div>
  if (steps.length === 0) return null

  const current = Math.min(log.sequencePosition, steps.length) - 1
  const repeats = log.assignmentOrdinal ?? 0

  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: '6px 4px 2px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'next'
        return (
          <li
            key={s.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6,
              background: state === 'current' ? 'rgb(var(--ink-rgb) / 0.06)' : 'transparent',
              color: state === 'next' ? 'var(--ink-3)' : 'var(--ink-1)',
              fontSize: 13, fontWeight: state === 'current' ? 700 : 500,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800,
                background: state === 'done' ? 'var(--success-ink)' : 'transparent',
                border: state === 'done' ? 'none' : `2px solid ${state === 'current' ? '#f97316' : 'rgb(var(--ink-rgb) / 0.25)'}`,
                color: 'var(--background)',
              }}
            >
              {state === 'done' ? '✓' : ''}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              {getChallengeTitle({ type: s.type, target: s.target, params: s.params })}
              {state === 'current' && repeats > 0 && (
                <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}> ↻ {repeats + 1}×</span>
              )}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: state === 'next' ? 'var(--ink-3)' : '#f97316', fontVariantNumeric: 'tabular-nums' }}>
              +{state === 'current' ? log.ggReward : s.ggReward} GG
            </span>
          </li>
        )
      })}
    </ol>
  )
}

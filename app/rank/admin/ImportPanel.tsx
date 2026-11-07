'use client'

import { useMemo, useState } from 'react'
import type { RankChallenge } from '@/lib/challengeTypes'
import { getPrettyTypeName } from '@/lib/challengeTypes'
import {
  IMPORT_FORMAT,
  parseImport,
  planImport,
  toCreateDto,
  toUpdateDto,
  type PlanAction,
  type ThreadRef,
} from '@/lib/rankAdminImport'
import { adminCreateChallengeBatch, adminUpdateChallengeBatch } from '@/lib/rankApi'
import { Banner, Button, inputStyle, mono, panel, td, th } from './ui'

const ACTION_STYLE: Record<PlanAction, { label: string; color: string }> = {
  create: { label: 'create', color: 'var(--success)' },
  update: { label: 'update', color: '#facc15' },
  unchanged: { label: 'same', color: 'rgb(var(--ink-rgb) / 0.35)' },
}

const SAMPLE = `{
  "format": "${IMPORT_FORMAT}",
  "version": 1,
  "challenges": [
    {
      "type": "thread_counts", "rank": "bronze", "sequence": 0,
      "ggReward": 90, "target": 200, "rewardType": "gg",
      "thread": "main", "baseReassignmentWaitMs": null
    }
  ]
}`

export default function ImportPanel({
  threads,
  existing,
  disabled,
  onApplied,
}: {
  threads: ThreadRef[]
  existing: RankChallenge[]
  disabled: boolean
  onApplied: () => void
}) {
  const [open, setOpen] = useState(false)
  const [raw, setRaw] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [showUnchanged, setShowUnchanged] = useState(false)

  const parsed = useMemo(() => (raw.trim() ? parseImport(raw) : null), [raw])
  const plan = useMemo(() => {
    if (!parsed || 'error' in parsed) return null
    return planImport(parsed.rows, existing, threads)
  }, [parsed, existing, threads])

  const blocked = !plan || plan.errors.length > 0
  const nothingToDo = plan != null && plan.counts.create === 0 && plan.counts.update === 0

  const handleApply = async () => {
    if (!plan || blocked) return
    setBusy(true)
    setFailure(null)
    setResult(null)
    try {
      const creates = plan.rows.filter(p => p.action === 'create' && p.errors.length === 0)
      const updates = plan.rows.filter(p => p.action === 'update' && p.errors.length === 0)

      if (creates.length > 0) {
        await adminCreateChallengeBatch(creates.map(p => toCreateDto(p.row)))
      }
      if (updates.length > 0) {
        await adminUpdateChallengeBatch(
          updates.map(p => ({ id: p.existingId as string, dto: toUpdateDto(p.row) })),
        )
      }

      setResult(
        [
          creates.length > 0 ? `${creates.length} created` : null,
          updates.length > 0 ? `${updates.length} updated` : null,
          plan.counts.unchanged > 0 ? `${plan.counts.unchanged} already matched` : null,
        ]
          .filter(Boolean)
          .join(', '),
      )
      onApplied()
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div style={{ marginBottom: 12 }}>
        <Button onClick={() => setOpen(true)}>Import from JSON…</Button>
      </div>
    )
  }

  const visibleRows = plan
    ? plan.rows.filter(p => showUnchanged || p.action !== 'unchanged' || p.errors.length > 0)
    : []

  return (
    <div style={{ ...panel, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>Import challenges from JSON</div>
        <Button onClick={() => { setOpen(false); setRaw(''); setResult(null); setFailure(null) }}>Close</Button>
      </div>

      <p style={{ margin: '0 0 10px', fontSize: 12, color: 'rgb(var(--ink-rgb) / 0.55)', lineHeight: 1.55 }}>
        Paste the output of <code style={mono}>ranksim export</code>, or a bare array of challenges.
        Rows are matched to what already exists by type, rank, sequence and thread — matches are
        updated in place, so re-importing a re-tuned design will not duplicate anything.
        Nothing is ever deleted.
      </p>

      <textarea
        value={raw}
        onChange={e => { setRaw(e.target.value); setResult(null); setFailure(null) }}
        placeholder={SAMPLE}
        spellCheck={false}
        rows={10}
        style={{ ...inputStyle, ...mono, fontSize: 11.5, resize: 'vertical', lineHeight: 1.5 }}
      />

      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        {parsed && 'error' in parsed && <Banner kind="error">{parsed.error}</Banner>}

        {parsed && !('error' in parsed) && parsed.notes.length > 0 && (
          <div style={{ fontSize: 11.5, color: 'rgb(var(--ink-rgb) / 0.45)', ...mono }}>
            {parsed.notes.map((n, i) => <div key={i}>— {n}</div>)}
          </div>
        )}

        {plan?.errors.map((e, i) => <Banner key={i} kind="error">{e}</Banner>)}
        {plan?.warnings.map((w, i) => <Banner key={i} kind="warn">{w}</Banner>)}

        {plan && plan.orphans.length > 0 && (
          <Banner kind="warn">
            {plan.orphans.length} existing challenge{plan.orphans.length === 1 ? '' : 's'} in this
            season {plan.orphans.length === 1 ? 'is' : 'are'} not in this blob and will be left
            untouched: {plan.orphans.slice(0, 6).map(c => `${c.type}/${c.rank}/${c.sequence}`).join(', ')}
            {plan.orphans.length > 6 ? `, +${plan.orphans.length - 6} more` : ''}. Delete them
            individually below if they should not be there.
          </Banner>
        )}

        {failure && <Banner kind="error">{failure}</Banner>}
        {result && <Banner kind="success">{result}</Banner>}
      </div>

      {plan && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', margin: '14px 0 8px' }}>
            <span style={{ fontSize: 12, color: '#cbd5e1' }}>
              <strong style={{ color: 'var(--success)' }}>{plan.counts.create}</strong> to create,{' '}
              <strong style={{ color: '#facc15' }}>{plan.counts.update}</strong> to update,{' '}
              <strong style={{ color: 'rgb(var(--ink-rgb) / 0.45)' }}>{plan.counts.unchanged}</strong> unchanged
            </span>
            {plan.counts.unchanged > 0 && (
              <label style={{ fontSize: 11.5, color: 'rgb(var(--ink-rgb) / 0.5)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <input type="checkbox" checked={showUnchanged} onChange={e => setShowUnchanged(e.target.checked)} />
                show unchanged
              </label>
            )}
          </div>

          <div style={{ overflowX: 'auto', maxHeight: 380, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Action</th>
                  <th style={th}>Type</th>
                  <th style={th}>Rank</th>
                  <th style={th}>Seq</th>
                  <th style={th}>Thread</th>
                  <th style={th}>Target</th>
                  <th style={th}>GG</th>
                  <th style={th}>Params</th>
                  <th style={th}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((p, i) => {
                  const a = ACTION_STYLE[p.action]
                  const bad = p.errors.length > 0
                  return (
                    <tr key={i}>
                      <td style={{ ...td, ...mono, color: bad ? 'var(--danger)' : a.color, fontWeight: 700 }}>
                        {bad ? 'error' : a.label}
                      </td>
                      <td style={{ ...td, ...mono }}>{getPrettyTypeName(p.row.type)}</td>
                      <td style={{ ...td, ...mono }}>{p.row.rank}</td>
                      <td style={{ ...td, ...mono }}>{p.row.sequence}</td>
                      <td style={{ ...td, ...mono }}>
                        {p.row.threadName ?? (p.row.threadUuid ? `${p.row.threadUuid.slice(0, 8)}…` : 'sitewide')}
                      </td>
                      <td style={{ ...td, ...mono }}>{p.row.target}</td>
                      <td style={{ ...td, ...mono }}>{p.row.ggReward}</td>
                      <td style={{ ...td, ...mono, color: 'rgb(var(--ink-rgb) / 0.5)' }}>
                        {p.row.params ? JSON.stringify(p.row.params) : '-'}
                      </td>
                      <td style={{ ...td, fontSize: 11.5 }}>
                        {bad ? (
                          <span style={{ color: 'var(--danger)' }}>{p.errors.join('; ')}</span>
                        ) : (
                          <span style={{ color: '#facc15' }}>{p.changes.join('; ')}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              kind="primary"
              onClick={handleApply}
              disabled={busy || blocked || nothingToDo || disabled}
            >
              {busy ? 'Applying…' : `Apply ${plan.counts.create + plan.counts.update} change${plan.counts.create + plan.counts.update === 1 ? '' : 's'}`}
            </Button>
            {disabled && (
              <span style={{ fontSize: 11.5, color: '#facc15' }}>
                Switch to the active season to apply.
              </span>
            )}
            {!disabled && nothingToDo && !blocked && (
              <span style={{ fontSize: 11.5, color: 'rgb(var(--ink-rgb) / 0.5)' }}>
                Everything in this blob already matches what is live.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

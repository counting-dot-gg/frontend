'use client'

import { useEffect, useState } from 'react'
import ThresholdLeaderboard from '@/components/rank/ThresholdLeaderboard'
import { getRankChallenges } from '@/lib/rankApi'
import {
  CHALLENGE_TYPES,
  RANK_OPTIONS,
  SITEWIDE_ONLY_TYPES,
  THREAD_REQUIRED_TYPES,
  getPrettyTypeName,
  type RankChallenge,
} from '@/lib/challengeTypes'
import {
  DEFAULT_WAIT_HOURS_BY_TYPE,
  PARAM_FIELD_SCHEMAS,
  chainKey,
  defaultBulkRows,
  reconcileBulkRows,
  sequenceIssues,
  type BulkTierRow,
  type ChallengeFormState,
} from '@/lib/rankAdmin'
import { getChallengeTitle } from '@/lib/rankUtils'
import type { RankName } from '@/lib/rankUtils'
import { Banner, Button, Field, inputStyle, labelStyle, mono, panel, td, th } from './ui'

export type ThreadOption = { uuid: string; name: string; title: string }

interface Props {
  form: ChallengeFormState
  setForm: (f: ChallengeFormState) => void
  error: string | null
  success?: string | null
  onSubmit: () => void
  onCancel: () => void
  onEnableBulk?: () => void
  submitLabel: string
  threads?: ThreadOption[]
  editingId?: string | null
  isEdit?: boolean
  bulkRows?: BulkTierRow[] | null
  setBulkRows?: (rows: BulkTierRow[]) => void
}

export default function ChallengeForm({
  form, setForm, error, success, onSubmit, onCancel, onEnableBulk,
  submitLabel, threads = [], editingId = null, isEdit = false,
  bulkRows = null, setBulkRows,
}: Props) {
  const threadDisabled = SITEWIDE_ONLY_TYPES.has(form.type)
  const threadRequired = THREAD_REQUIRED_TYPES.has(form.type)
  const selectedThread = threads.find(t => t.uuid === form.threadUuid) ?? null

  let formParams: RankChallenge['params'] = null
  try {
    formParams = form.params.trim() ? JSON.parse(form.params) : null
  } catch {
    formParams = null
  }

  const formChainKey = form.type
    ? chainKey({ type: form.type, threadUuid: form.threadUuid || null, params: formParams })
    : null

  const [comboCandidates, setComboCandidates] = useState<RankChallenge[]>([])
  useEffect(() => {
    if (!form.type || !form.rank) { setComboCandidates([]); return }
    let cancelled = false
    getRankChallenges({
      type: form.type,
      rank: form.rank,
      threadUuid: !threadDisabled && form.threadUuid ? form.threadUuid : undefined,
      limit: 200,
    })
      .then(data => { if (!cancelled) setComboCandidates(data.items) })
      .catch(() => { if (!cancelled) setComboCandidates([]) })
    return () => { cancelled = true }
  }, [form.type, form.rank, form.threadUuid, threadDisabled])

  const bulkEnabled = bulkRows != null
  useEffect(() => {
    if (!bulkEnabled || !setBulkRows || !form.type) return
    let cancelled = false
    getRankChallenges({
      type: form.type,
      threadUuid: !threadDisabled && form.threadUuid ? form.threadUuid : undefined,
      limit: 200,
    })
      .then(data => {
        if (cancelled) return
        const scoped = data.items.filter(c => (c.threadUuid || '') === (form.threadUuid || ''))
        setBulkRows(reconcileBulkRows(scoped, form.params))
      })
      .catch(() => { if (!cancelled) setBulkRows(defaultBulkRows(form.params)) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type, form.threadUuid, threadDisabled, bulkEnabled])

  const sameComboSorted = (formChainKey
    ? comboCandidates.filter(c =>
        c.type === form.type && c.rank === form.rank && chainKey(c) === formChainKey && c.id !== editingId)
    : []
  ).slice().sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))

  const issues = sequenceIssues(sameComboSorted)

  const maxMs = typeof formParams?.maxMs === 'number' ? formParams.maxMs : null
  const speedRateLabel =
    maxMs && maxMs > 0 && (form.type === 'split_under_ms' || form.type === 'get_under_ms' || form.type === 'bars_within_ms')
      ? `≈ ${(1000 / maxMs).toFixed(2)} counts/sec${form.type === 'bars_within_ms' ? ' per bar' : ''}`
      : null

  const fieldSchema = PARAM_FIELD_SCHEMAS[form.type] ?? []
  const schemaKeys = new Set(fieldSchema.map(f => f.key))
  const extraParams = formParams
    ? Object.fromEntries(Object.entries(formParams).filter(([k]) => !schemaKeys.has(k)))
    : {}
  const overrideParamsText = Object.keys(extraParams).length > 0 ? JSON.stringify(extraParams, null, 2) : ''

  const setParamField = (key: string, value: unknown) =>
    setForm({ ...form, params: JSON.stringify({ ...formParams, [key]: value }, null, 2) })

  const setOverrideParams = (raw: string) => {
    let extra: Record<string, unknown>
    try {
      extra = raw.trim() ? JSON.parse(raw) : {}
    } catch {
      return
    }
    const known: Record<string, unknown> = {}
    for (const field of fieldSchema) {
      if (formParams && field.key in formParams) known[field.key] = formParams[field.key]
    }
    setForm({ ...form, params: JSON.stringify({ ...known, ...extra }, null, 2) })
  }

  const onTypeChange = (type: string) => {
    setForm({
      ...form,
      type,
      threadUuid: SITEWIDE_ONLY_TYPES.has(type) ? '' : form.threadUuid,
      baseReassignmentWaitHours: DEFAULT_WAIT_HOURS_BY_TYPE[type] ?? '',
    })
  }

  const updateRow = (index: number, patch: Partial<BulkTierRow>) => {
    if (!bulkRows || !setBulkRows) return
    setBulkRows(bulkRows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
      {error && <Banner kind="error">{error}</Banner>}
      {success && <Banner kind="success">{success}</Banner>}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Field label="Type" style={{ flex: '1 1 200px' }}>
          <select
            value={form.type}
            disabled={isEdit}
            onChange={e => onTypeChange(e.target.value)}
            style={{ ...inputStyle, opacity: isEdit ? 0.6 : 1 }}
          >
            <option value="">Select a type…</option>
            {CHALLENGE_TYPES.map(t => (
              <option key={t} value={t}>{getPrettyTypeName(t)}</option>
            ))}
          </select>
        </Field>

        <Field label={`Thread${threadRequired ? ' (required)' : threadDisabled ? ' (sitewide only)' : ' (optional)'}`} style={{ flex: '1 1 240px' }}>
          <select
            value={form.threadUuid}
            disabled={threadDisabled}
            onChange={e => setForm({ ...form, threadUuid: e.target.value })}
            style={{ ...inputStyle, opacity: threadDisabled ? 0.5 : 1 }}
          >
            <option value="">{threadRequired ? 'Select a thread…' : 'Sitewide'}</option>
            {threads.map(t => (
              <option key={t.uuid} value={t.uuid}>{t.name}</option>
            ))}
          </select>
        </Field>
      </div>

      {threadRequired && !form.threadUuid && (
        <Banner kind="warn">This challenge type is only meaningful inside a specific thread: pick one.</Banner>
      )}

      {bulkRows ? (
        <BulkTierEditor
          rows={bulkRows}
          fieldSchema={fieldSchema}
          onChange={updateRow}
          onRemove={i => setBulkRows?.(bulkRows.filter((_, idx) => idx !== i))}
        />
      ) : (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Field label="Rank" style={{ flex: '1 1 130px' }}>
            <select
              value={form.rank}
              onChange={e => setForm({ ...form, rank: e.target.value as RankName | '' })}
              style={inputStyle}
            >
              <option value="">Select…</option>
              {RANK_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Sequence" style={{ flex: '0 1 110px' }}>
            <input
              type="number" value={form.sequence} style={inputStyle}
              onChange={e => setForm({ ...form, sequence: Number(e.target.value) })}
            />
          </Field>
          <Field label="Target" style={{ flex: '0 1 130px' }}>
            <input
              type="number" value={form.target} style={inputStyle}
              onChange={e => setForm({ ...form, target: Number(e.target.value) })}
            />
          </Field>
          <Field label="GG Reward" style={{ flex: '0 1 130px' }}>
            <input
              type="number" value={form.ggReward} style={inputStyle}
              onChange={e => setForm({ ...form, ggReward: Number(e.target.value) })}
            />
          </Field>
          <Field label="Reward Type" style={{ flex: '0 1 150px' }}>
            <select
              value={form.rewardType} style={inputStyle}
              onChange={e => setForm({ ...form, rewardType: e.target.value as 'gg' | 'auto_jump' })}
            >
              <option value="gg">gg</option>
              <option value="auto_jump">auto_jump</option>
            </select>
          </Field>
          <Field label="Reassign wait (hours)" style={{ flex: '0 1 180px' }}>
            <input
              type="number" value={form.baseReassignmentWaitHours} placeholder="none" style={inputStyle}
              onChange={e => setForm({ ...form, baseReassignmentWaitHours: e.target.value })}
            />
          </Field>
        </div>
      )}

      {fieldSchema.length > 0 && !bulkRows && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {fieldSchema.map(field => {
            const value = formParams?.[field.key] ?? field.defaultValue
            return (
              <Field key={field.key} label={field.label} style={{ flex: '1 1 180px' }}>
                {field.kind === 'select' ? (
                  <select
                    value={String(value)} style={inputStyle}
                    onChange={e => setParamField(field.key, e.target.value)}
                  >
                    {(field.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={field.kind === 'number' ? 'number' : 'text'}
                    value={String(value)}
                    style={inputStyle}
                    onChange={e => setParamField(
                      field.key,
                      field.kind === 'number' ? Number(e.target.value) : e.target.value,
                    )}
                  />
                )}
              </Field>
            )
          })}
        </div>
      )}

      {speedRateLabel && (
        <div style={{ fontSize: 12, color: '#7cc4ff', fontWeight: 600 }}>{speedRateLabel}</div>
      )}

      {!bulkRows && (
        <div>
          <span style={labelStyle}>Extra params (JSON, merged over the fields above)</span>
          <textarea
            defaultValue={overrideParamsText}
            key={`${form.type}-${overrideParamsText}`}
            onChange={e => setOverrideParams(e.target.value)}
            rows={3}
            spellCheck={false}
            placeholder="{}"
            style={{ ...inputStyle, ...mono, resize: 'vertical' }}
          />
        </div>
      )}

      {form.type && form.rank && (
        <div style={panel}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 6 }}>
            Existing {form.rank} challenges in this chain ({sameComboSorted.length})
          </div>
          {issues.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <Banner kind="warn">
                {issues.join(' · ')} - chain advance looks for the next sequence exactly, so a gap stops progression.
              </Banner>
            </div>
          )}
          {sameComboSorted.length === 0 ? (
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              None yet: this would be the first, so it should be sequence 0.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr><th style={th}>Seq</th><th style={th}>Title</th><th style={th}>Target</th><th style={th}>GG</th></tr>
                </thead>
                <tbody>
                  {sameComboSorted.map(c => (
                    <tr key={c.id}>
                      <td style={{ ...td, ...mono }}>{c.sequence}</td>
                      <td style={td}>{getChallengeTitle(c)}</td>
                      <td style={{ ...td, ...mono }}>{c.target}</td>
                      <td style={{ ...td, ...mono }}>{c.ggReward}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedThread?.name && ['split_under_ms', 'get_under_ms', 'thread_counts'].includes(form.type) && (
        <div style={panel}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
            Threshold context: click a row to use that value.
          </div>
          <ThresholdLeaderboard
            kind={form.type === 'thread_counts' ? 'daily_counts' : (form.type as 'split_under_ms' | 'get_under_ms')}
            threadName={selectedThread.name}
            onPickThreshold={value => {
              if (form.type === 'thread_counts') {
                setForm({ ...form, target: value })
                return
              }
              setForm({ ...form, params: JSON.stringify({ ...(formParams ?? {}), maxMs: value }, null, 2) })
            }}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button kind="primary" onClick={onSubmit}>{submitLabel}</Button>
        {onEnableBulk && !bulkRows && !isEdit && (
          <Button onClick={onEnableBulk} disabled={!form.type}>Bulk tiers…</Button>
        )}
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function BulkTierEditor({ rows, fieldSchema, onChange, onRemove }: {
  rows: BulkTierRow[]
  fieldSchema: { key: string; label: string; kind: string; options?: string[]; defaultValue: unknown }[]
  onChange: (index: number, patch: Partial<BulkTierRow>) => void
  onRemove: (index: number) => void
}) {
  const parse = (raw: string): Record<string, unknown> => {
    try { return raw.trim() ? JSON.parse(raw) : {} } catch { return {} }
  }

  return (
    <div style={{ ...panel, padding: 12 }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
        Rows marked <strong style={{ color: 'var(--success-ink)' }}>existing</strong> update in place; the rest are created.
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Rank</th>
              <th style={th}>Seq</th>
              <th style={th}>Target</th>
              <th style={th}>GG</th>
              {fieldSchema.map(f => <th key={f.key} style={th}>{f.label}</th>)}
              <th style={th}>State</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const params = parse(row.params)
              return (
                <tr key={`${row.rank}-${row.sequence}-${i}`}>
                  <td style={{ ...td, ...mono }}>{row.rank || '-'}</td>
                  <td style={{ ...td, ...mono }}>{row.sequence}</td>
                  <td style={td}>
                    <input
                      type="number" value={row.target} style={{ ...inputStyle, width: 90 }}
                      onChange={e => onChange(i, { target: Number(e.target.value) })}
                    />
                  </td>
                  <td style={td}>
                    <input
                      type="number" value={row.ggReward} style={{ ...inputStyle, width: 80 }}
                      onChange={e => onChange(i, { ggReward: Number(e.target.value) })}
                    />
                  </td>
                  {fieldSchema.map(f => (
                    <td key={f.key} style={td}>
                      {f.kind === 'select' ? (
                        <select
                          value={String(params[f.key] ?? f.defaultValue)}
                          style={{ ...inputStyle, width: 110 }}
                          onChange={e => onChange(i, {
                            params: JSON.stringify({ ...params, [f.key]: e.target.value }, null, 2),
                          })}
                        >
                          {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          type={f.kind === 'number' ? 'number' : 'text'}
                          value={String(params[f.key] ?? f.defaultValue)}
                          style={{ ...inputStyle, width: 110 }}
                          onChange={e => onChange(i, {
                            params: JSON.stringify({
                              ...params,
                              [f.key]: f.kind === 'number' ? Number(e.target.value) : e.target.value,
                            }, null, 2),
                          })}
                        />
                      )}
                    </td>
                  ))}
                  <td style={{ ...td, ...mono, color: row.existingId ? 'var(--success-ink)' : 'var(--ink-3)' }}>
                    {row.existingId ? 'existing' : 'new'}
                  </td>
                  <td style={td}>
                    <Button kind="danger" onClick={() => onRemove(i)}>Remove</Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

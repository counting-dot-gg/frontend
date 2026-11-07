'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import {
  adminCreateChallenge,
  adminCreateChallengeBatch,
  adminDeleteChallenge,
  adminEndSeason,
  adminStartSeason,
  adminUpdateChallenge,
  adminUpdateChallengeBatch,
  getRankChallenges,
  getRankSeasons,
} from '@/lib/rankApi'
import { getPrettyTypeName, type RankChallenge, type RankSeason } from '@/lib/challengeTypes'
import {
  buildCreateDto,
  buildUpdateDto,
  challengeToForm,
  defaultBulkRows,
  dtoError,
  emptyForm,
  parseParams,
  type BulkTierRow,
  type ChallengeFormState,
} from '@/lib/rankAdmin'
import { getChallengeTitle } from '@/lib/rankUtils'
import ChallengeForm, { type ThreadOption } from './ChallengeForm'
import ImportPanel from './ImportPanel'
import CoverageMatrix from './CoverageMatrix'
import { Banner, Button, Field, inputStyle, mono, panel, td, th } from './ui'

const CHALLENGE_PAGE_LIMIT = 5000

export default function RankAdminClient({ threads }: { threads: ThreadOption[] }) {
  const [seasons, setSeasons] = useState<RankSeason[]>([])
  const [seasonError, setSeasonError] = useState<string | null>(null)
  const [showStartForm, setShowStartForm] = useState(false)
  const [newSeasonName, setNewSeasonName] = useState('')

  const [challenges, setChallenges] = useState<RankChallenge[]>([])
  const [challengeError, setChallengeError] = useState<string | null>(null)
  const [viewSeasonId, setViewSeasonId] = useState<number | null>(null)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState<ChallengeFormState>(emptyForm())
  const [createFormError, setCreateFormError] = useState<string | null>(null)
  const [createFormSuccess, setCreateFormSuccess] = useState<string | null>(null)
  const [bulkRows, setBulkRows] = useState<BulkTierRow[] | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ChallengeFormState>(emptyForm())
  const [editFormError, setEditFormError] = useState<string | null>(null)

  const fetchSeasons = useCallback(() => {
    getRankSeasons()
      .then(setSeasons)
      .catch(() => setSeasonError('Failed to load seasons'))
  }, [])

  const fetchChallenges = useCallback((seasonId?: number) => {
    const all: RankChallenge[] = []
    const page = (offset: number): Promise<void> =>
      getRankChallenges({ limit: CHALLENGE_PAGE_LIMIT, offset, seasonId }).then(data => {
        all.push(...data.items)
        if (data.items.length > 0 && all.length < data.total) return page(all.length)
      })
    page(0)
      .then(() => { setChallenges(all); setChallengeError(null) })
      .catch(() => setChallengeError('Failed to load challenges'))
  }, [])

  useEffect(() => { fetchSeasons() }, [fetchSeasons])

  useEffect(() => {
    if (seasons.length === 0 || viewSeasonId != null) return
    const active = seasons.find(s => s.endedAt == null)
    if (active) setViewSeasonId(active.id)
  }, [seasons, viewSeasonId])

  useEffect(() => {
    if (viewSeasonId == null) return
    fetchChallenges(viewSeasonId)
  }, [viewSeasonId, fetchChallenges])

  const activeSeason = seasons.find(s => s.endedAt == null)
  const isViewingActiveSeason = activeSeason != null && viewSeasonId === activeSeason.id

  const handleStartSeason = async () => {
    if (!newSeasonName.trim()) return
    try {
      await adminStartSeason(newSeasonName.trim())
      setNewSeasonName('')
      setShowStartForm(false)
      setSeasonError(null)
      fetchSeasons()
    } catch (err) {
      setSeasonError(err instanceof Error ? err.message : 'Failed to start season')
    }
  }

  const handleEndSeason = async () => {
    if (!window.confirm('End the current active season?')) return
    try {
      await adminEndSeason()
      setSeasonError(null)
      fetchSeasons()
    } catch (err) {
      setSeasonError(err instanceof Error ? err.message : 'Failed to end season')
    }
  }

  const handleCreateBulk = async (rows: BulkTierRow[]) => {
    if (rows.length === 0 || rows.some(r => !r.rank)) {
      setCreateFormError('Every tier row needs a rank selected')
      return
    }

    const rowParams = new Map<number, object | undefined>()
    for (let i = 0; i < rows.length; i++) {
      const parsed = parseParams(rows[i].params)
      if (parsed === null) {
        setCreateFormError(`Invalid JSON in params for ${rows[i].rank} seq ${rows[i].sequence}`)
        return
      }
      rowParams.set(i, parsed)
    }

    const toCreate = rows.map((row, i) => ({ row, i })).filter(({ row }) => !row.existingId)
    const toUpdate = rows.map((row, i) => ({ row, i })).filter(({ row }) => row.existingId)

    const createDtos = toCreate.map(({ row, i }) => ({
      type: createForm.type,
      rank: row.rank,
      sequence: row.sequence,
      target: row.target,
      ggReward: row.ggReward,
      threadUuid: createForm.threadUuid || undefined,
      params: rowParams.get(i),
    }))

    try {
      const updateBatch = toUpdate.map(({ row, i }) => ({
        id: row.existingId as string,
        dto: {
          rank: row.rank,
          sequence: row.sequence,
          target: row.target,
          ggReward: row.ggReward,
          threadUuid: createForm.threadUuid || undefined,
          params: rowParams.get(i),
        },
      }))
      await Promise.all([
        createDtos.length > 0 ? adminCreateChallengeBatch(createDtos) : Promise.resolve(),
        updateBatch.length > 0 ? adminUpdateChallengeBatch(updateBatch) : Promise.resolve(),
      ])
      setCreateFormError(null)
      setCreateFormSuccess([
        createDtos.length > 0 ? `${createDtos.length} created` : null,
        toUpdate.length > 0 ? `${toUpdate.length} updated` : null,
      ].filter(Boolean).join(', ') + '!')
      fetchChallenges(viewSeasonId ?? undefined)
    } catch (err) {
      setCreateFormSuccess(null)
      setCreateFormError(err instanceof Error ? err.message : 'Failed to save challenges')
    }
  }

  const handleCreate = async () => {
    if (bulkRows) { await handleCreateBulk(bulkRows); return }

    const dto = buildCreateDto(createForm)
    if (dto === null) { setCreateFormError(dtoError(createForm)); return }
    try {
      await adminCreateChallenge(dto)
      setCreateFormError(null)
      setCreateFormSuccess('Challenge created!')
      setCreateForm(prev => ({ ...prev, sequence: prev.sequence + 1 }))
      fetchChallenges(viewSeasonId ?? undefined)
    } catch (err) {
      setCreateFormSuccess(null)
      setCreateFormError(err instanceof Error ? err.message : 'Failed to create challenge')
    }
  }

  const handleEditSave = async () => {
    if (!editingId) return
    const dto = buildUpdateDto(editForm)
    if (dto === null) { setEditFormError(dtoError(editForm)); return }
    try {
      await adminUpdateChallenge(editingId, dto)
      setEditingId(null)
      setEditFormError(null)
      fetchChallenges(viewSeasonId ?? undefined)
    } catch (err) {
      setEditFormError(err instanceof Error ? err.message : 'Failed to update challenge')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this challenge?')) return
    try {
      await adminDeleteChallenge(id)
      fetchChallenges(viewSeasonId ?? undefined)
    } catch (err) {
      setChallengeError(err instanceof Error ? err.message : 'Failed to delete challenge')
    }
  }

  const visibleChallenges = challenges.filter(c => {
    if (!showCreateForm) return true
    if (createForm.type && c.type !== createForm.type) return false
    if (createForm.rank && c.rank !== createForm.rank) return false
    if (createForm.threadUuid && c.threadUuid !== createForm.threadUuid) return false
    return true
  })

  const threadLabel = (uuid: string | null) =>
    uuid ? (threads.find(t => t.uuid === uuid)?.name ?? `${uuid.slice(0, 8)}…`) : '-'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-0)', padding: '24px 16px 64px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 20px', fontSize: 28, fontWeight: 800, color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>
          Rank Admin
        </h1>

        <section style={{ ...panel, marginBottom: 18 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--ink-1)' }}>Season management</h2>
          {seasonError && <div style={{ marginBottom: 10 }}><Banner kind="error">{seasonError}</Banner></div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            {activeSeason ? (
              <>
                <span style={{ fontSize: 13, color: '#cbd5e1' }}>
                  Active: <strong style={{ color: 'var(--success-ink)' }}>{activeSeason.name}</strong>
                </span>
                <Button kind="danger" onClick={handleEndSeason}>End season</Button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 13, color: '#facc15' }}>No active season.</span>
                {!showStartForm && <Button kind="primary" onClick={() => setShowStartForm(true)}>Start a season</Button>}
              </>
            )}
          </div>

          {showStartForm && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
              <Field label="Season name" style={{ flex: '1 1 240px' }}>
                <input
                  value={newSeasonName}
                  onChange={e => setNewSeasonName(e.target.value)}
                  placeholder="Season 3"
                  style={inputStyle}
                />
              </Field>
              <Button kind="primary" onClick={handleStartSeason} disabled={!newSeasonName.trim()}>Start</Button>
              <Button onClick={() => { setShowStartForm(false); setNewSeasonName('') }}>Cancel</Button>
            </div>
          )}

          <Field label="Viewing season" style={{ maxWidth: 320 }}>
            <select
              value={viewSeasonId ?? ''}
              onChange={e => setViewSeasonId(e.target.value === '' ? null : Number(e.target.value))}
              style={inputStyle}
            >
              <option value="">Select a season…</option>
              {seasons.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.endedAt == null ? ' (active)' : ''}
                </option>
              ))}
            </select>
          </Field>

          {!isViewingActiveSeason && viewSeasonId != null && (
            <div style={{ marginTop: 10 }}>
              <Banner kind="warn">
                Viewing a past season: its challenges are read-only. Switch to the active season to edit.
              </Banner>
            </div>
          )}
        </section>

        <CoverageMatrix challenges={challenges} threads={threads} />

        <section style={panel}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink-1)' }}>
              Challenges <span style={{ ...mono, color: '#6b7280', fontWeight: 400 }}>({challenges.length})</span>
            </h2>
            {isViewingActiveSeason && !showCreateForm && (
              <Button kind="primary" onClick={() => {
                setShowCreateForm(true)
                setCreateForm(emptyForm())
                setCreateFormError(null)
                setCreateFormSuccess(null)
                setBulkRows(null)
              }}>
                New challenge
              </Button>
            )}
          </div>

          {challengeError && <div style={{ marginBottom: 10 }}><Banner kind="error">{challengeError}</Banner></div>}

          <ImportPanel
            threads={threads}
            existing={challenges}
            disabled={!isViewingActiveSeason}
            onApplied={() => fetchChallenges(viewSeasonId ?? undefined)}
          />

          {showCreateForm && (
            <div style={{ ...panel, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>
                {bulkRows ? 'Create tiers in bulk' : 'Create challenge'}
              </div>
              <ChallengeForm
                form={createForm}
                setForm={setCreateForm}
                error={createFormError}
                success={createFormSuccess}
                onSubmit={handleCreate}
                onCancel={() => { setShowCreateForm(false); setBulkRows(null); setCreateFormError(null); setCreateFormSuccess(null) }}
                onEnableBulk={() => { setCreateFormSuccess(null); setBulkRows(defaultBulkRows(createForm.params)) }}
                submitLabel={bulkRows
                  ? `Save ${bulkRows.length} tiers (${bulkRows.filter(r => r.existingId).length} update, ${bulkRows.filter(r => !r.existingId).length} new)`
                  : 'Create'}
                threads={threads}
                bulkRows={bulkRows}
                setBulkRows={setBulkRows}
              />
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Title</th>
                  <th style={th}>Type</th>
                  <th style={th}>Rank</th>
                  <th style={th}>Seq</th>
                  <th style={th}>Target</th>
                  <th style={th}>GG</th>
                  <th style={th}>Thread</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleChallenges.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ ...td, color: '#6b7280' }}>
                      {challenges.length === 0 ? 'No challenges yet.' : 'No challenges match the open form’s filters.'}
                    </td>
                  </tr>
                ) : visibleChallenges.map(c => (
                  <Fragment key={c.id}>
                    <tr>
                      <td style={td}>{getChallengeTitle(c)}</td>
                      <td style={{ ...td, ...mono }}>{getPrettyTypeName(c.type)}</td>
                      <td style={{ ...td, ...mono }}>{c.rank}</td>
                      <td style={{ ...td, ...mono }}>{c.sequence}</td>
                      <td style={{ ...td, ...mono }}>{c.target}</td>
                      <td style={{ ...td, ...mono }}>{c.ggReward}</td>
                      <td style={{ ...td, ...mono }}>{threadLabel(c.threadUuid)}</td>
                      <td style={td}>
                        {isViewingActiveSeason ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Button onClick={() => {
                              setEditingId(c.id)
                              setEditForm(challengeToForm(c))
                              setEditFormError(null)
                            }}>
                              Edit
                            </Button>
                            <Button kind="danger" onClick={() => handleDelete(c.id)}>Delete</Button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: '#6b7280' }}>read-only</span>
                        )}
                      </td>
                    </tr>
                    {editingId === c.id && (
                      <tr>
                        <td colSpan={8} style={{ padding: 0 }}>
                          <div style={{ ...panel, margin: '4px 0 12px' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>Edit challenge</div>
                            <ChallengeForm
                              form={editForm}
                              setForm={setEditForm}
                              error={editFormError}
                              onSubmit={handleEditSave}
                              onCancel={() => { setEditingId(null); setEditFormError(null) }}
                              submitLabel="Save"
                              threads={threads}
                              editingId={editingId}
                              isEdit
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

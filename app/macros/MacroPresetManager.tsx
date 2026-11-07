'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  type MacroEntryDraft, type MacroEntryType, type MacroPreset, type MacroPresetVersion,
  ACTION_LABEL, ACTION_OPTIONS, COMBO_LABEL, COMBO_OPTIONS, HANDLE_REGEX,
  MACRO_TYPE_LABEL, MACRO_TYPE_OPTIONS, MAX_REPEAT,
  defaultEntryByType, isPadOnlyTrigger, nextPadOnlyTrigger, normalizeMacroTriggerKey, triggerLabel, validateEntries,
} from '@/lib/macroUtils'

import { API } from '@/lib/apiBase'
import type { PadLayout } from '@/lib/padLayout'
import PadLayoutEditor, { padLayoutProblems } from './PadLayoutEditor'

type Props = {
  forcedMode: 'create' | 'edit'
  initialSelectedPresetId?: number | null
  hidePresetSelector?: boolean
  draftSeed?: { token: number; name: string; handle?: string; description: string; entries: MacroEntryDraft[] } | null
  onCreated?: () => void
  onSaved?: () => void
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message || `${res.status}`)
  }
  return res.json()
}

const inp: React.CSSProperties = {
  background: 'rgb(var(--ink-rgb) / 0.07)', border: '1px solid rgb(var(--ink-rgb) / 0.2)',
  borderRadius: 6, color: 'var(--ink-1)', fontSize: '0.85rem', padding: '7px 10px', width: '100%',
}

const selStyle: React.CSSProperties = { ...inp, cursor: 'pointer' }

function toDraftEntries(version: MacroPresetVersion | null): MacroEntryDraft[] {
  if (!version?.entries?.length) return []
  return version.entries.map(e => ({ triggerKey: e.triggerKey, macroType: e.macroType, payloadJson: e.payloadJson as any }))
}

export default function MacroPresetManager({ forcedMode, initialSelectedPresetId, hidePresetSelector, draftSeed, onCreated, onSaved }: Props) {
  const [mode] = useState<'create' | 'edit'>(forcedMode)
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null)
  const [versions, setVersions] = useState<MacroPresetVersion[]>([])
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null)
  const [activeVersionNumber, setActiveVersionNumber] = useState<number | null>(null)
  const [ownedPresets, setOwnedPresets] = useState<MacroPreset[]>([])
  const [ownedSearch, setOwnedSearch] = useState('')
  const [debouncedOwnedSearch, setDebouncedOwnedSearch] = useState('')
  const [loadingOwnedPresets, setLoadingOwnedPresets] = useState(false)
  const [loadingVersion, setLoadingVersion] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [newName, setNewName] = useState('')
  const [newHandle, setNewHandle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [entries, setEntries] = useState<MacroEntryDraft[]>([])
  const [keyboardLayout, setKeyboardLayout] = useState<PadLayout | null>(null)

  const selectedPreset = ownedPresets.find(p => p.id === selectedPresetId) ?? null
  const validation = useMemo(() => validateEntries(entries), [entries])
  const layoutProblems = useMemo(() => padLayoutProblems(keyboardLayout, entries), [keyboardLayout, entries])
  const seqRef = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedOwnedSearch(ownedSearch.trim()), 250)
    return () => clearTimeout(t)
  }, [ownedSearch])

  useEffect(() => {
    if (mode !== 'edit' || hidePresetSelector) return
    let cancelled = false
    setLoadingOwnedPresets(true)
    const q = new URLSearchParams({ page: '1', limit: '100', mine: '1' })
    if (debouncedOwnedSearch) q.set('search', debouncedOwnedSearch)
    apiFetch<{ total: number; items: MacroPreset[] }>(`${API}/api/macro-presets?${q}`)
      .then(data => { if (!cancelled) setOwnedPresets(data.items ?? []) })
      .catch(() => { if (!cancelled) setOwnedPresets([]) })
      .finally(() => { if (!cancelled) setLoadingOwnedPresets(false) })
    return () => { cancelled = true }
  }, [mode, debouncedOwnedSearch, hidePresetSelector])

  useEffect(() => {
    if (!selectedPresetId || ownedPresets.some(p => p.id === selectedPresetId)) return
    apiFetch<{ preset: MacroPreset }>(`${API}/api/macro-presets/${selectedPresetId}`)
      .then(data => { if (data.preset) setOwnedPresets(prev => prev.some(p => p.id === data.preset.id) ? prev : [data.preset, ...prev]) })
      .catch(() => {})
  }, [selectedPresetId, ownedPresets])

  useEffect(() => {
    if (!selectedPreset) { setEditName(''); setEditDescription(''); return }
    setEditName(selectedPreset.name || '')
    setEditDescription(selectedPreset.description || '')
  }, [selectedPreset])

  const loadVersion = useCallback(async (presetId: number, versionNumber: number) => {
    setLoadingVersion(true)
    setError('')
    try {
      const data = await apiFetch<MacroPresetVersion>(`${API}/api/macro-presets/${presetId}/versions/${versionNumber}`)
      setEntries(toDraftEntries(data))
      setKeyboardLayout(data.keyboardLayout ?? null)
      setSelectedVersionNumber(versionNumber)
    } catch (e: any) {
      setError(e.message || 'Failed to load version')
      setEntries([])
      setKeyboardLayout(null)
      setSelectedVersionNumber(null)
    } finally {
      setLoadingVersion(false)
    }
  }, [])

  const loadLatestVersion = useCallback(async (presetId: number) => {
    setLoadingVersion(true)
    setError('')
    try {
      const seq = ++seqRef.current
      const vers = await apiFetch<MacroPresetVersion[]>(`${API}/api/macro-presets/${presetId}/versions`)
      if (seqRef.current !== seq) return
      setVersions(vers)
      const latest = vers[0]
      if (!latest) { setEntries([]); setKeyboardLayout(null); setActiveVersionNumber(null); setSelectedVersionNumber(null); setLoadingVersion(false); return }
      const full = await apiFetch<MacroPresetVersion>(`${API}/api/macro-presets/${presetId}/versions/${latest.versionNumber}`)
      if (seqRef.current !== seq) return
      setEntries(toDraftEntries(full))
      setKeyboardLayout(full.keyboardLayout ?? null)
      setActiveVersionNumber(latest.versionNumber)
      setSelectedVersionNumber(latest.versionNumber)
    } catch (e: any) {
      setError(e.message || 'Failed to load version')
      setEntries([]); setKeyboardLayout(null); setActiveVersionNumber(null); setVersions([]); setSelectedVersionNumber(null)
    } finally {
      setLoadingVersion(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedPresetId) { setShowAdvanced(false); return }
    loadLatestVersion(selectedPresetId)
  }, [selectedPresetId, loadLatestVersion])

  useEffect(() => {
    if (!initialSelectedPresetId || forcedMode !== 'edit') return
    setSelectedPresetId(initialSelectedPresetId)
  }, [initialSelectedPresetId, forcedMode])

  useEffect(() => {
    if (!draftSeed) return
    setSelectedPresetId(null)
    setVersions([]); setSelectedVersionNumber(null); setActiveVersionNumber(null)
    setNewName(draftSeed.name)
    setNewHandle(draftSeed.handle || '')
    setNewDescription(draftSeed.description)
    setEntries(draftSeed.entries)
    setKeyboardLayout(null)
    setSuccess('Draft loaded from copied preset.')
  }, [draftSeed?.token]) // eslint-disable-line react-hooks/exhaustive-deps

  const onCreatePreset = async () => {
    if (entries.length < 1 && !keyboardLayout) { setShowValidation(true); setError('Add a mapping or a custom keyboard.'); return }
    if (validation.globalErrors.length > 0 || Object.keys(validation.rowErrors).length > 0) { setShowValidation(true); setError('Please fix validation errors first.'); return }
    if (layoutProblems.length > 0) { setError(layoutProblems[0]); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      await apiFetch(`${API}/api/macro-presets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), handle: newHandle.trim().toLowerCase(), description: newDescription.trim(), changeNote: 'Initial version', entries, keyboardLayout }),
      })
      setNewName(''); setNewHandle(''); setNewDescription(''); setEntries([]); setKeyboardLayout(null)
      setActiveVersionNumber(1); setVersions([]); setSelectedVersionNumber(1)
      setShowValidation(false)
      setSuccess('Preset created.')
      onCreated?.()
    } catch (e: any) { setError(e.message || 'Failed to create preset') }
    finally { setSaving(false) }
  }

  const onSaveVersion = async () => {
    if (!selectedPresetId) return
    if (entries.length < 1 && !keyboardLayout) { setShowValidation(true); setError('Add a mapping or a custom keyboard.'); return }
    if (validation.globalErrors.length > 0 || Object.keys(validation.rowErrors).length > 0) { setShowValidation(true); setError('Please fix validation errors first.'); return }
    if (layoutProblems.length > 0) { setError(layoutProblems[0]); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      await apiFetch(`${API}/api/macro-presets/${selectedPresetId}/update-requests`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, keyboardLayout }),
      })
      await loadLatestVersion(selectedPresetId)
      setShowValidation(false)
      setSuccess('New version saved.')
      onSaved?.()
    } catch (e: any) { setError(e.message || 'Failed to save') }
    finally { setSaving(false) }
  }

  const onSaveDetails = async () => {
    if (!selectedPresetId || !selectedPreset) return
    const nextName = editName.trim(); const nextDesc = editDescription.trim()
    if (nextName.length < 3) { setError('Name must be at least 3 characters.'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      await apiFetch(`${API}/api/macro-presets/${selectedPresetId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName, description: nextDesc }),
      })
      setOwnedPresets(prev => prev.map(p => p.id === selectedPresetId ? { ...p, name: nextName, description: nextDesc } : p))
      setSuccess('Details updated.')
      onSaved?.()
    } catch (e: any) { setError(e.message || 'Failed to update details') }
    finally { setSaving(false) }
  }

  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const addEntry = () => setEntries(prev => [
    ...prev,
    { ...defaultEntryByType('CHAR_INSERT'), triggerKey: narrow ? nextPadOnlyTrigger(prev) : '' },
  ])
  const removeEntry = (i: number) => setEntries(prev => prev.filter((_, idx) => idx !== i))
  const updateEntryType = (i: number, macroType: MacroEntryType) =>
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...defaultEntryByType(macroType), triggerKey: e.triggerKey } : e))
  const updateEntry = (i: number, next: MacroEntryDraft) =>
    setEntries(prev => prev.map((e, idx) => idx === i ? next : e))

  const captureTriggerKey = (i: number, entry: MacroEntryDraft, event: KeyboardEvent<HTMLInputElement>) => {
    const rawKey = String(event.key || ''); const rawCode = String(event.code || '')
    if (rawKey === 'Unidentified' || rawKey === 'Process' || event.nativeEvent.isComposing) return
    event.preventDefault(); event.stopPropagation()
    const keyLower = rawKey.toLowerCase()
    const preferCode = ['shift', 'control', 'alt', 'meta'].includes(keyLower) || rawCode.toLowerCase().startsWith('numpad')
    const normalized = normalizeMacroTriggerKey(preferCode ? rawCode : rawKey)
    if (!normalized) return
    updateEntry(i, { ...entry, triggerKey: normalized.slice(0, 64) })
  }

  const captureTypedTrigger = (i: number, entry: MacroEntryDraft, value: string, data: string | null | undefined) => {
    if (!data && value.length <= entry.triggerKey.length) return
    const typed = Array.from(data || value).pop()
    if (!typed) return
    const normalized = normalizeMacroTriggerKey(typed)
    if (normalized) updateEntry(i, { ...entry, triggerKey: normalized.slice(0, 64) })
  }

  const createDisabled = saving ? 'Saving…'
    : newName.trim().length < 3 ? 'Name must be at least 3 characters.'
    : !HANDLE_REGEX.test(newHandle.trim().toLowerCase()) ? 'Handle must be 3-64 chars, lowercase letters/numbers/_/-.'
    : showValidation ? (validation.globalErrors[0] || Object.values(validation.rowErrors)[0]?.[0] || '') : ''

  const saveDisabled = (saving || loadingVersion) ? 'Saving…'
    : !selectedPresetId ? 'Select a preset first.'
    : showValidation ? (validation.globalErrors[0] || Object.values(validation.rowErrors)[0]?.[0] || '') : ''

  const saveDetailsDisabled = saving ? 'Saving…'
    : !selectedPresetId ? 'Select a preset first.'
    : editName.trim().length < 3 ? 'Name must be at least 3 characters.'
    : editName.trim() === (selectedPreset?.name || '') && editDescription.trim() === (selectedPreset?.description || '') ? 'No changes.' : ''

  const showEntries = mode === 'create' || !!selectedPresetId

  const divider = <div style={{ height: 1, background: 'rgb(var(--ink-rgb) / 0.1)', margin: '16px 0' }} />
  const label = (text: string) => <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--ink-3)', marginBottom: 4 }}>{text}</label>

  return (
    <div style={{ background: 'rgb(var(--ink-rgb) / 0.04)', border: '1px solid rgb(var(--ink-rgb) / 0.1)', borderRadius: 10, padding: 16 }}>
      <h3 style={{ margin: '0 0 14px', fontSize: '1rem', color: 'var(--ink-1)' }}>
        {mode === 'create' ? 'Create Macro Preset' : 'Edit Macro Preset'}
      </h3>

      {error && <div style={{ background: 'rgba(244,67,54,0.15)', border: '1px solid rgba(244,67,54,0.4)', borderRadius: 6, padding: '10px 14px', color: 'var(--danger)', fontSize: '0.85rem', marginBottom: 12 }}>{error}</div>}
      {success && <div style={{ background: 'rgba(76,175,80,0.15)', border: '1px solid rgba(76,175,80,0.4)', borderRadius: 6, padding: '10px 14px', color: 'var(--success-ink)', fontSize: '0.85rem', marginBottom: 12 }}>{success}</div>}

      {mode === 'create' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 4 }}>
          <div><label style={{ fontSize: '0.7rem', color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Display Name</label><input style={inp} maxLength={64} value={newName} onChange={e => setNewName(e.target.value)} /></div>
          <div><label style={{ fontSize: '0.7rem', color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Handle</label><input style={inp} maxLength={64} value={newHandle} onChange={e => setNewHandle(e.target.value.toLowerCase())} placeholder="my-preset" /></div>
          <div><label style={{ fontSize: '0.7rem', color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Description</label><input style={inp} maxLength={280} value={newDescription} onChange={e => setNewDescription(e.target.value)} /></div>
        </div>
      ) : (
        <>
          {!hidePresetSelector && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '0.85rem', color: 'rgb(var(--ink-rgb) / 0.7)', fontWeight: 600, marginBottom: 8 }}>Select Preset</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: '1 1 280px' }}>
                  <input style={inp} placeholder="Search your presets…" value={ownedSearch} onChange={e => setOwnedSearch(e.target.value)} />
                  {loadingOwnedPresets && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', fontSize: '0.7rem' }}>…</span>}
                </div>
                <select style={{ ...selStyle, flex: '1 1 200px' }} value={selectedPresetId ?? ''} onChange={e => setSelectedPresetId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">pick a preset</option>
                  {ownedPresets.map(p => <option key={p.id} value={p.id}>{p.name}{p.handle ? ` (@${p.handle})` : ''}</option>)}
                </select>
                {selectedPresetId && <button onClick={() => setSelectedPresetId(null)} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '0.8rem' }}>Clear</button>}
              </div>
              {selectedPreset && (
                <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'rgb(var(--ink-rgb) / 0.5)' }}>
                  Editing <strong style={{ color: 'var(--ink-1)' }}>{selectedPreset.name}</strong>
                  {activeVersionNumber ? ` (latest v${activeVersionNumber})` : ''}
                </div>
              )}
            </div>
          )}

          {selectedPresetId && selectedPreset && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 8 }}>
                <div>{label('Display Name')}<input style={inp} maxLength={64} value={editName} onChange={e => setEditName(e.target.value)} /></div>
                <div>{label('Description')}<input style={inp} maxLength={280} value={editDescription} onChange={e => setEditDescription(e.target.value)} /></div>
              </div>
              <button disabled={Boolean(saveDetailsDisabled)} onClick={onSaveDetails}
                style={{ background: saveDetailsDisabled ? 'rgb(var(--ink-rgb) / 0.06)' : 'rgb(var(--ink-rgb) / 0.12)', border: '1px solid rgb(var(--ink-rgb) / 0.2)', borderRadius: 6, color: saveDetailsDisabled ? 'var(--ink-3)' : 'var(--ink-1)', cursor: saveDetailsDisabled ? 'not-allowed' : 'pointer', fontSize: '0.8rem', padding: '6px 14px' }}
                title={saveDetailsDisabled || undefined}>
                Save Details
              </button>
            </div>
          )}

          {selectedPresetId && (
            <div style={{ marginBottom: 12 }}>
              <button onClick={() => setShowAdvanced(v => !v)} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '0.75rem' }}>
                {showAdvanced ? '▲ Hide Advanced' : '▼ Show Advanced'}
              </button>
              {showAdvanced && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    {label('Base version')}
                    <select style={{ ...selStyle, minWidth: 180 }} value={selectedVersionNumber ?? ''} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n) && selectedPresetId) loadVersion(selectedPresetId, n) }}>
                      {versions.map(v => <option key={v.id} value={v.versionNumber}>v{v.versionNumber}{activeVersionNumber === v.versionNumber ? ' (latest)' : ''}</option>)}
                    </select>
                  </div>
                  {selectedVersionNumber !== activeVersionNumber && (
                    <button onClick={() => selectedPresetId && loadLatestVersion(selectedPresetId)} style={{ background: 'none', border: '1px solid rgb(var(--ink-rgb) / 0.2)', borderRadius: 6, color: 'var(--ink-3)', cursor: 'pointer', fontSize: '0.8rem', padding: '5px 10px', marginTop: 20 }}>Use Latest</button>
                  )}
                </div>
              )}
            </div>
          )}

        </>
      )}

      {showEntries && (
        <>
          {divider}
          {showValidation && validation.globalErrors.length > 0 && (
            <div style={{ background: 'rgba(244,67,54,0.12)', border: '1px solid rgba(244,67,54,0.3)', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: '0.8rem', color: 'var(--danger)' }}>
              {validation.globalErrors.map((m, i) => <div key={i}>{m}</div>)}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {entries.length === 0 && (
              <div style={{ border: '1px dashed rgb(var(--ink-rgb) / 0.2)', borderRadius: 8, padding: 24, textAlign: 'center' }}>
                <button onClick={addEntry} style={{ background: 'rgb(var(--ink-rgb) / 0.08)', border: '1px dashed rgb(var(--ink-rgb) / 0.3)', borderRadius: 6, color: 'var(--ink-2)', cursor: 'pointer', fontSize: '0.85rem', padding: '8px 20px' }}>+ Add Mapping</button>
              </div>
            )}
            {entries.map((entry, i) => {
              const payload = entry.payloadJson as any
              const rowErrs = validation.rowErrors[i] ?? []
              const padOnly = isPadOnlyTrigger(entry.triggerKey)
              const field: React.CSSProperties = narrow ? { ...inp, fontSize: 16 } : inp
              const select: React.CSSProperties = { ...field, cursor: 'pointer' }

              const triggerSwitch = (
                <div role="group" aria-label="Trigger" style={{ display: 'inline-flex', flexShrink: 0, border: '1px solid rgb(var(--ink-rgb) / 0.2)', borderRadius: 8, padding: 2, background: 'rgb(var(--ink-rgb) / 0.05)' }}>
                  {([['Pad', true], ['Key', false]] as const).map(([text, pad]) => (
                    <button
                      key={text}
                      type="button"
                      aria-pressed={padOnly === pad}
                      onClick={() => {
                        if (padOnly === pad) return
                        updateEntry(i, { ...entry, triggerKey: pad ? nextPadOnlyTrigger(entries) : '' })
                      }}
                      style={{
                        border: 'none', borderRadius: 6, padding: narrow ? '8px 12px' : '6px 10px',
                        fontSize: narrow ? 14 : '0.8rem', fontWeight: 600, cursor: 'pointer', touchAction: 'manipulation',
                        background: padOnly === pad ? 'var(--thread-accent)' : 'transparent',
                        color: padOnly === pad ? '#fff' : 'var(--ink-2)',
                      }}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )

              const triggerField = padOnly ? (
                <input style={{ ...field, width: '100%', opacity: 0.6, cursor: 'default' }} value={triggerLabel(entry.triggerKey)} disabled aria-label="Trigger" />
              ) : (
                <input
                  style={{ ...field, width: '100%', cursor: 'pointer', caretColor: 'transparent' }}
                  value={entry.triggerKey}
                  placeholder="Press a key…"
                  aria-label="Trigger key"
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  onKeyDown={e => captureTriggerKey(i, entry, e as any)}
                  onKeyUp={e => captureTriggerKey(i, entry, e as any)}
                  onChange={e => captureTypedTrigger(i, entry, e.target.value, (e.nativeEvent as InputEvent).data)}
                />
              )

              const deleteButton = (
                <button
                  type="button"
                  aria-label="Remove mapping"
                  onClick={() => removeEntry(i)}
                  style={{
                    background: 'rgba(244,67,54,0.12)', border: '1px solid rgba(244,67,54,0.3)', borderRadius: narrow ? 8 : 6,
                    color: 'var(--danger)', cursor: 'pointer', fontSize: narrow ? 16 : '0.7rem', flexShrink: 0, touchAction: 'manipulation',
                    ...(narrow ? { padding: 0, aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' } : { padding: '3px 7px' }),
                  }}
                >
                  ✕
                </button>
              )

              const typeSelect = (
                <select style={{ ...select, width: '100%' }} aria-label="Action type" value={entry.macroType} onChange={e => updateEntryType(i, e.target.value as MacroEntryType)}>
                  {MACRO_TYPE_OPTIONS.map(t => <option key={t} value={t}>{MACRO_TYPE_LABEL[t]}</option>)}
                </select>
              )
              const charInput = (
                <input style={{ ...field, width: '100%' }} aria-label="Character" placeholder="Character" autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} value={payload.char || ''} maxLength={1} onChange={e => updateEntry(i, { ...entry, payloadJson: { char: e.target.value.slice(0, 1) } })} />
              )
              const actionSelect = (
                <select style={{ ...select, width: '100%' }} aria-label="Action" value={payload.action || 'BACKSPACE'} onChange={e => updateEntry(i, { ...entry, payloadJson: { ...payload, action: e.target.value } })}>
                  {ACTION_OPTIONS.map(a => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
                </select>
              )
              const repeatInput = (
                <input type="number" inputMode="numeric" style={{ ...field, width: '100%' }} aria-label="Repeat" min={1} max={MAX_REPEAT} value={payload.repeat ?? 1}
                  onChange={e => updateEntry(i, { ...entry, payloadJson: { ...payload, repeat: Math.max(1, Math.min(MAX_REPEAT, parseInt(e.target.value || '1', 10))) } })} />
              )
              const comboSelect = (
                <select style={{ ...select, width: '100%' }} aria-label="Combo" value={payload.comboId || 'SELECT_ALL_PASTE'} onChange={e => updateEntry(i, { ...entry, payloadJson: { comboId: e.target.value as any } })}>
                  {COMBO_OPTIONS.map(c => <option key={c} value={c}>{COMBO_LABEL[c]}</option>)}
                </select>
              )
              const hasAction = entry.macroType === 'ACTION' || entry.macroType === 'SUBMIT_ACTION'
              const errors = showValidation && rowErrs.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  {rowErrs.map((e, ei) => <div key={ei} style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>{e}</div>)}
                </div>
              )

              if (narrow) {
                return (
                  <div key={i} data-mapping style={{ border: '1px solid rgb(var(--ink-rgb) / 0.12)', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                      {triggerSwitch}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>{triggerField}</div>
                      {deleteButton}
                    </div>
                    {typeSelect}
                    {entry.macroType === 'CHAR_INSERT' && charInput}
                    {hasAction && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 76px', gap: 8, alignItems: 'center' }}>
                        {actionSelect}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: 'var(--ink-3)', fontSize: 16 }}>×</span>
                          {repeatInput}
                        </div>
                      </div>
                    )}
                    {entry.macroType === 'COMBO' && comboSelect}
                    {errors}
                  </div>
                )
              }

              return (
                <div key={i} data-mapping style={{ border: '1px solid rgb(var(--ink-rgb) / 0.1)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {deleteButton}
                    <div style={{ minWidth: 140 }}>
                      {label('Key')}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {triggerSwitch}
                        <div style={{ width: 140 }}>{triggerField}</div>
                      </div>
                    </div>
                    <div style={{ minWidth: 180 }}>
                      {label('Action Type')}
                      {typeSelect}
                    </div>
                    {entry.macroType === 'CHAR_INSERT' && (
                      <div style={{ width: 80 }}>
                        {label('Character')}
                        {charInput}
                      </div>
                    )}
                    {hasAction && (
                      <div style={{ minWidth: 160 }}>
                        {label('Action')}
                        {actionSelect}
                      </div>
                    )}
                    {hasAction && (
                      <div style={{ width: 90 }}>
                        {label('Repeat')}
                        {repeatInput}
                      </div>
                    )}
                    {entry.macroType === 'COMBO' && (
                      <div style={{ minWidth: 180 }}>
                        {label('Combo')}
                        {comboSelect}
                      </div>
                    )}
                  </div>
                  {errors}
                </div>
              )
            })}
          </div>

          {entries.length > 0 && (
            <button onClick={addEntry} style={{ marginTop: 8, width: '100%', background: 'rgb(var(--ink-rgb) / 0.05)', border: '1px dashed rgb(var(--ink-rgb) / 0.2)', borderRadius: 8, color: 'var(--ink-3)', cursor: 'pointer', fontSize: '0.85rem', padding: '12px', fontWeight: 600 }}>
              + Add Mapping
            </button>
          )}

          {divider}
          <PadLayoutEditor value={keyboardLayout} onChange={setKeyboardLayout} entries={entries} />

          {mode === 'edit' && (
            <button
              onClick={onSaveVersion}
              disabled={Boolean(saveDisabled)}
              title={saveDisabled || undefined}
              style={{ marginTop: 12, width: '100%', background: saveDisabled ? 'rgb(var(--ink-rgb) / 0.06)' : 'rgba(76,175,80,0.2)', border: `1px solid ${saveDisabled ? 'rgb(var(--ink-rgb) / 0.1)' : 'rgba(76,175,80,0.4)'}`, borderRadius: 8, color: saveDisabled ? 'var(--ink-3)' : 'var(--success)', cursor: saveDisabled ? 'not-allowed' : 'pointer', fontSize: '0.95rem', fontWeight: 700, padding: 14 }}>
              {saving ? 'Saving…' : 'Save New Version'}
            </button>
          )}

          {mode === 'create' && (
            <button
              onClick={onCreatePreset}
              disabled={Boolean(createDisabled)}
              title={createDisabled || undefined}
              style={{ marginTop: 12, width: '100%', background: createDisabled ? 'rgb(var(--ink-rgb) / 0.06)' : 'rgba(76,175,80,0.2)', border: `1px solid ${createDisabled ? 'rgb(var(--ink-rgb) / 0.1)' : 'rgba(76,175,80,0.4)'}`, borderRadius: 8, color: createDisabled ? 'var(--ink-3)' : 'var(--success)', cursor: createDisabled ? 'not-allowed' : 'pointer', fontSize: '0.95rem', fontWeight: 700, padding: 14 }}>
              {saving ? 'Creating…' : 'Create Preset'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

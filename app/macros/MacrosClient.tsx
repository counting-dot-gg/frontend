'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  type MacroEntry, type MacroEntryDraft, type MacroPreset,
  buildGroupedPreviewRows, prioritizeOwnedMacroPresets,
} from '@/lib/macroUtils'
import { avatarUrl } from '@/lib/counterUtils'
import MacroPresetManager from './MacroPresetManager'

import { API } from '@/lib/apiBase'
const PAGE_SIZE = 25

type SummaryItem = {
  macroPresetId: number
  latestVersionNumber: number | null
  entries: MacroEntry[]
  threadUsage: { threadId: string; threadName: string; threadTitle?: string; appliesCount: number }[]
  threadUsageTotal: number
}

type Props = { username: string; userDiscordId: string | null }

type ViewMode = 'discover' | 'create' | 'edit'

type MacroSearchFilters = { creator: string; name: string; handle: string; thread: string; freeText: string }

function parseMacroSearchFilters(raw: string): MacroSearchFilters {
  const filters: MacroSearchFilters = { creator: '', name: '', handle: '', thread: '', freeText: '' }
  const tokenRegex = /\b(creator|name|handle|thread):"([^"]+)"|\b(creator|name|handle|thread):(\S+)/gi
  let match: RegExpExecArray | null
  while ((match = tokenRegex.exec(raw))) {
    const key = (match[1] || match[3] || '').toLowerCase()
    const value = (match[2] || match[4] || '').trim()
    if (key === 'creator') filters.creator = value
    else if (key === 'name') filters.name = value
    else if (key === 'handle') filters.handle = value
    else if (key === 'thread') filters.thread = value
  }
  const strip = /\b(creator|name|handle|thread):"([^"]+)"|\b(creator|name|handle|thread):(\S+)/gi
  filters.freeText = raw.replace(strip, ' ').replace(/\s+/g, ' ').trim()
  return filters
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init })
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || `${res.status}`) }
  return res.json()
}

export default function MacrosClient({ username, userDiscordId }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [viewMode, setViewMode] = useState<ViewMode>('discover')
  const [selectedEditPresetId, setSelectedEditPresetId] = useState<number | null>(null)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [macroPresets, setMacroPresets] = useState<MacroPreset[]>([])
  const [ownedGroupIds, setOwnedGroupIds] = useState<Set<number>>(new Set())
  const [summaryById, setSummaryById] = useState<Record<number, SummaryItem>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copyNotice, setCopyNotice] = useState('')
  const [draftSeed, setDraftSeed] = useState<{ token: number; name: string; handle?: string; description: string; entries: MacroEntryDraft[] } | null>(null)

  const [editSearch, setEditSearch] = useState('')
  const [debouncedEditSearch, setDebouncedEditSearch] = useState('')
  const [editPage, setEditPage] = useState(1)
  const [editTotal, setEditTotal] = useState(0)
  const [editPresets, setEditPresets] = useState<MacroPreset[]>([])
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'discover' || tab === 'create' || tab === 'edit') setViewMode(tab)
    const preset = searchParams.get('preset')
    setSelectedEditPresetId(preset && /^\d+$/.test(preset) ? parseInt(preset) : null)
  }, [searchParams])

  const setTab = (tab: ViewMode, presetId?: number) => {
    const next = new URLSearchParams(searchParams.toString())
    next.set('tab', tab)
    if (tab !== 'edit' || presetId == null) next.delete('preset')
    else next.set('preset', String(presetId))
    router.replace(`?${next}`)
  }

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search.trim()), 250); return () => clearTimeout(t) }, [search])
  useEffect(() => { const t = setTimeout(() => setDebouncedEditSearch(editSearch.trim()), 250); return () => clearTimeout(t) }, [editSearch])

  const searchFilters = useMemo(() => parseMacroSearchFilters(debouncedSearch), [debouncedSearch])
  const editSearchFilters = useMemo(() => parseMacroSearchFilters(debouncedEditSearch), [debouncedEditSearch])

  const hydrateDetails = useCallback(async (presets: MacroPreset[]) => {
    if (presets.length === 0) { setSummaryById({}); return }
    const ids = presets.map(p => p.id).join(',')
    try {
      const data = await apiFetch<{ items: SummaryItem[] }>(`${API}/api/macro-presets/summaries?ids=${ids}&usageLimit=3`)
      const byId: Record<number, SummaryItem> = {}
      for (const item of data.items ?? []) byId[item.macroPresetId] = item
      setSummaryById(byId)
    } catch {}
  }, [])

  const loadPresets = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const q = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      const serverSearch = searchFilters.freeText || searchFilters.name || searchFilters.handle
      if (serverSearch) q.set('search', serverSearch)
      if (searchFilters.creator) q.set('owner', searchFilters.creator)
      if (searchFilters.thread) q.set('thread', searchFilters.thread)
      const data = await apiFetch<{ total: number; items: MacroPreset[] }>(`${API}/api/macro-presets?${q}`)
      setTotal(data.total ?? 0)
      setMacroPresets(data.items ?? [])
      setOwnedGroupIds(new Set((data.items ?? []).filter(p => p.ownerCounter?.discordId === userDiscordId).map(p => p.id)))
      await hydrateDetails(data.items ?? [])
    } catch (e: any) { setError(e.message || 'Failed to load presets') }
    finally { setLoading(false) }
  }, [page, searchFilters, userDiscordId, hydrateDetails])

  useEffect(() => { loadPresets() }, [loadPresets])

  const loadEditPresets = useCallback(async () => {
    setEditLoading(true); setEditError('')
    try {
      const q = new URLSearchParams({ page: String(editPage), limit: String(PAGE_SIZE), mine: '1' })
      const serverSearch = editSearchFilters.freeText || editSearchFilters.name || editSearchFilters.handle
      if (serverSearch) q.set('search', serverSearch)
      if (editSearchFilters.thread) q.set('thread', editSearchFilters.thread)
      const data = await apiFetch<{ total: number; items: MacroPreset[] }>(`${API}/api/macro-presets?${q}`)
      setEditTotal(data.total ?? 0)
      setEditPresets(data.items ?? [])
      await hydrateDetails(data.items ?? [])
    } catch (e: any) { setEditError(e.message || 'Failed to load your presets') }
    finally { setEditLoading(false) }
  }, [editPage, editSearchFilters, hydrateDetails])

  useEffect(() => { if (viewMode === 'edit') loadEditPresets() }, [viewMode, loadEditPresets])

  const sortedPresets = useMemo(() => prioritizeOwnedMacroPresets(macroPresets, ownedGroupIds), [macroPresets, ownedGroupIds])

  const filteredEditPresets = useMemo(() => editPresets.filter(p => {
    if (editSearchFilters.name && !(p.name || '').toLowerCase().includes(editSearchFilters.name.toLowerCase())) return false
    if (editSearchFilters.handle && !(p.handle || '').toLowerCase().includes(editSearchFilters.handle.toLowerCase())) return false
    return true
  }), [editPresets, editSearchFilters])

  const filteredPresets = useMemo(() => sortedPresets.filter(preset => {
    const summary = summaryById[preset.id]
    const entries = summary?.entries ?? []
    const ownerStr = `${preset.ownerCounter?.name || ''} ${preset.ownerCounter?.username || ''}`.toLowerCase()
    const nameStr = (preset.name || '').toLowerCase()
    const handleStr = (preset.handle || '').toLowerCase()
    const threadStr = (summary?.threadUsage ?? []).map(r => `${r.threadName || ''} ${r.threadTitle || ''}`).join(' ').toLowerCase()
    const previewStr = entries.map(e => `${e.triggerKey} ${e.macroType}`).join(' ').toLowerCase()
    const haystack = `${nameStr} ${handleStr} ${(preset.description || '').toLowerCase()} ${ownerStr} ${threadStr} ${previewStr}`
    if (searchFilters.creator && !ownerStr.includes(searchFilters.creator.toLowerCase())) return false
    if (searchFilters.name && !nameStr.includes(searchFilters.name.toLowerCase())) return false
    if (searchFilters.handle && !handleStr.includes(searchFilters.handle.toLowerCase())) return false
    if (searchFilters.freeText && !haystack.includes(searchFilters.freeText.toLowerCase())) return false
    return true
  }), [sortedPresets, searchFilters, summaryById])

  const copyToDraft = (preset: MacroPreset) => {
    if (viewMode === 'create' && !confirm('Replace your current draft with this copied macro preset?')) return
    const summary = summaryById[preset.id]
    setDraftSeed({
      token: Date.now(), name: `${preset.name} (copy)`, handle: '', description: preset.description || '',
      entries: (summary?.entries ?? []).map(e => ({ triggerKey: e.triggerKey, macroType: e.macroType, payloadJson: e.payloadJson as any })),
    })
    setCopyNotice(`Copied "${preset.name}" into draft.`)
    setTab('create')
  }

  const inp: React.CSSProperties = {
    background: 'rgb(var(--ink-rgb) / 0.07)', border: '1px solid rgb(var(--ink-rgb) / 0.2)',
    borderRadius: 6, color: 'var(--ink-1)', fontSize: '0.85rem', padding: '7px 10px', width: '100%',
  }

  const tabBtn = (active: boolean): React.CSSProperties => ({
    background: active ? 'rgb(var(--ink-rgb) / 0.15)' : 'transparent',
    border: `1px solid ${active ? 'rgb(var(--ink-rgb) / 0.3)' : 'rgb(var(--ink-rgb) / 0.15)'}`,
    borderRadius: 8, color: active ? 'var(--ink-1)' : 'rgb(var(--ink-rgb) / 0.6)',
    cursor: 'pointer', fontSize: '0.85rem', fontWeight: active ? 600 : 400, padding: '5px 14px',
  })

  const smallBtn = (primary = false): React.CSSProperties => ({
    background: primary ? 'rgba(33,150,243,0.2)' : 'rgb(var(--ink-rgb) / 0.08)',
    border: `1px solid ${primary ? 'rgba(33,150,243,0.4)' : 'rgb(var(--ink-rgb) / 0.15)'}`,
    borderRadius: 6, color: primary ? 'var(--primary)' : 'var(--ink-2)',
    cursor: 'pointer', fontSize: '0.78rem', padding: '4px 10px', whiteSpace: 'nowrap' as const,
  })

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px', color: 'var(--ink-1)' }}>
      <div style={{ background: 'rgb(var(--ink-rgb) / 0.05)', border: '1px solid rgb(var(--ink-rgb) / 0.1)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <h1 style={{ margin: '0 0 12px', fontSize: '1.5rem', fontWeight: 700 }}>Macro Presets</h1>
        {error && <div style={{ background: 'rgba(244,67,54,0.15)', border: '1px solid rgba(244,67,54,0.4)', borderRadius: 6, padding: '10px 14px', color: 'var(--danger)', marginBottom: 12, fontSize: '0.85rem' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={tabBtn(viewMode === 'discover')} onClick={() => setTab('discover')}>Discover</button>
          <button style={tabBtn(viewMode === 'create')} onClick={() => setTab('create')}>Create</button>
          <button style={tabBtn(viewMode === 'edit')} onClick={() => setTab('edit')}>Edit</button>
        </div>
      </div>

      {viewMode === 'discover' && (
        <div style={{ background: 'rgb(var(--ink-rgb) / 0.04)', border: '1px solid rgb(var(--ink-rgb) / 0.1)', borderRadius: 10, padding: 16 }}>
          <input style={inp} placeholder='Search: or use filters: creator:pull name:test handle:abc thread:"main"'
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          {loading && <div style={{ height: 2, background: 'rgba(33,150,243,0.5)', borderRadius: 1, margin: '8px 0', animation: 'pulse 1s infinite' }} />}
          <div style={{ height: 1, background: 'rgb(var(--ink-rgb) / 0.1)', margin: '16px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredPresets.map(preset => {
              const summary = summaryById[preset.id]
              const entries = summary?.entries ?? []
              const previewRows = buildGroupedPreviewRows(entries)
              const usageRows = summary?.threadUsage ?? []
              const topUsage = usageRows[0]
              const isOwned = ownedGroupIds.has(preset.id)
              const ownerAvatar = preset.ownerCounter ? avatarUrl({ discordId: preset.ownerCounter.discordId, avatar: preset.ownerCounter.avatar }) : undefined

              return (
                <div key={preset.id} style={{ border: '1px solid rgb(var(--ink-rgb) / 0.12)', borderRadius: 10, padding: 12, background: 'rgb(var(--ink-rgb) / 0.03)', transition: 'border-color 0.12s', cursor: 'default' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(33,150,243,0.5)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgb(var(--ink-rgb) / 0.12)')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        {ownerAvatar
                          ? <img src={ownerAvatar} alt="" width={24} height={24} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                          : <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgb(var(--ink-rgb) / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--ink-3)' }}>{(preset.ownerCounter?.name || preset.ownerCounter?.username || '?')[0]?.toUpperCase()}</div>
                        }
                        <span style={{ fontSize: '0.75rem', color: 'rgb(var(--ink-rgb) / 0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {preset.ownerCounter ? `${preset.ownerCounter.name || preset.ownerCounter.username}${preset.ownerCounter.username ? ` (@${preset.ownerCounter.username})` : ''}` : 'Unknown'}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.name}</div>
                      {preset.handle && <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: 1 }}>/macros/{preset.handle}</div>}
                      <div style={{ fontSize: '0.82rem', color: 'rgb(var(--ink-rgb) / 0.6)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.description || 'No description'}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        <span style={{ fontSize: '0.65rem', border: '1px solid rgb(var(--ink-rgb) / 0.2)', borderRadius: 4, padding: '2px 6px', color: 'var(--ink-3)' }}>v{summary?.latestVersionNumber ?? '–'}</span>
                        <span style={{ fontSize: '0.65rem', border: '1px solid rgb(var(--ink-rgb) / 0.2)', borderRadius: 4, padding: '2px 6px', color: 'var(--ink-3)' }}>{entries.length} {entries.length === 1 ? 'mapping' : 'mappings'}</span>
                        {isOwned && <span style={{ fontSize: '0.65rem', border: '1px solid rgba(76,175,80,0.4)', borderRadius: 4, padding: '2px 6px', color: 'var(--success-ink)' }}>Owned</span>}
                        {topUsage && (
                          <a href={`/thread/${encodeURIComponent(topUsage.threadName || topUsage.threadId)}`} style={{ fontSize: '0.65rem', border: '1px solid rgba(33,150,243,0.4)', borderRadius: 4, padding: '2px 6px', color: '#90caf9', textDecoration: 'none' }}>
                            Top: {topUsage.threadTitle || topUsage.threadName} ({topUsage.appliesCount})
                          </a>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                      {preset.handle && <a href={`/macros/${preset.handle}`} style={{ ...smallBtn(), textDecoration: 'none', textAlign: 'center' }}>Open</a>}
                      <button style={smallBtn(true)} onClick={() => copyToDraft(preset)}>Copy To Draft</button>
                      <span style={{ fontSize: '0.65rem', color: 'var(--ink-3)', textAlign: 'right', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(summary?.threadUsageTotal ?? 0) > 0 ? `${summary?.threadUsageTotal} thread${summary?.threadUsageTotal !== 1 ? 's' : ''} using this` : 'No users set this on a thread yet'}
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 1, background: 'rgb(var(--ink-rgb) / 0.08)', margin: '10px 0' }} />
                  {previewRows.length > 0 ? previewRows.map(row => (
                    <div key={row} style={{ fontSize: '0.75rem', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.6 }}>{row}</div>
                  )) : <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>No mappings in latest version.</div>}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {usageRows.slice(topUsage ? 1 : 0).map(row => (
                      row.threadId
                        ? <a key={`${preset.id}-${row.threadId}`} href={`/thread/${encodeURIComponent(row.threadName || row.threadId)}`} style={{ fontSize: '0.65rem', border: '1px solid rgb(var(--ink-rgb) / 0.15)', borderRadius: 4, padding: '2px 6px', color: 'var(--ink-3)', textDecoration: 'none' }}>{row.threadTitle || row.threadName} ({row.appliesCount})</a>
                        : <span key={`${preset.id}-${row.threadName}`} style={{ fontSize: '0.65rem', border: '1px solid rgb(var(--ink-rgb) / 0.15)', borderRadius: 4, padding: '2px 6px', color: 'var(--ink-3)' }}>{row.threadTitle || row.threadName} ({row.appliesCount})</span>
                    ))}
                    {usageRows.length === 0 && <span style={{ fontSize: '0.7rem', color: 'var(--ink-3)' }}>No thread users yet</span>}
                  </div>
                </div>
              )
            })}
            {!loading && filteredPresets.length === 0 && (
              <div style={{ color: 'var(--ink-3)', fontSize: '0.85rem', padding: '12px 0' }}>No macro presets found.</div>
            )}
          </div>

          {total > PAGE_SIZE && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 20 }}>
              <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ ...smallBtn(), opacity: page === 1 ? 0.4 : 1 }}>◀</button>
              <span style={{ fontSize: '0.8rem', color: 'var(--ink-3)' }}>Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
              <button disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage(p => p + 1)} style={{ ...smallBtn(), opacity: page >= Math.ceil(total / PAGE_SIZE) ? 0.4 : 1 }}>▶</button>
            </div>
          )}
        </div>
      )}

      {viewMode === 'create' && (
        <>
          {copyNotice && (
            <div style={{ background: 'rgba(76,175,80,0.15)', border: '1px solid rgba(76,175,80,0.4)', borderRadius: 8, padding: '10px 14px', color: 'var(--success-ink)', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem' }}>{copyNotice}</span>
              <button onClick={() => setCopyNotice('')} style={{ background: 'none', border: 'none', color: 'var(--success-ink)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>
          )}
          <MacroPresetManager forcedMode="create" draftSeed={draftSeed} onCreated={() => { loadPresets(); setCopyNotice('') }} />
        </>
      )}

      {viewMode === 'edit' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 16, alignItems: 'start' }}>
          <div style={{ background: 'rgb(var(--ink-rgb) / 0.04)', border: '1px solid rgb(var(--ink-rgb) / 0.1)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 12 }}>Your Presets</div>
            {editError && <div style={{ background: 'rgba(244,67,54,0.15)', border: '1px solid rgba(244,67,54,0.3)', borderRadius: 6, padding: '8px 12px', color: 'var(--danger)', fontSize: '0.8rem', marginBottom: 10 }}>{editError}</div>}
            <input style={inp} placeholder='Search: or: name:test handle:abc thread:"main"'
              value={editSearch} onChange={e => { setEditSearch(e.target.value); setEditPage(1) }} />
            {editLoading && <div style={{ height: 2, background: 'rgba(33,150,243,0.5)', borderRadius: 1, margin: '8px 0' }} />}
            <div style={{ height: 1, background: 'rgb(var(--ink-rgb) / 0.1)', margin: '12px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredEditPresets.map(preset => {
                const summary = summaryById[preset.id]
                const entries = summary?.entries ?? []
                const previewRows = buildGroupedPreviewRows(entries)
                const isSelected = selectedEditPresetId === preset.id
                return (
                  <div key={preset.id} style={{ border: `1px solid ${isSelected ? 'rgba(33,150,243,0.6)' : 'rgb(var(--ink-rgb) / 0.1)'}`, borderRadius: 8, padding: 12, background: isSelected ? 'rgba(33,150,243,0.08)' : 'rgb(var(--ink-rgb) / 0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.9rem' }}>{preset.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preset.description || 'No description'}</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.65rem', border: '1px solid rgb(var(--ink-rgb) / 0.2)', borderRadius: 4, padding: '1px 5px', color: 'var(--ink-3)' }}>v{summary?.latestVersionNumber ?? '–'}</span>
                          <span style={{ fontSize: '0.65rem', border: '1px solid rgb(var(--ink-rgb) / 0.2)', borderRadius: 4, padding: '1px 5px', color: 'var(--ink-3)' }}>{entries.length} mappings</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button style={smallBtn(isSelected)} onClick={() => { setSelectedEditPresetId(preset.id); setTab('edit', preset.id) }}>Edit</button>
                        {preset.handle && <a href={`/macros/${preset.handle}`} style={{ ...smallBtn(), textDecoration: 'none' }}>Open</a>}
                      </div>
                    </div>
                    {previewRows.length > 0 && (
                      <>
                        <div style={{ height: 1, background: 'rgb(var(--ink-rgb) / 0.08)', margin: '8px 0' }} />
                        {previewRows.map(row => (
                          <div key={row} style={{ fontSize: '0.72rem', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.5 }}>{row}</div>
                        ))}
                      </>
                    )}
                  </div>
                )
              })}
              {!editLoading && filteredEditPresets.length === 0 && <div style={{ color: 'var(--ink-3)', fontSize: '0.85rem' }}>No presets found.</div>}
            </div>
            {editTotal > PAGE_SIZE && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
                <button disabled={editPage === 1} onClick={() => setEditPage(p => Math.max(1, p - 1))} style={{ ...smallBtn(), opacity: editPage === 1 ? 0.4 : 1 }}>◀</button>
                <span style={{ fontSize: '0.8rem', color: 'var(--ink-3)' }}>{editPage}/{Math.ceil(editTotal / PAGE_SIZE)}</span>
                <button disabled={editPage >= Math.ceil(editTotal / PAGE_SIZE)} onClick={() => setEditPage(p => p + 1)} style={{ ...smallBtn(), opacity: editPage >= Math.ceil(editTotal / PAGE_SIZE) ? 0.4 : 1 }}>▶</button>
              </div>
            )}
          </div>

          <div style={{ position: 'sticky', top: 16, alignSelf: 'start', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
            <MacroPresetManager
              forcedMode="edit"
              initialSelectedPresetId={selectedEditPresetId}
              hidePresetSelector
              draftSeed={draftSeed}
              onSaved={loadEditPresets}
            />
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { buildGroupedPreviewRows, type MacroEntry } from '@/lib/macroUtils'
import type { ActiveMacroRuntime } from '@/lib/macroRuntime'

import { API } from '@/lib/apiBase'

interface MacroPreset {
  id: number
  name: string
  handle?: string
  description?: string
  threadUsageCount?: number
  category?: string
}

type ActiveRuntime = ActiveMacroRuntime

interface MacrosPanelProps {
  threadUUID: string
  isLoggedIn: boolean
  onRuntimeChange?: (runtime: ActiveMacroRuntime | null) => void
}

export default function MacrosPanel({ threadUUID, isLoggedIn, onRuntimeChange }: MacrosPanelProps) {
  const [presets, setPresets] = useState<MacroPreset[]>([])
  const [visibleIds, setVisibleIds] = useState<number[]>([])
  const [runtime, setRuntimeState] = useState<ActiveRuntime | null>(null)
  const onRuntimeChangeRef = useRef(onRuntimeChange)
  onRuntimeChangeRef.current = onRuntimeChange
  const setRuntime = useCallback((r: ActiveRuntime | null) => {
    setRuntimeState(r)
    onRuntimeChangeRef.current?.(r)
  }, [])
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isLoggedIn) return
    fetch(`${API}/api/threads/${threadUUID}/macro-presets/active`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        setRuntime(data)
        setSelectedId(data.macroPresetId ?? null)
      })
      .catch(() => {})
  }, [threadUUID, isLoggedIn])

  useEffect(() => {
    if (!isLoggedIn) return
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ limit: '50' })
        if (searchQuery.trim()) params.set('search', searchQuery.trim())
        params.set('threadId', threadUUID)
        const r = await fetch(`${API}/api/macro-presets?${params}`, { credentials: 'include' })
        if (!r.ok) return
        const data = await r.json()
        const items: MacroPreset[] = data.items ?? []
        setPresets(prev => {
          const map = new Map(prev.map(p => [p.id, p]))
          items.forEach(p => map.set(p.id, p))
          return Array.from(map.values())
        })
        setVisibleIds(items.map(p => p.id))
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [searchQuery, threadUUID, isLoggedIn])

  const selectPreset = useCallback(async (presetId: number | null) => {
    setSaving(true)
    const prev = selectedId
    setSelectedId(presetId)
    try {
      await fetch(`${API}/api/threads/${threadUUID}/preferences/macro-preset`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: true, macroPresetId: presetId }),
      })
      if (presetId !== null) {
        await fetch(`${API}/api/threads/${threadUUID}/macro-presets/${presetId}/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: '{}',
        })
      }
      const r = await fetch(`${API}/api/threads/${threadUUID}/macro-presets/active`, { credentials: 'include' })
      if (r.ok) setRuntime(await r.json())
      setOpen(false)
    } catch {
      setSelectedId(prev)
    } finally {
      setSaving(false)
    }
  }, [selectedId, threadUUID])

  const clearToGlobal = useCallback(async () => {
    setSaving(true)
    const prev = selectedId
    setSelectedId(null)
    try {
      await fetch(`${API}/api/threads/${threadUUID}/preferences/macro-preset`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: false, macroPresetId: null }),
      })
      const r = await fetch(`${API}/api/threads/${threadUUID}/macro-presets/active`, { credentials: 'include' })
      if (r.ok) setRuntime(await r.json())
    } catch {
      setSelectedId(prev)
    } finally {
      setSaving(false)
    }
  }, [selectedId, threadUUID])

  if (!isLoggedIn) return null

  const selectedPreset = presets.find(p => p.id === selectedId)
  const visiblePresets = presets.filter(p => visibleIds.includes(p.id))
  const grouped = runtime?.entries?.length ? buildGroupedPreviewRows(runtime.entries as MacroEntry[]) : []
  const sourceLabel = runtime?.source === 'thread' ? 'Thread Pref' : runtime?.source === 'global' ? 'Global Pref' : 'None'

  return (
    <div style={{ marginTop: 20, border: '1px solid rgb(var(--ink-rgb) / 0.1)', borderRadius: 8, padding: 12, maxWidth: 360 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <a href="/macros" style={{ fontWeight: 700, fontSize: 14, color: '#f97316', textDecoration: 'none' }}>
          Macros
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {runtime?.source === 'thread' ? (
            <button onClick={clearToGlobal} disabled={saving} style={chipStyle('#f97316')}>
              Thread Pref ✕
            </button>
          ) : (
            <span style={chipOutlineStyle}>{sourceLabel}</span>
          )}
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder={selectedPreset ? selectedPreset.name : 'Search presets…'}
          value={searchInput}
          onFocus={() => setOpen(true)}
          onChange={e => { setSearchInput(e.target.value); setSearchQuery(e.target.value) }}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '6px 10px', fontSize: 13,
            background: 'rgb(var(--ink-rgb) / 0.05)', border: '1px solid rgb(var(--ink-rgb) / 0.15)',
            borderRadius: 6, color: 'var(--ink-1)', outline: 'none',
          }}
        />
        {open && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: 'var(--surface-raised)', border: '1px solid rgb(var(--ink-rgb) / 0.15)', borderRadius: 6,
            marginTop: 2, maxHeight: 280, overflowY: 'auto',
          }}>
            <div
              onClick={() => { selectPreset(null); setSearchInput(''); setOpen(false) }}
              style={dropdownItemStyle}
            >
              <div style={{ fontSize: 13 }}>No macro preset</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Disable macros for this thread</div>
            </div>
            {loading && <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--ink-3)' }}>Loading…</div>}
            {visiblePresets.map(p => (
              <div
                key={p.id}
                onClick={() => { selectPreset(p.id); setSearchInput(''); setOpen(false) }}
                style={{ ...dropdownItemStyle, background: p.id === selectedId ? 'rgba(249,115,22,0.1)' : undefined }}
              >
                <div style={{ fontSize: 13, color: p.id === selectedId ? '#f97316' : '#ddd' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {p.threadUsageCount ? `${p.threadUsageCount} users here · ` : ''}
                  {p.handle ? `@${p.handle} · ` : ''}
                  {p.description || 'No description'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => { setOpen(false); setSearchInput('') }} />}

      {saving && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>Saving…</div>}

      {grouped.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {grouped.map((row, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3, wordBreak: 'break-word' }}>
              {row}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const dropdownItemStyle: React.CSSProperties = {
  padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid rgb(var(--ink-rgb) / 0.06)',
}

function chipStyle(color: string): React.CSSProperties {
  return {
    padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
    background: color + '22', color, border: `1px solid ${color}55`,
    cursor: 'pointer', outline: 'none',
  }
}

const chipOutlineStyle: React.CSSProperties = {
  padding: '2px 8px', borderRadius: 10, fontSize: 11,
  border: '1px solid rgb(var(--ink-rgb) / 0.15)', color: 'var(--ink-3)',
}

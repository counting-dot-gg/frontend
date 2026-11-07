'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { usePrefs } from './PrefsContext'
import { UNIMPLEMENTED_PREFS } from '@/lib/prefs'
import { PREF_BY_KEY } from '@/lib/prefsCatalog'
import type { ResolvedPrefs } from '@/lib/prefs'
import { setDevicePerf, useDevicePerf } from '@/lib/devicePerf'
import { getSocket } from '@/lib/socket'

interface PrefsEditorProps {
  scope: 'site' | 'thread'
  threadUUID?: string
  threadEnabled?: boolean
}

type LocalPrefs = ResolvedPrefs & { _threadEnabled: boolean }

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export const CLEAR_LABELS: Record<string, string> = { Custom: 'Auto-paste' }

function PrefSelect({ label, value, options, onChange, optionLabels }: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
  optionLabels?: Record<string, string>
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <label style={{ fontSize: 12, color: 'var(--ink-3)', width: 160, flexShrink: 0 }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'rgb(var(--ink-rgb) / 0.06)', border: '1px solid rgb(var(--ink-rgb) / 0.12)',
          borderRadius: 6, padding: '4px 8px', fontSize: 12, color: 'var(--ink-1)', cursor: 'pointer',
        }}
      >
        {options.map(o => <option key={o} value={o}>{optionLabels?.[o] ?? o}</option>)}
      </select>
    </div>
  )
}

function PrefToggle({ label, value, onChange }: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <label style={{ fontSize: 12, color: 'var(--ink-3)', width: 160, flexShrink: 0 }}>{label}</label>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
          background: value ? '#f97316' : 'rgb(var(--ink-rgb) / 0.1)',
          position: 'relative', transition: 'background 0.15s',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: value ? 21 : 3,
          width: 16, height: 16, borderRadius: 8, background: '#fff',
          transition: 'left 0.15s',
        }} />
      </button>
    </div>
  )
}

function DevicePerfPrefs() {
  const perf = useDevicePerf()
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>This device</div>
      <PrefToggle label="Faster post list" value={perf.flipList} onChange={v => setDevicePerf({ flipList: v })} />
      <PrefToggle label="Fewer posts on phones" value={perf.fewerRows} onChange={v => setDevicePerf({ fewerRows: v })} />
      <PrefToggle label="Live rank updates" value={perf.liveRank} onChange={v => { setDevicePerf({ liveRank: v }); getSocket().emit('rank_live', v) }} />
    </div>
  )
}

function PrefNumber({ label, value, min, max, step, onChange }: {
  label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <label style={{ fontSize: 12, color: 'var(--ink-3)', width: 160, flexShrink: 0 }}>{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => {
          let n = step != null && step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10)
          if (!Number.isFinite(n)) return
          if (min != null) n = Math.max(min, n)
          if (max != null) n = Math.min(max, n)
          onChange(n)
        }}
        style={{
          width: 70, background: 'rgb(var(--ink-rgb) / 0.06)', border: '1px solid rgb(var(--ink-rgb) / 0.12)',
          borderRadius: 6, padding: '4px 8px', fontSize: 12, color: 'var(--ink-1)', outline: 'none',
        }}
      />
    </div>
  )
}

function PrefColor({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <label style={{ fontSize: 12, color: 'var(--ink-3)', width: 160, flexShrink: 0 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ width: 32, height: 24, padding: 0, border: '1px solid rgb(var(--ink-rgb) / 0.15)', borderRadius: 4, cursor: 'pointer', background: 'none' }}
        />
        <input
          type="text"
          value={value}
          maxLength={7}
          onChange={e => {
            const v = e.target.value
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v)
          }}
          style={{
            width: 72, background: 'rgb(var(--ink-rgb) / 0.06)', border: '1px solid rgb(var(--ink-rgb) / 0.12)',
            borderRadius: 6, padding: '4px 8px', fontSize: 12, color: 'var(--ink-1)', outline: 'none', fontFamily: 'monospace',
          }}
        />
      </div>
    </div>
  )
}

function SaveStatusBar({ state, error, dirty, onRetry }: {
  state: SaveState
  error: string | null
  dirty: boolean
  onRetry: () => void
}) {
  const isError = state === 'error'
  const show = isError || state === 'saving' || state === 'saved' || dirty
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 5, minHeight: 26,
      marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8,
      ...(show ? {
        padding: '5px 9px', borderRadius: 6,
        background: isError ? 'rgba(239,68,68,0.14)' : 'rgb(var(--surface-0-rgb) / 0.92)',
        border: `1px solid ${isError ? 'rgba(239,68,68,0.45)' : 'rgb(var(--ink-rgb) / 0.08)'}`,
        backdropFilter: 'blur(6px)',
      } : {}),
    }}>
      {isError ? (
        <>
          <span style={{ fontSize: 12, color: '#fca5a5', flex: 1, lineHeight: 1.35 }}>
            <strong style={{ color: 'var(--danger)' }}>Not saved.</strong>{' '}
            {error ?? 'Something went wrong saving your preferences.'}
          </span>
          <button
            onClick={onRetry}
            style={{
              padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: 'var(--danger)', color: '#fff', fontWeight: 700, fontSize: 12, flexShrink: 0,
            }}
          >
            Retry
          </button>
        </>
      ) : state === 'saving' ? (
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Saving…</span>
      ) : state === 'saved' ? (
        <span style={{ fontSize: 12, color: 'var(--success-ink)' }}>✓ Saved</span>
      ) : dirty ? (
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Unsaved changes…</span>
      ) : null}
    </div>
  )
}

async function readErrorReason(res: Response): Promise<string> {
  if (res.status === 401 || res.status === 403) {
    return 'You appear to be signed out, so the change was rejected. Sign in again, then retry.'
  }
  try {
    const body = await res.json()
    const m = body?.message
    if (typeof m === 'string' && m) return m
    if (Array.isArray(m) && m.length) return m.join('; ')
  } catch {}
  return `The server rejected the save (${res.status}).`
}

export default function PrefsEditor({ scope, threadUUID, threadEnabled = false }: PrefsEditorProps) {
  const resolved = usePrefs()

  const initial: LocalPrefs = { ...resolved, _threadEnabled: threadEnabled }
  const [local, setLocal] = useState<LocalPrefs>(initial)

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const autosaves = scope === 'thread' && !!threadUUID

  const pendingRef = useRef<LocalPrefs>(initial)
  const changedRef = useRef<Set<keyof LocalPrefs>>(new Set())
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const buildPrefsUpdate = (p: LocalPrefs) => ({
    pref_submit_shortcut:           p.pref_submit_shortcut,
    pref_clear:                     p.pref_clear,
    pref_load_from_bottom:          p.pref_load_from_bottom,
    pref_post_style:                p.pref_post_style,
    pref_post_style_mobile:         p.pref_post_style_mobile,
    pref_reply_time_interval:       p.pref_reply_time_interval,
    pref_night_mode_colors:         p.pref_night_mode_colors,
    pref_post_position:             p.pref_post_position,
    pref_hide_stricken:             p.pref_hide_stricken,
    pref_standardize_format:        p.pref_standardize_format,
    pref_time_since_last_count:     p.pref_time_since_last_count,
    pref_custom_stricken:           p.pref_custom_stricken,
    pref_highlight_last_count:      p.pref_highlight_last_count,
    pref_highlight_last_count_color:p.pref_highlight_last_count_color,
    pref_sound_on_stricken:         p.pref_sound_on_stricken,
    pref_hide_thread_picker:        p.pref_hide_thread_picker,
    pref_stricken_count_opacity:    p.pref_stricken_count_opacity,
    pref_timestamp_display:         p.pref_timestamp_display,
    pref_show_latency:              p.pref_show_latency,
    pref_pace_mode:                 p.pref_pace_mode,
    pref_pace_counts:               p.pref_pace_counts,
    pref_post_font_size:            p.pref_post_font_size,
    pref_strike_color:              p.pref_strike_color,
    pref_online:                    p.pref_online,
    pref_discord_pings:             p.pref_discord_pings,
    pref_nightMode:                 p.pref_nightMode,
  })

  const save = useCallback(async (next: LocalPrefs, opts?: { keepalive?: boolean }) => {
    if (mountedRef.current) {
      setSaveState('saving')
    }
    let sentKeys: Set<keyof LocalPrefs> | null = null
    try {
      let res: Response
      if (scope === 'thread' && threadUUID) {
        const full = buildPrefsUpdate(next) as Record<string, unknown>
        const diff: Record<string, unknown> = {}
        for (const key of changedRef.current) {
          if (key === '_threadEnabled') continue
          if (key in full) diff[key] = full[key as string]
        }
        sentKeys = new Set(changedRef.current)
        res = await fetch('/api/user/threadPrefs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          keepalive: opts?.keepalive,
          body: JSON.stringify({
            prefsUpdate: {
              enabled: next._threadEnabled,
              thread: { uuid: threadUUID },
              ...diff,
            },
          }),
        })
      } else {
        res = await fetch('/api/user/prefs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          keepalive: opts?.keepalive,
          body: JSON.stringify({
            prefsUpdate: buildPrefsUpdate(next),
            counterUpdate: {},
          }),
        })
      }

      if (!res.ok) {
        const reason = await readErrorReason(res)
        console.error('[PrefsEditor] save failed', res.status, reason)
        if (mountedRef.current) {
          setSaveError(reason)
          setSaveState('error')
        }
        return false
      }

      if (sentKeys) for (const k of sentKeys) changedRef.current.delete(k)
      if (mountedRef.current) {
        setSaveError(null)
        setSaveState('saved')
        if (pendingRef.current === next) setDirty(false)
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
        savedTimerRef.current = setTimeout(() => {
          if (mountedRef.current) setSaveState(s => (s === 'saved' ? 'idle' : s))
        }, 2000)
      }
      return true
    } catch (e: any) {
      console.error('[PrefsEditor] save threw', e)
      if (mountedRef.current) {
        setSaveError('Couldn’t reach the server, so the change isn’t saved.')
        setSaveState('error')
      }
      return false
    }
  }, [scope, threadUUID])

  const saveRef = useRef(save)
  useEffect(() => { saveRef.current = save })

  const AUTOSAVE_MS = 800

  const flush = useCallback(() => {
    if (!saveTimerRef.current) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = null
    void saveRef.current(pendingRef.current, { keepalive: true })
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const onPageHide = () => flush()
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
      mountedRef.current = false
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    }
  }, [flush])

  function set<K extends keyof LocalPrefs>(key: K, value: LocalPrefs[K]) {
    const next = { ...pendingRef.current, [key]: value }
    pendingRef.current = next
    changedRef.current.add(key)
    setLocal(next)
    if (!autosaves) return
    setDirty(true)
    setSaveState(s => (s === 'saved' ? 'idle' : s))
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void saveRef.current(pendingRef.current)
    }, AUTOSAVE_MS)
  }

  const retry = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    void saveRef.current(pendingRef.current)
  }, [])

  const [resetting, setResetting] = useState(false)
  const resetThreadPrefs = useCallback(async () => {
    if (!threadUUID) return
    if (!window.confirm('Delete this thread’s preference overrides and go back to your site-wide settings?')) return
    setResetting(true)
    try {
      const res = await fetch(
        `/api/user/deleteThreadPrefs?threadUUID=${encodeURIComponent(threadUUID)}`,
        { method: 'DELETE', credentials: 'include' },
      )
      if (!res.ok) throw new Error(await readErrorReason(res))

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      changedRef.current.clear()
      const next = { ...pendingRef.current, _threadEnabled: false }
      pendingRef.current = next
      setLocal(next)
      setDirty(false)
      setSaveError(null)
      setSaveState('idle')
      setNotice('Thread prefs cleared')
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
      noticeTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setNotice(null)
      }, 3000)
    } catch (e: any) {
      setSaveError(e?.message || 'Couldn’t clear this thread’s prefs.')
      setSaveState('error')
    } finally {
      if (mountedRef.current) setResetting(false)
    }
  }, [threadUUID])

  const s = (key: keyof LocalPrefs) => (v: any) => set(key, v)
  const saving = saveState === 'saving'

  return (
    <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
      {autosaves && (
        <SaveStatusBar state={saveState} error={saveError} dirty={dirty} onRetry={retry} />
      )}

      {scope === 'thread' && (
        <div style={{ marginBottom: 12, padding: '8px 10px', background: local._threadEnabled ? 'rgba(249,115,22,0.1)' : 'rgb(var(--ink-rgb) / 0.04)', borderRadius: 8, border: '1px solid rgb(var(--ink-rgb) / 0.08)' }}>
          <PrefToggle
            label="Thread-specific prefs"
            value={local._threadEnabled}
            onChange={s('_threadEnabled')}
          />
        </div>
      )}

      <div style={{ opacity: scope === 'thread' && !local._threadEnabled ? 0.4 : 1, pointerEvents: scope === 'thread' && !local._threadEnabled ? 'none' : 'auto' }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Input</div>
        <PrefSelect label="Submit shortcut" value={local.pref_submit_shortcut} options={['Enter', 'CtrlEnter', 'Off']} onChange={s('pref_submit_shortcut')} />
        <PrefSelect label="After submit" value={local.pref_clear} options={['Clear', 'No Clear', 'Clipboard', 'Custom']} optionLabels={CLEAR_LABELS} onChange={s('pref_clear')} />

        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Display</div>
        {!UNIMPLEMENTED_PREFS.has('pref_post_style') && (
          <PrefSelect label={PREF_BY_KEY.pref_post_style.label} value={local.pref_post_style} options={PREF_BY_KEY.pref_post_style.options!} onChange={s('pref_post_style')} />
        )}
        {!UNIMPLEMENTED_PREFS.has('pref_post_style_mobile') && (
          <PrefSelect label={PREF_BY_KEY.pref_post_style_mobile.label} value={local.pref_post_style_mobile} options={PREF_BY_KEY.pref_post_style_mobile.options!} onChange={s('pref_post_style_mobile')} />
        )}
        {!UNIMPLEMENTED_PREFS.has('pref_post_position') && (
          <PrefSelect label="Post position" value={local.pref_post_position} options={['Left', 'Right']} onChange={s('pref_post_position')} />
        )}
        <PrefToggle label={PREF_BY_KEY.pref_load_from_bottom.label} value={local.pref_load_from_bottom} onChange={s('pref_load_from_bottom')} />
        {!UNIMPLEMENTED_PREFS.has('pref_time_since_last_count') && (
          <PrefToggle label="Time since last count" value={local.pref_time_since_last_count} onChange={s('pref_time_since_last_count')} />
        )}
        <PrefNumber label="Reply time interval (ms)" value={local.pref_reply_time_interval} min={1} max={10000} onChange={s('pref_reply_time_interval')} />
        <PrefNumber label="Post font size (px)" value={local.pref_post_font_size} min={10} max={32} onChange={s('pref_post_font_size')} />

        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Stricken counts</div>
        <PrefSelect label="Hide stricken" value={local.pref_hide_stricken} options={['Disabled', 'Minimize', 'Hide']} onChange={s('pref_hide_stricken')} />
        <PrefSelect label="Custom stricken" value={local.pref_custom_stricken} options={['Disabled', 'Enabled', 'Inverse']} onChange={s('pref_custom_stricken')} />
        {local.pref_custom_stricken !== 'Disabled' && (
          <PrefColor label="Strike color" value={local.pref_strike_color} onChange={s('pref_strike_color')} />
        )}
        <PrefNumber label="Stricken opacity" value={local.pref_stricken_count_opacity} min={0} max={1} step={0.01} onChange={s('pref_stricken_count_opacity')} />

        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Notifications</div>
        <PrefSelect label="Sound on stricken" value={local.pref_sound_on_stricken} options={['Disabled', 'Only My Counts', 'All Stricken']} onChange={s('pref_sound_on_stricken')} />
        <PrefToggle label="Highlight last count" value={local.pref_highlight_last_count} onChange={s('pref_highlight_last_count')} />
        {local.pref_highlight_last_count && (
          <PrefColor label="Highlight color" value={local.pref_highlight_last_count_color} onChange={s('pref_highlight_last_count_color')} />
        )}

        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Theme</div>
        {!UNIMPLEMENTED_PREFS.has('pref_nightMode') && (
          <PrefSelect label="Night mode" value={local.pref_nightMode} options={['System', 'On', 'Off']} onChange={s('pref_nightMode')} />
        )}
        {!UNIMPLEMENTED_PREFS.has('pref_night_mode_colors') && (
          <PrefSelect label="Night mode colors" value={local.pref_night_mode_colors} options={['Default', 'Light', 'Dark']} onChange={s('pref_night_mode_colors')} />
        )}
        <PrefSelect label="Standardize format" value={local.pref_standardize_format} options={['Disabled', 'No Separator', 'Commas', 'Periods', 'Spaces']} onChange={s('pref_standardize_format')} />

        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Pace</div>
        <PrefSelect label={PREF_BY_KEY.pref_pace_mode.label} value={local.pref_pace_mode} options={PREF_BY_KEY.pref_pace_mode.options!} onChange={s('pref_pace_mode')} />
        {local.pref_pace_mode === 'Counts' && (
          <PrefNumber label={PREF_BY_KEY.pref_pace_counts.label} value={local.pref_pace_counts} onChange={s('pref_pace_counts')} />
        )}

        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Misc</div>
        <PrefToggle label="Show latency" value={local.pref_show_latency} onChange={s('pref_show_latency')} />
        {!UNIMPLEMENTED_PREFS.has('pref_timestamp_display') && (
          <PrefSelect label={PREF_BY_KEY.pref_timestamp_display.label} value={local.pref_timestamp_display} options={PREF_BY_KEY.pref_timestamp_display.options!} onChange={s('pref_timestamp_display')} />
        )}
        {!UNIMPLEMENTED_PREFS.has('pref_hide_thread_picker') && (
          <PrefToggle label="Hide thread picker" value={local.pref_hide_thread_picker} onChange={s('pref_hide_thread_picker')} />
        )}
        {scope === 'site' && (
          <PrefSelect label={PREF_BY_KEY.pref_chat_default.label} value={local.pref_chat_default ?? 'Hidden'} options={PREF_BY_KEY.pref_chat_default.options!} onChange={s('pref_chat_default')} />
        )}
        {!UNIMPLEMENTED_PREFS.has('pref_online') && (
          <PrefToggle label="Online status" value={local.pref_online} onChange={s('pref_online')} />
        )}
        {!UNIMPLEMENTED_PREFS.has('pref_discord_pings') && (
          <PrefToggle label="Discord pings" value={local.pref_discord_pings} onChange={s('pref_discord_pings')} />
        )}
      </div>

      <DevicePerfPrefs />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
        {(!autosaves || saveState === 'error') && (
          <button
            onClick={autosaves ? retry : () => { void save(pendingRef.current) }}
            disabled={saving}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: saving ? 'default' : 'pointer',
              background: autosaves ? 'var(--danger)' : '#f97316', color: '#fff', fontWeight: 700, fontSize: 13,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : autosaves ? 'Retry' : 'Save'}
          </button>
        )}
        {scope === 'thread' && threadUUID && (
          <button
            onClick={resetThreadPrefs}
            disabled={resetting || saving}
            title="Delete this thread's overrides and fall back to your site-wide prefs"
            style={{
              padding: '8px 14px', borderRadius: 8, cursor: resetting ? 'default' : 'pointer',
              border: '1px solid rgba(239,68,68,0.4)', background: 'transparent',
              color: 'var(--danger)', fontWeight: 700, fontSize: 12,
              opacity: resetting || saving ? 0.5 : 1,
            }}
          >
            {resetting ? 'Clearing…' : 'Reset for this thread'}
          </button>
        )}
        {notice && (
          <span style={{ fontSize: 12, color: 'var(--success-ink)' }}>{notice}</span>
        )}
        {saveState === 'error' && (
          <span style={{ fontSize: 12, color: 'var(--danger)' }}>Not saved! See the message above.</span>
        )}
      </div>
    </div>
  )
}

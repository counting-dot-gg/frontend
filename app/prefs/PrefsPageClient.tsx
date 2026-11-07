'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { setFeatsEnabled } from '@/lib/feats'
import { PREF_BY_KEY } from '@/lib/prefsCatalog'
import { UNIMPLEMENTED_PREFS } from '@/lib/prefs'
import type { ResolvedPrefs } from '@/lib/prefs'
import { getInterpolatedReplyColor, REPLY_BADGE_INK, formatTimeSince, standardizeCountFormat } from '@/lib/postHelpers'
import { applyTheme } from '@/lib/theme'
import type { Counter, Item } from '@/lib/types'
import type { PrefStats } from './page'

import { API } from '@/lib/apiBase'

const CLEAR_OPTIONS = ['Clear', 'No Clear', 'Clipboard', 'Custom']
const CLEAR_LABELS: Record<string, string> = { Custom: 'Auto-paste' }
const SUBMIT_SHORTCUT_OPTIONS = ['CtrlEnter', 'Enter', 'Off']
const POST_STYLE_OPTIONS = ['Default', 'Classic', 'LC', 'Minimal']
const CUSTOM_STRICKEN_OPTIONS = ['Disabled', 'Enabled', 'Inverse']
const HIDE_STRICKEN_OPTIONS = ['Disabled', 'Minimize', 'Hide']
const SOUND_ON_STRICKEN_OPTIONS = ['Disabled', 'All Stricken', 'Only My Counts']
const NIGHT_MODE_OPTIONS = ['System', 'On', 'Off']
const NIGHT_MODE_COLOR_OPTIONS = ['Default', 'Light', 'Dark']
const STANDARDIZE_FORMAT_OPTIONS = ['Disabled', 'No Separator', 'Commas', 'Periods', 'Spaces']
const POST_POSITION_OPTIONS = ['Left', 'Right']

const PRONOUN_OPTIONS: [string, string, string, string][] = [
  ['he', 'him', 'his', 'his'],
  ['she', 'her', 'her', 'hers'],
  ['they', 'them', 'their', 'theirs'],
]
const pronounLabel = (p: readonly string[]) => `${p[0]}/${p[1]}`

type ProfileDraft = {
  name: string
  color: string
  rainbow: number
  cardStyle: string
  cardBorderStyle: string
  title: string
  emoji: string
  pronouns: [string, string, string, string]
}

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 7, fontSize: '0.82rem',
  border: '1px solid rgb(var(--ink-rgb) / 0.12)', background: 'rgb(var(--ink-rgb) / 0.03)',
  color: 'var(--ink-1)',
}

function Dropdown({ value, options, onChange, emptyLabel }: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  emptyLabel?: string
}) {
  const known = options.some(o => o.value === value)
  const all = !known && value ? [{ value, label: `${value} (current)` }, ...options] : options
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={fieldStyle}>
      {emptyLabel != null && <option value="">{emptyLabel}</option>}
      {all.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>{title}</h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>{children}</div>
    </section>
  )
}

function Row({ label, stat, control, example }: {
  label: string
  stat?: React.ReactNode
  control: React.ReactNode
  example?: React.ReactNode
}) {
  return (
    <div className="prefs-row" style={{
      display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(220px,320px)', gap: 20,
      padding: '16px 18px', background: 'rgb(var(--ink-rgb) / 0.025)', border: '1px solid rgb(var(--ink-rgb) / 0.06)',
      borderRadius: 10, alignItems: 'start',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 0 }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{label}</span>
          {stat}
        </div>
        {example}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        {control}
      </div>
    </div>
  )
}

function OptionStat({ stats, option }: { stats: Record<string, number> | undefined; option: string }) {
  const pct = stats?.[option]
  if (pct == null) return null
  const isTop = Object.entries(stats!).every(([k, v]) => k === option || v <= pct)
  return (
    <span style={{
      fontSize: '0.68rem', fontFamily: 'var(--font-mono)', padding: '1px 6px', borderRadius: 4,
      background: isTop && pct > 0 ? 'rgba(249,115,22,0.16)' : 'rgb(var(--ink-rgb) / 0.06)',
      color: isTop && pct > 0 ? '#f97316' : 'var(--ink-3)',
      fontWeight: isTop ? 700 : 400,
    }}>
      {pct}% {isTop && pct > 0 ? '· most used' : ''}
    </span>
  )
}

function BoolStat({ stats, value }: { stats: Record<string, number> | undefined; value: boolean }) {
  return <OptionStat stats={stats} option={value ? '1' : '0'} />
}

function SegmentedControl({ value, options, onChange, statsForOption, optionLabels }: {
  value: string
  options: string[]
  onChange: (v: string) => void
  statsForOption?: (opt: string) => Record<string, number> | undefined
  optionLabels?: Record<string, string>
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', width: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 5, width: '100%' }}>
        {options.map(opt => {
          const active = value === opt
          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              style={{
                padding: '6px 12px', borderRadius: 7, fontSize: '0.78rem', fontWeight: active ? 700 : 500,
                border: `1px solid ${active ? '#f97316' : 'rgb(var(--ink-rgb) / 0.12)'}`,
                background: active ? 'rgba(249,115,22,0.14)' : 'rgb(var(--ink-rgb) / 0.03)',
                color: active ? '#f97316' : 'var(--ink-2)', cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.12s',
              }}
            >
              {optionLabels?.[opt] ?? opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: value ? '#f97316' : 'rgb(var(--ink-rgb) / 0.12)', position: 'relative', transition: 'background 0.15s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: value ? 21 : 3, width: 18, height: 18, borderRadius: 9,
        background: '#fff', transition: 'left 0.15s',
      }} />
    </button>
  )
}

function NumberField({ value, min, max, step, suffix, onChange }: {
  value: number; min?: number; max?: number; step?: number; suffix?: string; onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        type="number" value={value} min={min} max={max} step={step}
        onChange={e => {
          let n = step != null && step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10)
          if (!Number.isFinite(n)) return
          if (min != null) n = Math.max(min, n)
          if (max != null) n = Math.min(max, n)
          onChange(n)
        }}
        style={{
          width: 80, background: 'rgb(var(--ink-rgb) / 0.05)', border: '1px solid rgb(var(--ink-rgb) / 0.12)',
          borderRadius: 6, padding: '6px 8px', fontSize: '0.82rem', color: 'var(--ink-1)', outline: 'none',
          fontFamily: 'var(--font-mono)', textAlign: 'right',
        }}
      />
      {suffix && <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>{suffix}</span>}
    </div>
  )
}

function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        type="color" value={value} onChange={e => onChange(e.target.value)}
        style={{ width: 30, height: 26, padding: 0, border: '1px solid rgb(var(--ink-rgb) / 0.15)', borderRadius: 5, cursor: 'pointer', background: 'none' }}
      />
      <input
        type="text" value={value} maxLength={7}
        onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onChange(e.target.value) }}
        style={{
          width: 78, background: 'rgb(var(--ink-rgb) / 0.05)', border: '1px solid rgb(var(--ink-rgb) / 0.12)',
          borderRadius: 6, padding: '6px 8px', fontSize: '0.78rem', color: 'var(--ink-1)', outline: 'none', fontFamily: 'var(--font-mono)',
        }}
      />
    </div>
  )
}

function ExampleBox({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      {label && <div style={{ fontSize: '0.68rem', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 700 }}>{label}</div>}
      <div style={{
        background: 'var(--surface-2)', border: '1px solid rgb(var(--ink-rgb) / 0.07)', borderRadius: 8,
        padding: '10px 12px', fontFamily: 'var(--font-mono)',
      }}>
        {children}
      </div>
    </div>
  )
}

function SaveToast({ state, error }: { state: 'idle' | 'saving' | 'saved' | 'error'; error?: string | null }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (state === 'idle') {
      setVisible(false)
      return
    }
    setVisible(true)
    if (state === 'saved') {
      const t = setTimeout(() => setVisible(false), 1800)
      return () => clearTimeout(t)
    }
  }, [state])

  const label = state === 'saving' ? 'Saving…'
    : state === 'saved' ? '✓ Saved'
    : state === 'error' ? (error || 'Failed to save: retrying on next change')
    : ''
  const color = state === 'error' ? 'var(--danger)' : 'var(--success-ink)'
  const bg = state === 'error' ? 'rgba(239,68,68,0.14)' : 'rgba(34,197,94,0.14)'

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', top: 80, left: '50%', zIndex: 500,
        padding: '9px 16px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700,
        background: bg, color, border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
        boxShadow: '0 8px 24px rgb(var(--shadow-rgb) / 0.35)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translate(-50%, 0)' : 'translate(-50%, -8px)',
        transition: 'opacity 0.18s, transform 0.18s',
        pointerEvents: 'none',
      }}
    >
      {label || ' '}
    </div>
  )
}

function ClearExample({ mode }: { mode: string }) {
  const [text, setText] = useState('12345count')
  const [keep, setKeep] = useState(5)
  const [del, setDel] = useState(0)
  const [clipboard, setClipboard] = useState('pasted-from-clipboard')
  const [custom, setCustom] = useState('my-prefix-')
  const inputRef = useRef<HTMLInputElement>(null)

  const simulate = () => {
    const input = inputRef.current
    if (!input) return
    if (mode === 'Clear') {
      input.value = ''
    } else if (mode === 'Clipboard') {
      input.value = clipboard
    } else if (mode === 'Custom') {
      input.value = custom
    } else if (mode === 'No Clear') {
      const current = input.value
      const keepCount = Math.max(0, keep)
      const deleteCount = Math.max(0, del)
      const kept = current.substring(0, Math.min(keepCount, current.length))
      const cursor = Math.max(0, Math.min(input.selectionStart ?? kept.length, kept.length))
      const deleteStart = Math.max(0, cursor - deleteCount)
      input.value = kept.substring(0, deleteStart) + kept.substring(cursor)
    }
    setText(input.value)
  }

  return (
    <ExampleBox label="Try it: type in the box, hit &quot;Submit&quot;">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          ref={inputRef}
          defaultValue={text}
          onChange={e => setText(e.target.value)}
          style={{
            flex: 1, minWidth: 140, background: 'rgb(var(--ink-rgb) / 0.05)', border: '1px solid rgb(var(--ink-rgb) / 0.15)',
            borderRadius: 6, padding: '6px 10px', fontSize: '0.85rem', color: 'var(--ink-1)', outline: 'none', fontFamily: 'var(--font-mono)',
          }}
        />
        <button
          onClick={simulate}
          style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#f97316', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
        >
          Submit
        </button>
      </div>
      {mode === 'No Clear' && (
        <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: '0.78rem', color: 'var(--ink-3)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Keep
            <input type="number" value={keep} min={0} onChange={e => setKeep(parseInt(e.target.value, 10) || 0)}
              style={{ width: 50, background: 'rgb(var(--ink-rgb) / 0.05)', border: '1px solid rgb(var(--ink-rgb) / 0.12)', borderRadius: 4, padding: '3px 6px', color: 'var(--ink-1)', fontFamily: 'var(--font-mono)' }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Delete
            <input type="number" value={del} min={0} onChange={e => setDel(parseInt(e.target.value, 10) || 0)}
              style={{ width: 50, background: 'rgb(var(--ink-rgb) / 0.05)', border: '1px solid rgb(var(--ink-rgb) / 0.12)', borderRadius: 4, padding: '3px 6px', color: 'var(--ink-1)', fontFamily: 'var(--font-mono)' }} />
          </label>
          <span style={{ color: 'var(--ink-3)' }}>from cursor, backward</span>
        </div>
      )}
      {mode === 'Clipboard' && (
        <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--ink-3)' }}>
          Simulated clipboard contents: <code style={{ color: 'var(--ink-3)' }}>{clipboard}</code>
        </div>
      )}
      {mode === 'Custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Auto-paste text:</span>
          <input
            value={custom} onChange={e => setCustom(e.target.value)}
            style={{ flex: 1, background: 'rgb(var(--ink-rgb) / 0.05)', border: '1px solid rgb(var(--ink-rgb) / 0.12)', borderRadius: 5, padding: '4px 8px', fontSize: '0.75rem', color: 'var(--ink-1)', fontFamily: 'var(--font-mono)' }}
          />
        </div>
      )}
    </ExampleBox>
  )
}

function ReplyColorExample({ interval }: { interval: number }) {
  const samples = [0, interval * 0.5, interval, interval * 3, interval * 6, interval * 10]
  return (
    <ExampleBox label={`Reply-time colors at ${interval}ms buckets`}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {samples.map((ms, i) => {
          const { h, m, s, ms: msRem } = formatTimeSince(ms)
          const label = h > 0 ? `${h}h` : m > 0 ? `${m}m` : s > 0 ? `${s}s` : `${msRem}ms`
          return (
            <div key={i} style={{
              background: getInterpolatedReplyColor(ms, interval), color: REPLY_BADGE_INK, fontSize: '0.72rem',
              padding: '4px 8px', borderRadius: 4, fontWeight: 600,
            }}>
              {label}
            </div>
          )
        })}
      </div>
    </ExampleBox>
  )
}

function StrickenExample({ mode, color, opacity, hideMode }: { mode: string; color: string; opacity: number; hideMode: string }) {
  const [expanded, setExpanded] = useState(hideMode !== 'Minimize')
  useEffect(() => { setExpanded(hideMode !== 'Minimize') }, [hideMode])

  const bg = mode === 'Disabled' ? 'transparent' : color
  const invert = mode === 'Inverse' ? 'invert(1)' : 'none'

  return (
    <ExampleBox label="A stricken (invalid) post">
      {!expanded ? (
        <span onClick={() => setExpanded(true)} style={{ cursor: 'pointer', fontSize: '0.78rem', color: '#7a8296' }}>
          [+] Show hidden post
        </span>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: bg, filter: invert, opacity }}>
          <span style={{ fontSize: '0.9rem', fontFamily: 'var(--font-mono)', fontWeight: 600, textDecoration: 'line-through', color: '#7a8296' }}>4821</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--ink-2)' }}>someone</span>
        </div>
      )}
      {hideMode === 'Minimize' && expanded && (
        <div style={{ fontSize: '0.7rem', color: 'var(--ink-3)', marginTop: 4 }}>click the number to re-collapse in the real feed</div>
      )}
    </ExampleBox>
  )
}

function StandardizeFormatExample({ mode }: { mode: string }) {
  const sample = '4821 392'
  return (
    <ExampleBox label={`A count typed as "${sample}"`}>
      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink-1)' }}>
        {standardizeCountFormat(sample, mode, 'main')}
      </span>
    </ExampleBox>
  )
}

function PostFontSizeExample({ size }: { size: number }) {
  return (
    <ExampleBox label="A post at this size">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: `${size}px`, fontWeight: 600, color: 'var(--ink-1)' }}>48213</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--ink-2)' }}>someone</span>
      </div>
    </ExampleBox>
  )
}

function HighlightExample({ enabled, color }: { enabled: boolean; color: string }) {
  return (
    <ExampleBox label="The most recent valid count in a thread">
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6,
        border: enabled ? `1px solid ${color}` : '1px solid transparent',
        background: enabled ? `${color}1c` : 'transparent',
      }}>
        <span style={{ fontSize: '0.9rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: enabled ? color : 'var(--ink-1)' }}>48213</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--ink-2)' }}>latest_counter</span>
      </div>
    </ExampleBox>
  )
}

type Props = {
  initialPrefs: ResolvedPrefs
  prefStats: PrefStats
  username: string
  counter: Counter
  items: Item[]
}

export default function PrefsPageClient({ initialPrefs, prefStats, username, counter, items }: Props) {
  const [prefs, setPrefs] = useState<ResolvedPrefs>(initialPrefs)
  useEffect(() => { setFeatsEnabled(prefs.pref_milestones) }, [prefs.pref_milestones])
  const [profile, setProfile] = useState<ProfileDraft>(() => ({
    name: counter.name ?? '',
    color: counter.color ?? '#cccccc',
    rainbow: counter.rainbow ?? 1,
    cardStyle: counter.cardStyle ?? '',
    cardBorderStyle: counter.cardBorderStyle ?? '',
    title: counter.title ?? '',
    emoji: counter.emoji ?? '',
    pronouns: counter.pronouns ?? ['they', 'them', 'their', 'theirs'],
  }))
  const profileRef = useRef<ProfileDraft>(profile)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<ResolvedPrefs>(initialPrefs)
  const changedRef = useRef<Set<keyof ResolvedPrefs>>(new Set())

  const save = useCallback(async (next: ResolvedPrefs) => {
    setSaveState('saving')
    let sentKeys: Set<keyof ResolvedPrefs> | null = null
    try {
      const p = profileRef.current
      const counterUpdate = {
        ...(p.emoji ? { emoji: p.emoji } : {}),
        name: p.name,
        username: counter.username,
        color: p.color,
        rainbow: p.rainbow,
        cardStyle: p.cardStyle,
        cardBorderStyle: p.cardBorderStyle,
        pronouns: p.pronouns,
        title: p.title,
      }
      const prefsUpdate: Record<string, unknown> = {}
      for (const key of changedRef.current) prefsUpdate[key as string] = next[key]
      sentKeys = new Set(changedRef.current)
      const res = await fetch(`${API}/api/user/prefs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prefsUpdate, counterUpdate }),
      })
      if (!res.ok) {
        let reason = `The server rejected the save (${res.status}).`
        try {
          const body = await res.json()
          if (typeof body?.message === 'string' && body.message) reason = body.message
        } catch {}
        setSaveError(reason)
        setSaveState('error')
        return
      }
      if (sentKeys) for (const k of sentKeys) changedRef.current.delete(k)
      setSaveError(null)
      setSaveState('saved')
      setTimeout(() => setSaveState(s => (s === 'saved' ? 'idle' : s)), 2000)
    } catch {
      setSaveError('Couldn’t reach the server. Your change isn’t saved.')
      setSaveState('error')
    }
  }, [counter])

  function set<K extends keyof ResolvedPrefs>(key: K, value: ResolvedPrefs[K]) {
    if (key === 'pref_nightMode') applyTheme(value as string)
    setPrefs(prev => {
      const next = { ...prev, [key]: value }
      pendingRef.current = next
      changedRef.current.add(key)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => save(pendingRef.current), 500)
      return next
    })
  }

  function setProfileField<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setProfile(prev => {
      const next = { ...prev, [key]: value }
      profileRef.current = next
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => save(pendingRef.current), 500)
      return next
    })
  }

  const byCategory = useMemo(() => {
    const m: Record<string, { value: string; label: string }[]> = {}
    for (const it of items ?? []) {
      if (!it?.category || !it.internal_name) continue
      if (!m[it.category]) m[it.category] = []
      m[it.category].push({ value: it.internal_name, label: it.name || it.internal_name })
    }
    return m
  }, [items])

  const s = <K extends keyof ResolvedPrefs>(key: K) => (v: ResolvedPrefs[K]) => set(key, v)
  const statsFor = (col: string) => prefStats[col]

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 100px' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: '0 0 8px', letterSpacing: '-0.02em' }}>Preferences</h1>

      <SaveToast state={saveState} error={saveError} />

      <Section
        title="Profile"
      >
        <Row
          label="Display Name"
          control={
            <input
              value={profile.name}
              maxLength={32}
              onChange={e => setProfileField('name', e.target.value)}
              style={fieldStyle}
            />
          }
        />
        <Row
          label="Colour"
          control={
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(profile.color) ? profile.color : '#cccccc'}
                onChange={e => setProfileField('color', e.target.value)}
                style={{
                  width: 44, height: 34, padding: 0, borderRadius: 7, flexShrink: 0,
                  border: '1px solid rgb(var(--ink-rgb) / 0.12)', background: 'none', cursor: 'pointer',
                }}
              />
              <input
                value={profile.color}
                spellCheck={false}
                onChange={e => setProfileField('color', e.target.value)}
                style={{ ...fieldStyle, fontFamily: 'var(--font-mono)' }}
              />
            </div>
          }
        />
        <Row
          label="Rainbow reply time"
          control={
            <input
              type="number"
              min={1}
              max={100000}
              step={1}
              value={profile.rainbow}
              onChange={e => {
                const n = parseInt(e.target.value, 10)
                if (Number.isFinite(n) && n >= 1 && n <= 100_000) setProfileField('rainbow', n)
              }}
              style={fieldStyle}
            />
          }
        />
        <Row
          label="Pronouns"
          control={
            <SegmentedControl
              value={pronounLabel(profile.pronouns)}
              options={PRONOUN_OPTIONS.map(pronounLabel)}
              onChange={v => {
                const match = PRONOUN_OPTIONS.find(p => pronounLabel(p) === v)
                if (match) setProfileField('pronouns', match)
              }}
            />
          }
        />
        <Row
          label="Title"
          control={
            <Dropdown
              value={profile.title}
              options={byCategory.title ?? []}
              onChange={v => setProfileField('title', v)}
              emptyLabel="None"
            />
          }
        />
        <Row
          label="Emoji"
          control={
            <Dropdown
              value={profile.emoji}
              options={byCategory.emoji ?? []}
              onChange={v => setProfileField('emoji', v)}
              emptyLabel="None"
            />
          }
        />
        <Row
          label="Card style"
          control={
            <Dropdown
              value={profile.cardStyle}
              options={byCategory.card ?? []}
              onChange={v => setProfileField('cardStyle', v)}
            />
          }
        />
        <Row
          label="Card border"
          control={
            <Dropdown
              value={profile.cardBorderStyle}
              options={byCategory.border ?? []}
              onChange={v => setProfileField('cardBorderStyle', v)}
            />
          }
        />
      </Section>

      <Section title="Input">
        <Row
          label="Submit shortcut"
          stat={<OptionStat stats={statsFor('pref_submit_shortcut')} option={prefs.pref_submit_shortcut} />}
          control={<SegmentedControl value={prefs.pref_submit_shortcut} options={SUBMIT_SHORTCUT_OPTIONS} onChange={s('pref_submit_shortcut')} />}
        />
        <Row
          label="After submit"
          stat={<OptionStat stats={statsFor('pref_clear')} option={prefs.pref_clear} />}
          control={<SegmentedControl value={prefs.pref_clear} options={CLEAR_OPTIONS} optionLabels={CLEAR_LABELS} onChange={s('pref_clear')} />}
          example={<ClearExample mode={prefs.pref_clear} />}
        />
      </Section>

      <Section title="Stricken counts">
        <Row
          label="Custom stricken styling"
          stat={<OptionStat stats={statsFor('pref_custom_stricken')} option={prefs.pref_custom_stricken} />}
          control={<SegmentedControl value={prefs.pref_custom_stricken} options={CUSTOM_STRICKEN_OPTIONS} onChange={s('pref_custom_stricken')} />}
        />
        {prefs.pref_custom_stricken !== 'Disabled' && (
          <Row
            label="Strike color"
            control={<ColorField value={prefs.pref_strike_color} onChange={s('pref_strike_color')} />}
          />
        )}
        <Row
          label="Hide stricken"
          stat={<OptionStat stats={statsFor('pref_hide_stricken')} option={prefs.pref_hide_stricken} />}
          control={<SegmentedControl value={prefs.pref_hide_stricken} options={HIDE_STRICKEN_OPTIONS} onChange={s('pref_hide_stricken')} />}
          example={<StrickenExample mode={prefs.pref_custom_stricken} color={prefs.pref_strike_color} opacity={prefs.pref_stricken_count_opacity} hideMode={prefs.pref_hide_stricken} />}
        />
        <Row
          label="Stricken opacity"
          control={<NumberField value={prefs.pref_stricken_count_opacity} min={0} max={1} step={0.05} onChange={s('pref_stricken_count_opacity')} />}
        />
      </Section>

      <Section title="Highlights & sound">
        <Row
          label="Highlight last count"
          stat={<BoolStat stats={statsFor('pref_highlight_last_count')} value={prefs.pref_highlight_last_count} />}
          control={<Toggle value={prefs.pref_highlight_last_count} onChange={s('pref_highlight_last_count')} />}
          example={<HighlightExample enabled={prefs.pref_highlight_last_count} color={prefs.pref_highlight_last_count_color} />}
        />
        {prefs.pref_highlight_last_count && (
          <Row
            label="Highlight color"
            control={<ColorField value={prefs.pref_highlight_last_count_color} onChange={s('pref_highlight_last_count_color')} />}
          />
        )}
        <Row
          label="Sound on stricken"
          stat={<OptionStat stats={statsFor('pref_sound_on_stricken')} option={prefs.pref_sound_on_stricken} />}
          control={<SegmentedControl value={prefs.pref_sound_on_stricken} options={SOUND_ON_STRICKEN_OPTIONS} onChange={s('pref_sound_on_stricken')} />}
        />
      </Section>

      <Section title="Display">
        <Row
          label="Post font size"
          control={<NumberField value={prefs.pref_post_font_size} min={10} max={32} suffix="px" onChange={s('pref_post_font_size')} />}
          example={<PostFontSizeExample size={prefs.pref_post_font_size} />}
        />
        <Row
          label="Standardize format"
          stat={<OptionStat stats={statsFor('pref_standardize_format')} option={prefs.pref_standardize_format} />}
          control={<SegmentedControl value={prefs.pref_standardize_format} options={STANDARDIZE_FORMAT_OPTIONS} onChange={s('pref_standardize_format')} />}
          example={<StandardizeFormatExample mode={prefs.pref_standardize_format} />}
        />
        <Row
          label="Reply time interval"
          control={<NumberField value={prefs.pref_reply_time_interval} min={1} max={10000} suffix="ms" onChange={s('pref_reply_time_interval')} />}
          example={<ReplyColorExample interval={prefs.pref_reply_time_interval} />}
        />
        <Row
          label="Show latency"
          stat={<BoolStat stats={statsFor('pref_show_latency')} value={prefs.pref_show_latency} />}
          control={<Toggle value={prefs.pref_show_latency} onChange={s('pref_show_latency')} />}
        />
      </Section>

      <Section title="Layout">
        {([
          'pref_post_style',
          'pref_post_style_mobile',
          'pref_post_position',
          'pref_timestamp_display',
          'pref_load_from_bottom',
          'pref_hide_thread_picker',
        ] as const).map(key => {
          const def = PREF_BY_KEY[key]
          if (!def || UNIMPLEMENTED_PREFS.has(key)) return null
          return (
            <Row
              key={key}
              label={def.label}
              control={def.kind === 'toggle'
                ? <Toggle value={prefs[key] as boolean} onChange={s(key)} />
                : <SegmentedControl value={prefs[key] as string} options={def.options ?? []} onChange={s(key)} />}
            />
          )
        })}
      </Section>

      <Section title="Pace &amp; chat">
        {([
          'pref_pace_mode',
          'pref_chat_default',
          'pref_milestones',
        ] as const).map(key => {
          const def = PREF_BY_KEY[key]
          if (!def || UNIMPLEMENTED_PREFS.has(key)) return null
          return (
            <Row
              key={key}
              label={def.label}
              control={def.kind === 'toggle'
                ? <Toggle value={prefs[key] as boolean} onChange={s(key)} />
                : <SegmentedControl value={prefs[key] as string} options={def.options ?? []} onChange={s(key)} />}
            />
          )
        })}
        {prefs.pref_pace_mode === 'Counts' && (
          <Row
            label="Counts per run"
            control={<NumberField value={prefs.pref_pace_counts} min={2} max={100000} onChange={s('pref_pace_counts')} />}
          />
        )}
      </Section>

      <Section title="Theme">
        <Row
          label="Night mode"
          stat={<OptionStat stats={statsFor('pref_nightMode')} option={prefs.pref_nightMode} />}
          control={<SegmentedControl value={prefs.pref_nightMode} options={NIGHT_MODE_OPTIONS} onChange={s('pref_nightMode')} />}
        />
      </Section>

    </div>
  )
}

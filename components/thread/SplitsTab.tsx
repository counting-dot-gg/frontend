'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  subscribePace, setPaceTarget,
  setPaceRunning,
  getPaceRunning,
  setPaceCounts, getPaceCounts,
  getPaceTarget, formatDelta,
  setTargetSplitMs, getTargetSplitMs,
  type PaceState, type PaceTarget,
} from '@/lib/paceClock'
import { scaleY, Y_TICKS, formatClock } from '@/lib/paceScale'
import { usePrefs } from './PrefsContext'

interface Split {
  number: string
  split: number
  replay?: string
}

function fancyTime(ms: number): string {
  const hours = Math.floor(ms / 3_600_000)
  ms %= 3_600_000
  const minutes = Math.floor(ms / 60_000)
  ms %= 60_000
  const seconds = Math.floor(ms / 1_000)
  const millis = (ms % 1_000).toString().padStart(3, '0')
  const hStr = hours > 0 ? `${hours}:` : ''
  const mStr = hours > 0 ? String(minutes).padStart(2, '0') + ':' : minutes > 0 ? `${minutes}:` : ''
  const sStr = (hours > 0 || minutes > 0) ? String(seconds).padStart(2, '0') : String(seconds)
  return `${hStr}${mStr}${sStr}.${millis}`
}

function countsPerSecond(s: Split, countsPerSplit: number, splitsPerGet: number): string {
  const isGet = s.number.endsWith(' (Get)') || s.number.endsWith(' (K)')
  const counts = isGet ? countsPerSplit * splitsPerGet : countsPerSplit
  if (!(s.split > 0) || !(counts > 0)) return ''
  const cps = counts / (s.split / 1000)
  return cps < 0.01 ? '–' : cps.toFixed(2)
}

interface SplitsTabProps {
  splits: Split[]
  countsPerSplit?: number
  splitsPerGet?: number
  threadUUID?: string
  isLoggedIn?: boolean
}


function PaceClock({ threadUUID, isLoggedIn }: {
  threadUUID?: string
  isLoggedIn?: boolean
}) {
  const prefs = usePrefs()
  const [pace, setPace] = useState<PaceState | null>(null)
  const [target, setTarget] = useState<PaceTarget>(
    prefs.pref_pace_mode === 'Get' ? 'get'
      : prefs.pref_pace_mode === 'Counts' ? 'counts'
      : prefs.pref_pace_mode === 'Split' ? 'split'
      : getPaceTarget(),
  )
  const [runCounts, setRunCounts] = useState<number>(getPaceCounts())
  const [targetMs, setTargetMs] = useState<number | null>(
    getTargetSplitMs() ?? (Number(prefs.pref_pace_target_ms) > 0 ? Number(prefs.pref_pace_target_ms) : null),
  )
  const [running, setRunning] = useState<boolean>(getPaceRunning())

  useEffect(() => subscribePace(setPace), [])

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  const persist = useCallback((patch: Record<string, unknown>) => {
    if (!threadUUID || !isLoggedIn) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch('/api/user/threadPacePrefs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadUUID, ...patch }),
      }).catch(() => {})
    }, 600)
  }, [threadUUID, isLoggedIn])

  const label = formatDelta(pace?.delta ?? null)
  const delta = pace?.delta ?? null
  const color = delta == null
    ? 'var(--thread-muted)'
    : delta > 0 ? 'var(--success)' : 'var(--danger)'
  const colorOpacity = delta != null && Math.abs(delta) < 1 ? 0.65 : 1

  return (
    <div style={{ padding: '6px 0 16px', textAlign: 'center' }}>
      <div style={{
        fontSize: 46, fontWeight: 900, lineHeight: 1, color, opacity: colorOpacity,
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em',
      }}>
        {label ?? '--'}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color, opacity: colorOpacity, letterSpacing: '0.08em', marginTop: 2 }}>
        {delta == null ? 'MEASURING'
          : Math.abs(delta) < 1 ? 'ON PACE'
          : delta > 0 ? 'COUNTS AHEAD' : 'COUNTS BEHIND'}
      </div>

      {pace?.nextTarget != null && (
        <div style={{ marginTop: 12 }}>
          <div style={{
            fontSize: 22, fontWeight: 800,
            color: (pace.countdownMs ?? 0) < 0 ? 'var(--danger)' : 'var(--thread-ink)',
            fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
          }}>
            {(pace.countdownMs ?? 0) < 0 ? '+' : ''}
            {formatClock(Math.abs(pace.countdownMs ?? pace.etaMs ?? 0))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--thread-muted)', letterSpacing: '0.06em', marginTop: 1 }}>
            TO #{(pace.nextTargetDisplay ?? pace.nextTarget).toLocaleString()}
          </div>
          {pace.refMsPerCount != null && (
            <div style={{ fontSize: 10, color: 'var(--thread-muted)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              target {Math.round(pace.refMsPerCount)}ms/count
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <LiveGraph gaps={pace?.gaps ?? []} goalMs={pace?.refMsPerCount ?? null} />
      </div>

      <TargetInput
        valueMs={targetMs}
        onCommit={ms => {
          setTargetMs(ms)
          setTargetSplitMs(ms)
          persist({ pref_pace_target_ms: ms ?? 0 })
        }}
      />

      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        {([['split', 'Split'], ['get', 'Get'], ['counts', 'Counts']] as [PaceTarget, string][]).map(([v, text]) => (
          <Chip
            key={v}
            on={target === v}
            onClick={() => {
              setTarget(v)
              setPaceTarget(v)
              persist({ pref_pace_mode: v === 'get' ? 'Get' : v === 'counts' ? 'Counts' : 'Split' })
            }}
          >
            {text}
          </Chip>
        ))}
        {target === 'counts' && (
          <input
            type="number"
            min={1}
            value={runCounts}
            onChange={e => {
              const v = Math.max(1, Math.floor(Number(e.target.value) || 1))
              setRunCounts(v)
              setPaceCounts(v)
              persist({ pref_pace_counts: v })
            }}
            aria-label="Counts per run"
            style={{
              width: 64, padding: '2px 6px', borderRadius: 6,
              background: 'var(--thread-bg-2, rgb(var(--ink-rgb) / 0.06))',
              border: '1px solid var(--thread-line)',
              color: 'inherit', fontSize: 12, fontFamily: 'var(--font-mono)',
            }}
          />
        )}
        <span style={{ width: 10 }} />
      </div>

      <button
        type="button"
        disabled={targetMs == null && !running}
        onClick={() => {
          if (targetMs == null && !running) return
          const next = !running
          setRunning(next)
          setPaceRunning(next)
        }}
        style={{
          marginTop: 12,
          width: '100%',
          padding: '9px 0',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: targetMs == null && !running ? 'not-allowed' : 'pointer',
          border: `1px solid ${running ? 'var(--danger)' : 'var(--thread-accent)'}`,
          background: running ? 'rgba(239,68,68,0.12)' : 'var(--thread-accent-soft)',
          color: running ? 'var(--danger)' : 'var(--thread-accent)',
          opacity: targetMs == null && !running ? 0.45 : 1,
          transition: 'background 0.15s, border-color 0.15s, color 0.15s',
        }}
      >
        {running ? 'Stop' : 'Start'}
      </button>

      {running && targetMs != null && pace && !pace.segmentStartSeen && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--thread-muted)' }}>
          Waiting for the next {target === 'split' ? 'split' : target === 'get' ? 'get' : 'run'} to start…
        </div>
      )}
    </div>
  )
}

export function parseSplitTarget(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '')
  if (!s) return null

  const colon = s.match(/^(\d+):([0-5]?\d(?:\.\d+)?)$/)
  if (colon) return (Number(colon[1]) * 60 + Number(colon[2])) * 1000

  const ms = s.match(/^(\d+)m(?:in)?(?:([0-5]?\d(?:\.\d+)?)s?)?$/)
  if (ms) return (Number(ms[1]) * 60 + Number(ms[2] ?? 0)) * 1000

  const plain = s.match(/^(\d+(?:\.\d+)?)(s|sec|m|min)?$/)
  if (plain) {
    const n = Number(plain[1])
    if (!Number.isFinite(n) || n <= 0) return null
    const unit = plain[2]
    if (unit === 'm' || unit === 'min') return n * 60_000
    if (unit === 's' || unit === 'sec') return n * 1000
    return n < 60 ? n * 60_000 : n * 1000
  }
  return null
}

function TargetInput({ valueMs, onCommit }: { valueMs: number | null; onCommit: (ms: number | null) => void }) {
  const [draft, setDraft] = useState(valueMs != null ? formatClock(valueMs) : '')
  const [bad, setBad] = useState(false)

  useEffect(() => {
    setDraft(valueMs != null ? formatClock(valueMs) : '')
    setBad(false)
  }, [valueMs])

  const commit = () => {
    if (!draft.trim()) { setBad(false); onCommit(null); return }
    const ms = parseSplitTarget(draft)
    if (ms == null) { setBad(true); return }
    setBad(false)
    onCommit(ms)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 }}>
      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--thread-muted)', letterSpacing: '0.07em' }}>
        TARGET
      </label>
      <input
        value={draft}
        onChange={e => { setDraft(e.target.value); setBad(false) }}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
        placeholder="3:30"
        inputMode="numeric"
        aria-label="Target split time"
        style={{
          width: 74, padding: '3px 7px', borderRadius: 6, fontSize: 13, fontWeight: 700,
          textAlign: 'center', fontVariantNumeric: 'tabular-nums',
          border: `1px solid ${bad ? 'var(--danger)' : valueMs != null ? 'var(--thread-accent)' : 'var(--thread-line)'}`,
          background: 'transparent',
          color: bad ? 'var(--danger)' : valueMs != null ? 'var(--thread-accent)' : 'var(--thread-ink)',
          outline: 'none',
        }}
      />
      {valueMs != null && (
        <button
          onClick={() => onCommit(null)}
          title="Clear target and go back to measuring against past splits"
          style={{
            border: 'none', background: 'none', cursor: 'pointer',
            color: 'var(--thread-muted)', fontSize: 11, padding: '2px 4px',
          }}
        >clear</button>
      )}
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: on ? 700 : 500,
        border: `1px solid ${on ? 'var(--thread-accent)' : 'var(--thread-line)'}`,
        background: on ? 'var(--thread-accent-soft)' : 'transparent',
        color: on ? 'var(--thread-accent)' : 'var(--thread-muted)', cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}


function LiveGraph({ gaps, goalMs }: {
  gaps: number[]
  goalMs: number | null
}) {
  const W = 300
  const H = 92
  const PAD = { top: 6, right: 4, bottom: 4, left: 30 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const shown = gaps.slice(-90)

  const yMax = useMemo(() => {
    if (!shown.length) return scaleY(600)
    const sorted = [...shown].sort((a, b) => a - b)
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
    const ceiling = Math.max(400, Math.min(5000, p95))
    return scaleY(goalMs != null ? Math.max(ceiling, goalMs * 1.15) : ceiling)
  }, [shown, goalMs])

  if (shown.length < 2) {
    return (
      <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--thread-muted)' }}>
        Waiting for counts…
      </div>
    )
  }

  const xOf = (i: number) => PAD.left + (i / (shown.length - 1)) * innerW
  const yOf = (ms: number) => PAD.top + innerH - Math.min(1, scaleY(ms) / yMax) * innerH

  const line = shown.map((ms, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(ms).toFixed(1)}`).join(' ')
  const area = `${line} L${xOf(shown.length - 1).toFixed(1)},${PAD.top + innerH} L${PAD.left},${PAD.top + innerH} Z`

  const ticks: { ms: number; y: number }[] = []
  let lastY = Infinity
  for (const ms of Y_TICKS) {
    const sy = scaleY(ms)
    if (sy >= yMax) break
    const y = PAD.top + innerH - (sy / yMax) * innerH
    if (lastY - y < 18) continue
    ticks.push({ ms, y })
    lastY = y
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {ticks.map(t => (
        <g key={t.ms}>
          <line x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y} stroke="var(--thread-line)" strokeWidth="1" />
          <text x={PAD.left - 4} y={t.y + 3} textAnchor="end" fontSize="8" fill="#5b6270" fontFamily="var(--font-mono)">
            {t.ms}
          </text>
        </g>
      ))}
      <defs>
        <linearGradient id="liveGapFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--thread-accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--thread-accent)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#liveGapFill)" />
      <path d={line} fill="none" stroke="var(--thread-accent)" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx={xOf(shown.length - 1)} cy={yOf(shown[shown.length - 1])} r="2.6" fill="var(--thread-accent)" />

      {goalMs != null && (
        <g>
          <line
            x1={PAD.left} x2={W - PAD.right}
            y1={yOf(goalMs)} y2={yOf(goalMs)}
            stroke="var(--warn)" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.9"
          />
          <text
            x={W - PAD.right} y={yOf(goalMs) - 3}
            textAnchor="end" fontSize="8" fill="var(--warn)" fontWeight="700"
          >
            goal {Math.round(goalMs)}ms
          </text>
        </g>
      )}
    </svg>
  )
}

export default function SplitsTab({ splits, threadUUID, isLoggedIn, countsPerSplit = 100, splitsPerGet = 10 }: SplitsTabProps) {
  const [paceOpen, setPaceOpen] = useState(false)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
      <button
        onClick={() => setPaceOpen(v => !v)}
        aria-expanded={paceOpen}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '8px 10px', marginBottom: 10,
          background: 'var(--thread-surface)',
          border: 'none', borderRadius: 6, cursor: 'pointer',
          color: 'var(--thread-ink)', fontSize: 13, fontWeight: 700, textAlign: 'left',
        }}
      >
        <span>Pace clock</span>
        <span style={{ fontSize: 11, color: 'var(--thread-muted)' }}>{paceOpen ? '▲' : '▼'}</span>
      </button>

      {paceOpen && <PaceClock threadUUID={threadUUID} isLoggedIn={isLoggedIn} />}

      {splits.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--thread-muted)' }}>No splits yet</div>
      ) : (
        <>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Recent Splits</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--thread-line)' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--thread-muted)', fontWeight: 600, fontSize: 11 }}>Count</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--thread-muted)', fontWeight: 600, fontSize: 11 }}>Split</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--thread-muted)', fontWeight: 600, fontSize: 11 }}>Counts/s</th>
              </tr>
            </thead>
            <tbody>
              {splits.map((s, i) => (
                <tr key={`${s.number}-${i}`} style={{ borderBottom: '1px solid var(--thread-line)' }}>
                  <td style={{ padding: '4px 8px', fontFamily: 'monospace', color: 'var(--thread-ink)' }}>
                    {s.replay ? (
                      <Link
                        href={s.replay}
                        title="Watch this split"
                        style={{ color: 'var(--thread-ink)', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}
                      >
                        {s.number}
                      </Link>
                    ) : s.number}
                  </td>
                  <td style={{ padding: '4px 8px', fontFamily: 'monospace', color: 'var(--thread-muted)' }}>{fancyTime(s.split)}</td>
                  <td style={{ padding: '4px 8px', fontFamily: 'monospace', color: 'var(--thread-ink)', textAlign: 'right' }}>
                    {countsPerSecond(s, countsPerSplit, splitsPerGet)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

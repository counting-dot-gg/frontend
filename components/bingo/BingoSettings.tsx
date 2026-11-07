'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { BingoGameState } from '@/lib/bingo'
import { Chevron } from './GameBits'

const RANKS = [
  'bronze', 'silver', 'gold', 'platinum', 'emerald',
  'diamond', 'countmeister', 'grandcounter', 'peak',
] as const

const MODES: Array<{ value: string; label: string }> = [
  { value: 'bingo',   label: 'Classic' },
  { value: 'lockout', label: 'Lockout' },
]

const TIME_LIMITS: Array<{ value: number; label: string }> = [
  { value: 60 * 30, label: '30m' },
  { value: 60 * 60, label: '1h' },
  { value: 60 * 60 * 3, label: '3h' },
  { value: 60 * 60 * 12, label: '12h' },
  { value: 60 * 60 * 24, label: '24h' },
]

const MIN_TIMES: Array<{ value: number | null; label: string }> = [
  { value: null, label: 'None' },
  { value: 60 * 5, label: '5m' },
  { value: 60 * 10, label: '10m' },
  { value: 60 * 15, label: '15m' },
  { value: 60 * 30, label: '30m' },
  { value: 60 * 60, label: '1h' },
]

const JOIN_MODES: Array<{ value: string; label: string }> = [
  { value: 'free',   label: 'Anyone' },
  { value: 'code',   label: 'Code' },
  { value: 'closed', label: 'Closed' },
]

interface Props {
  state: BingoGameState
  isHost: boolean
  pending: boolean
  send: (event: string, data?: Record<string, unknown>) => void
}

export default function BingoSettings({ state, isHost, pending, send }: Props) {
  const [open, setOpen] = useState(false)
  const { game, teams, teamSwapMode } = state
  const teamsPlaying = new Set(state.members.filter(m => m.status === 'active').map(m => m.teamId)).size
  const graceShown = game.minTimeSeconds == null
    ? (teamsPlaying >= 2 && 300 < game.timeLimitSeconds ? 300 : null)
    : game.minTimeSeconds === 0 ? null : game.minTimeSeconds

  if (!isHost || game.status !== 'lobby') return null

  const gameId = game.id
  const update = (patch: Record<string, unknown>) =>
    send('bingo_update_settings', { gameId, ...patch })

  return (
    <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', border: 'none', background: 'transparent',
          color: 'var(--foreground)', cursor: 'pointer', fontWeight: 700, fontSize: 13,
        }}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>Settings</span>
        <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 600 }}>
          {RANKS.includes(game.rank as typeof RANKS[number]) ? game.rank : 'bronze'} · {game.mode}
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 14,
          padding: '4px 10px 12px', borderTop: '1px solid var(--border)',
        }}>
          <Field label="Difficulty">
            <select
              value={game.rank}
              disabled={pending}
              onChange={e => update({ rank: e.target.value })}
              style={selectStyle}
            >
              {RANKS.map(r => (
                <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </Field>

          <Field label="Mode">
            <Choices
              options={MODES.map(m => ({ value: m.value, label: m.label }))}
              value={game.mode}
              disabled={pending}
              onPick={v => update({ mode: v })}
            />
          </Field>

          <Field label="Time limit">
            <Choices
              options={TIME_LIMITS.map(t => ({ value: String(t.value), label: t.label }))}
              value={String(game.timeLimitSeconds)}
              disabled={pending}
              onPick={v => update({ timeLimitSeconds: Number(v) })}
            />
          </Field>

          <Field label="Grace period">
            <Choices
              options={MIN_TIMES
                .filter(t => t.value == null || t.value < game.timeLimitSeconds)
                .map(t => ({ value: String(t.value), label: t.label }))}
              value={String(graceShown)}
              disabled={pending}
              onPick={v => update({ minTimeSeconds: v === 'null' ? null : Number(v) })}
            />
          </Field>

          <Field label="Who can join">
            <Choices
              options={JOIN_MODES.map(j => ({ value: j.value, label: j.label }))}
              value={game.joinMode}
              disabled={pending}
              onPick={v => update({ joinMode: v })}
            />
            {game.joinMode === 'code' && game.joinCode && <JoinCode code={game.joinCode} />}
          </Field>

          <Field label="Team picking">
            <Choices
              options={[
                { value: 'open', label: 'Players choose' },
                { value: 'locked', label: 'Host assigns' },
              ]}
              value={teamSwapMode}
              disabled={pending}
              onPick={v => update({ teamSwapMode: v })}
            />
          </Field>

        </div>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--background)',
  color: 'var(--foreground)', fontSize: 13,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em',
        fontWeight: 800, opacity: 0.55, marginBottom: 5,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function Choices({ options, value, disabled, onPick }: {
  options: Array<{ value: string; label: string }>
  value: string
  disabled: boolean
  onPick: (value: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onPick(opt.value)}
            style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
              cursor: disabled ? 'default' : 'pointer',
              border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
              background: active ? 'var(--primary)' : 'transparent',
              color: active ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function JoinCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }
  return (
    <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
      <input
        type="password"
        readOnly
        value={code}
        aria-label="Join code"
        autoComplete="off"
        onFocus={e => e.currentTarget.blur()}
        style={{
          flex: 1, minWidth: 0, padding: '6px 8px', borderRadius: 6, border: 'none',
          background: 'var(--muted)', color: 'var(--foreground)',
          fontSize: 15, fontWeight: 800, letterSpacing: '0.12em', textAlign: 'center',
        }}
      />
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy join code'}
        style={{
          display: 'grid', placeItems: 'center', width: 36, borderRadius: 6, border: 'none', cursor: 'pointer',
          background: copied ? 'var(--success-ink)' : '#f97316', color: '#fff',
        }}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </div>
  )
}

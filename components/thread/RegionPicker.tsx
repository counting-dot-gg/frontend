'use client'

import { useEffect, useRef, useState } from 'react'
import { REGIONS, cachedRegionPings, regionCode, regionPings, type RegionId } from '@/lib/regional'
import type { Regional } from './useRegional'

const CODE_WIDTH = `${Math.max(...REGIONS.map(r => r.code.length)) + 2}ch`

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return now
}

function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function Globe() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <circle cx="8" cy="8" r="6.3" />
      <path d="M1.7 8h12.6M8 1.7c1.8 1.7 2.7 3.8 2.7 6.3S9.8 12.6 8 14.3M8 1.7C6.2 3.4 5.3 5.5 5.3 8s.9 4.6 2.7 6.3" />
    </svg>
  )
}

const COUNTDOWN_MS = 3000

function strength(ms: number): { bars: number; color: string } {
  if (ms < 60) return { bars: 3, color: 'var(--success)' }
  if (ms < 150) return { bars: 2, color: 'var(--thread-accent)' }
  return { bars: 1, color: 'var(--danger)' }
}

function Signal({ ms }: { ms: number }) {
  const { bars, color } = strength(ms)
  return (
    <svg width="13" height="11" viewBox="0 0 14 12" aria-hidden>
      {[0, 1, 2].map(i => (
        <rect
          key={i} x={i * 5} y={8 - i * 4} width="3.5" height={4 + i * 4} rx="1"
          fill={i < bars ? color : 'var(--thread-line)'}
        />
      ))}
    </svg>
  )
}

function Ping({ ms }: { ms: number | null }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      color: 'var(--thread-muted)', fontVariantNumeric: 'tabular-nums',
    }}>
      {ms == null ? '–' : <><Signal ms={ms} />{ms} ms</>}
    </span>
  )
}

function Ring({ left }: { left: number }) {
  const c = 2 * Math.PI * 5.5
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
      <circle cx="6.5" cy="6.5" r="5.5" fill="none" stroke="var(--thread-line)" strokeWidth="1.6" />
      <circle
        cx="6.5" cy="6.5" r="5.5" fill="none" stroke="var(--thread-accent)" strokeWidth="1.6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - left)} transform="rotate(-90 6.5 6.5)"
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  )
}

function AutoTag() {
  return (
    <span style={{
      padding: '2px 4px', borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', lineHeight: 1,
      background: 'var(--thread-accent)', color: 'var(--thread-bg, var(--card))',
    }}>
      AUTO
    </span>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }}
    >
      <path d="M2 3.5 5 6.5 8 3.5" />
    </svg>
  )
}

export default function RegionPicker({ regional, isLoggedIn }: { regional: Regional; isLoggedIn: boolean }) {
  const { owner, ping, vpsPing, refusal, pick, cancel } = regional
  const [open, setOpen] = useState(false)
  const [pings, setPings] = useState<Partial<Record<RegionId, number>>>({})
  const box = useRef<HTMLDivElement>(null)
  const now = useNow(!!owner?.movable)
  const remaining = owner ? owner.cooldownUntil - now : 0

  useEffect(() => {
    if (!open || !owner?.worker) return
    let cancelled = false
    regionPings(owner.worker)
      .then(p => !cancelled && setPings(p))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [open, owner?.worker])

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  if (!owner?.movable) return null
  const coolingDown = remaining > 0
  const locked = owner.moving || coolingDown || !isLoggedIn
  const choose = (region: string) => {
    setOpen(false)
    pick(region)
  }
  const regionsClosed = owner.regionsOpen === false
  const auto = owner.auto === true
  const pending = owner.pending && owner.pendingAt ? { ...owner.pending, left: owner.pendingAt - now } : null
  const canCancel = !!pending && isLoggedIn
  const row = (id: string, label: string, ms: number | null | undefined, here: boolean, region = true) => {
    const checked = id === 'auto' ? auto : here && !auto
    const blocked = id === 'auto' ? auto || !isLoggedIn : locked || (here && !auto) || (region && regionsClosed)
    return (
    <button
      key={id}
      role="option"
      aria-selected={checked}
      onClick={() => choose(id)}
      disabled={blocked}
      style={{
        display: 'flex', alignItems: 'center', gap: 16, width: '100%',
        padding: '7px 10px', background: here || checked ? 'var(--thread-surface)' : 'none',
        border: 'none', borderRadius: 6, textAlign: 'left',
        color: 'var(--thread-ink)', fontWeight: here || checked ? 700 : 400,
        cursor: blocked ? 'default' : 'pointer',
        opacity: blocked && !here && !checked ? 0.5 : 1,
      }}
    >
      <span style={{ width: 12, color: 'var(--thread-accent)' }}>{checked ? '✓' : ''}</span>
      <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{label}</span>
      {id !== 'auto' && <Ping ms={ms ?? null} />}
    </button>
    )
  }

  return (
    <div ref={box} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => {
          if (!open) setPings(cachedRegionPings())
          setOpen(!open)
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={refusal ? refusal.replace(/_/g, ' ') : undefined}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 8px', fontSize: 12, fontFamily: 'monospace', fontWeight: 600,
          background: 'var(--thread-bg, var(--card))', color: 'var(--thread-ink)',
          border: `1px solid ${refusal || pending ? 'var(--thread-accent)' : 'var(--thread-line)'}`,
          borderRadius: 8, cursor: 'pointer',
        }}
      >
        <span style={{ display: 'inline-flex', justifyContent: 'center', width: 34, color: 'var(--thread-muted)' }}>
          {pending ? <Ring left={Math.max(0, pending.left) / Math.max(COUNTDOWN_MS, pending.inMs)} /> : auto ? <AutoTag /> : <Globe />}
        </span>
        <span style={{ width: CODE_WIDTH, textAlign: 'left', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {pending
            ? `→ ${regionCode(pending.target === 'vps' ? null : pending.target)}`
            : owner.moving ? '…' : regionCode(owner.region)}
        </span>
        <span style={{
          display: 'inline-flex', justifyContent: 'flex-end', width: '8ch',
          color: 'var(--thread-accent)', fontVariantNumeric: 'tabular-nums',
        }}>
          {pending ? `${Math.max(0, Math.ceil(pending.left / 1000))}s` : <Ping ms={ping} />}
        </span>
        <span style={{
          minWidth: 16, display: 'inline-flex', justifyContent: 'center',
          color: 'var(--thread-muted)', fontVariantNumeric: 'tabular-nums',
          visibility: canCancel ? 'hidden' : 'visible',
        }}>
          {coolingDown && !pending ? clock(remaining) : <Chevron open={open} />}
        </span>
      </button>
      {canCancel && (
        <button
          onClick={cancel}
          aria-label="Cancel move"
          style={{
            position: 'absolute', right: 3, top: '50%', transform: 'translateY(-50%)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 21, height: 21,
            padding: 0, fontSize: 12, lineHeight: 1, background: 'none', border: 'none', borderRadius: 6,
            color: 'var(--thread-accent)', cursor: 'pointer',
          }}
        >
          ✕
        </button>
      )}
      {refusal && !open && (
        <span style={{
          position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 30, whiteSpace: 'nowrap',
          padding: '2px 8px', fontSize: 11, fontFamily: 'monospace', borderRadius: 6,
          background: 'var(--thread-accent)', color: 'var(--thread-bg, var(--card))',
        }}>
          {refusal.replace(/_/g, ' ')}
        </span>
      )}
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 30, minWidth: 240,
            padding: 4, fontSize: 13, background: 'var(--thread-bg, var(--card))',
            border: '1px solid var(--thread-line)', borderRadius: 8,
            boxShadow: '0 6px 24px color-mix(in srgb, var(--thread-ink) 18%, transparent)',
          }}
        >
          {row('auto', 'AUTO', null, false, false)}
          {row('vps', 'VPS (Ashburn)', vpsPing, owner.region === null, false)}
          {REGIONS.map(r => row(r.id, r.label, pings[r.id], owner.region === r.id))}
        </div>
      )}
    </div>
  )
}

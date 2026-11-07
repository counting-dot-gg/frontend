'use client'

import { useState } from 'react'
import { convertToTimestamp, formatDate, formatDateExact, formatTimeDiff } from '@/lib/countUuid'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 13px',
  borderRadius: 10,
  border: '1px solid rgb(var(--ink-rgb) / 0.12)',
  background: 'rgb(var(--ink-rgb) / 0.03)',
  color: 'var(--ink-1)',
  fontSize: 14,
  fontFamily: 'monospace',
  outline: 'none',
}

function Field({ label, value, onChange }: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{
        display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700,
        letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgb(var(--ink-rgb) / 0.4)',
      }}>
        {label}
      </span>
      <input
        value={value}
        onChange={e => onChange(e.target.value.trim().slice(-36))}
        placeholder="00000000-0000-0000-0000-000000000000"
        spellCheck={false}
        style={inputStyle}
      />
    </label>
  )
}

function Readout({ label, timestamp }: { label: string; timestamp: number }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)', fontFamily: 'monospace' }}>
        {formatDateExact(timestamp)}
      </div>
      <div style={{ fontSize: 12, color: '#9aa2b5', fontVariantNumeric: 'tabular-nums' }}>
        {timestamp} · {formatDate(timestamp)}
      </div>
    </div>
  )
}

export default function UuidClient() {
  const [uuid1, setUuid1] = useState('')
  const [uuid2, setUuid2] = useState('')

  const timestamp1 = convertToTimestamp(uuid1)
  const timestamp2 = convertToTimestamp(uuid2)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-0)', padding: '24px 16px 64px' }}>
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 24px', fontSize: 28, fontWeight: 800, color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>
          UUID Calculator
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="UUID 1" value={uuid1} onChange={setUuid1} />
          <Field label="UUID 2" value={uuid2} onChange={setUuid2} />
        </div>

        {(timestamp1 !== null || timestamp2 !== null) && (
          <div style={{
            marginTop: 26, padding: '18px 18px 8px', borderRadius: 14,
            background: 'rgb(var(--ink-rgb) / 0.02)', border: '1px solid rgb(var(--ink-rgb) / 0.07)',
          }}>
            {timestamp1 !== null && <Readout label="UUID 1" timestamp={timestamp1} />}
            {timestamp2 !== null && <Readout label="UUID 2" timestamp={timestamp2} />}

            {timestamp1 !== null && timestamp2 !== null && (
              <div style={{ marginTop: 6, paddingTop: 14, borderTop: '1px solid rgb(var(--ink-rgb) / 0.07)' }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 3 }}>Time difference</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#facc15' }}>
                  {formatTimeDiff(timestamp1, timestamp2)}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
                  {formatTimeDiff(timestamp1, timestamp2, true)} · {Math.abs(timestamp2 - timestamp1)} ms
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

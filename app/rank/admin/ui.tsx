'use client'

import type { CSSProperties, ReactNode } from 'react'

export const panel: CSSProperties = {
  borderRadius: 14,
  border: '1px solid rgb(var(--ink-rgb) / 0.08)',
  background: 'rgb(var(--ink-rgb) / 0.02)',
  padding: 18,
}

export const inputStyle: CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid rgb(var(--ink-rgb) / 0.14)',
  background: 'rgb(var(--ink-rgb) / 0.04)',
  color: 'var(--ink-1)',
  fontSize: 13,
  outline: 'none',
}

export const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'rgb(var(--ink-rgb) / 0.4)',
}

export function Field({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <label style={{ display: 'block', minWidth: 0, ...style }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  )
}

export function Button({ children, onClick, kind = 'ghost', disabled, type = 'button', style }: {
  children: ReactNode
  onClick?: () => void
  kind?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  type?: 'button' | 'submit'
  style?: CSSProperties
}) {
  const palette = {
    primary: { bg: 'linear-gradient(135deg, #f97316, #ea580c)', fg: '#fff', border: 'transparent' },
    ghost:   { bg: 'rgb(var(--ink-rgb) / 0.05)', fg: '#cbd5e1', border: 'rgb(var(--ink-rgb) / 0.14)' },
    danger:  { bg: 'rgba(248,113,113,0.12)', fg: 'var(--danger)', border: 'rgba(248,113,113,0.35)' },
  }[kind]

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 14px',
        borderRadius: 8,
        border: `1px solid ${palette.border}`,
        background: palette.bg,
        color: palette.fg,
        fontSize: 12,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export function Banner({ kind, children }: { kind: 'error' | 'success' | 'warn'; children: ReactNode }) {
  const palette = {
    error:   { fg: 'var(--danger)', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)' },
    success: { fg: 'var(--success)', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.3)' },
    warn:    { fg: '#facc15', bg: 'rgba(250,204,21,0.1)', border: 'rgba(250,204,21,0.3)' },
  }[kind]

  return (
    <div style={{
      padding: '9px 14px',
      borderRadius: 9,
      background: palette.bg,
      border: `1px solid ${palette.border}`,
      color: palette.fg,
      fontSize: 12.5,
      fontWeight: 600,
      lineHeight: 1.5,
    }}>
      {children}
    </div>
  )
}

export const th: CSSProperties = {
  padding: '7px 10px',
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgb(var(--ink-rgb) / 0.4)',
  borderBottom: '1px solid rgb(var(--ink-rgb) / 0.12)',
  whiteSpace: 'nowrap',
}

export const td: CSSProperties = {
  padding: '7px 10px',
  fontSize: 12.5,
  color: '#cbd5e1',
  borderBottom: '1px solid rgb(var(--ink-rgb) / 0.05)',
  verticalAlign: 'middle',
}

export const mono: CSSProperties = { fontFamily: 'monospace', fontSize: 11.5 }

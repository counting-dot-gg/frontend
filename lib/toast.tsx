'use client'

import { useEffect, useState } from 'react'

export type ToastKind = 'error' | 'warn' | 'info' | 'success'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
  detail?: string
  icon?: string
  href?: string
}

type Listener = (toasts: Toast[]) => void

let toasts: Toast[] = []
let listeners: Listener[] = []
let nextId = 1

const MAX_TOASTS = 3
const DEFAULT_TTL = 5000

function emit() {
  const snapshot = toasts
  listeners.forEach(l => l(snapshot))
}

function dismiss(id: number) {
  toasts = toasts.filter(t => t.id !== id)
  emit()
}

export function notify(
  message: string,
  opts: {
    kind?: ToastKind
    detail?: string
    ttl?: number
    dedupeKey?: string
    icon?: string
    href?: string
  } = {},
): void {
  const { kind = 'info', detail, ttl = DEFAULT_TTL, dedupeKey, icon, href } = opts

  if (dedupeKey && toasts.some(t => t.message === message && t.detail === detail)) return

  const toast: Toast = { id: nextId++, kind, message, detail, icon, href }
  toasts = [...toasts, toast].slice(-MAX_TOASTS)
  emit()

  if (ttl > 0) setTimeout(() => dismiss(toast.id), ttl)
}

const COLORS: Record<ToastKind, { bar: string; text: string }> = {
  error: { bar: 'var(--danger)', text: '#fca5a5' },
  warn: { bar: '#f97316', text: '#fdba74' },
  info: { bar: '#38bdf8', text: '#7dd3fc' },
  success: { bar: 'var(--success)', text: '#86efac' },
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([])

  useEffect(() => {
    const listener: Listener = next => setItems(next)
    listeners.push(listener)
    setItems(toasts)
    return () => { listeners = listeners.filter(l => l !== listener) }
  }, [])

  if (items.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', top: 77, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        width: 'max-content', maxWidth: 'min(420px, calc(100vw - 32px))',
        pointerEvents: 'none',
      }}
    >
      <style>{`@keyframes cggToastIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}`}</style>
      {items.map(t => (
        <div
          key={t.id}
          onClick={() => {
            if (t.href) window.location.href = t.href
            else dismiss(t.id)
          }}
          style={{
            pointerEvents: 'auto', cursor: 'pointer',
            display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '10px 12px', borderRadius: 10,
            background: 'rgb(var(--surface-0-rgb) / 0.94)',
            border: '1px solid rgb(var(--ink-rgb) / 0.12)',
            borderLeft: `3px solid ${COLORS[t.kind].bar}`,
            boxShadow: '0 8px 28px rgb(var(--shadow-rgb) / 0.45)',
            animation: 'cggToastIn 140ms ease-out',
          }}
        >
          {t.icon && (
            <span style={{ fontSize: 20, lineHeight: '20px', flexShrink: 0 }} aria-hidden="true">
              {t.icon}
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS[t.kind].text }}>
              {t.message}
            </div>
            {t.detail && (
              <div style={{ marginTop: 2, fontSize: 12, color: '#9aa3b8', lineHeight: 1.4 }}>
                {t.detail}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

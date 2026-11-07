'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cellAt, padKeyLabel, type PadCell, type PadLayout } from '@/lib/padLayout'

export type PadTarget = HTMLTextAreaElement | HTMLInputElement

type Props = {
  padRef?: React.RefObject<HTMLDivElement | null>
  getTarget: () => PadTarget | null
  onSubmit: () => void
  onRequestLetters: () => void
  onMacroKey: (triggerKey: string) => void
  layout: PadLayout
  accent: string
  submitLabel: string
}

function append(el: PadTarget, text: string) {
  el.value = el.value + text
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function backspace(el: PadTarget) {
  el.value = el.value.slice(0, -1)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function clear(el: PadTarget) {
  el.value = ''
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export function isDensePad(layout: { rows: number; cols: number }): boolean {
  return layout.rows > 6 || layout.cols > 6
}

function padGaps(layout: { rows: number; cols: number }): { row: number; col: number } {
  return isDensePad(layout) ? { row: 7, col: 5 } : { row: 6, col: 6 }
}

const MIN_ROW = 40
const DENSE_ROW = 34
export function padGridHeight(layout: { rows: number; cols: number }): number {
  const { rows } = layout
  const gap = padGaps(layout).row
  if (isDensePad(layout)) return rows * DENSE_ROW + (rows - 1) * gap
  return Math.max(232, rows * MIN_ROW + (rows - 1) * gap)
}

const MAX_SCREEN_SHARE_DVH = 45
const LANDSCAPE_MIN_ROW = 28
function livePadHeight(layout: { rows: number; cols: number }): string {
  const floor = layout.rows * LANDSCAPE_MIN_ROW + (layout.rows - 1) * padGaps(layout).row
  return `clamp(${floor}px, ${MAX_SCREEN_SHARE_DVH}dvh, ${padGridHeight(layout)}px)`
}

export function padSpotAt(el: HTMLElement, layout: PadLayout, x: number, y: number): { row: number; col: number } {
  const r = el.getBoundingClientRect()
  const gap = padGaps(layout)
  const colW = (r.width - gap.col * (layout.cols - 1)) / layout.cols
  const rowH = (r.height - gap.row * (layout.rows - 1)) / layout.rows
  const col = Math.floor((x - r.left + gap.col / 2) / (colW + gap.col))
  const row = Math.floor((y - r.top + gap.row / 2) / (rowH + gap.row))
  return {
    row: Math.max(0, Math.min(layout.rows - 1, row)),
    col: Math.max(0, Math.min(layout.cols - 1, col)),
  }
}

const PRESSED_SHADOW = 'inset 0 0 0 999px rgb(var(--ink-rgb) / 0.18)'

export default function CountPad({ padRef, getTarget, onSubmit, onRequestLetters, onMacroKey, layout, accent, submitLabel }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const lastFire = useRef(new Map<string, number>())
  const fireOnce = (key: string, fn: () => void) => {
    const now = performance.now()
    const prev = lastFire.current.get(key) ?? 0
    if (now - prev < 30) return
    lastFire.current.set(key, now)
    fn()
  }

  const rootRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const pressAt = useRef<(x: number, y: number) => { el: HTMLElement | null; code: string } | null>(() => null)

  const withTarget = (fn: (el: PadTarget) => void) => () => {
    const el = getTarget()
    if (el) fn(el)
  }

  const actionOf = (cell: PadCell): (() => void) => {
    const key = cell.key
    switch (key.kind) {
      case 'char': return withTarget(el => append(el, key.value))
      case 'space': return withTarget(el => append(el, ' '))
      case 'backspace': return withTarget(backspace)
      case 'clear': return withTarget(clear)
      case 'enter': return onSubmit
      case 'letters': return onRequestLetters
      case 'macro': return () => onMacroKey(key.triggerKey)
    }
  }

  useEffect(() => {
    pressAt.current = (x, y) => {
      const grid = gridRef.current
      if (!grid) return null
      const spot = padSpotAt(grid, layout, x, y)
      const cell = cellAt(layout, spot.row, spot.col)
      if (!cell) return null
      const pos = `${cell.row},${cell.col}`
      const code = `Pad${pos}`
      fireOnce(pos, actionOf(cell))
      return { el: grid.querySelector<HTMLElement>(`[data-pad-pos="${pos}"]`), code }
    }
  })

  useEffect(() => {
    const root = rootRef.current
    if (!mounted || !root) return
    const html = document.documentElement
    const previousTouchAction = html.style.touchAction
    html.style.touchAction = 'manipulation'
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    const previousViewport = viewport?.getAttribute('content') ?? null
    if (viewport && previousViewport !== null) {
      viewport.setAttribute('content', `${previousViewport}, maximum-scale=1, user-scalable=no`)
    }
    const held = new Map<number, { el: HTMLElement | null; code: string }>()
    const release = (id: number) => {
      const press = held.get(id)
      if (!press) return
      held.delete(id)
      if (press.el) press.el.style.boxShadow = ''
    }
    const onTouchStart = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        const press = pressAt.current(t.clientX, t.clientY)
        if (!press) continue
        if (press.el) press.el.style.boxShadow = PRESSED_SHADOW
        held.set(t.identifier, press)
      }
      unstick()
    }
    const unstick = () => {
      const active = document.activeElement
      const editing = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
        || (active instanceof HTMLElement && active.isContentEditable)
      const sel = window.getSelection()
      const selected = !!sel && sel.rangeCount > 0 && sel.type !== 'None'
      if (!editing && !selected) return
      if (editing) (active as HTMLElement).blur()
      if (selected) sel!.removeAllRanges()
    }
    const onTouchEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) release(t.identifier)
    }
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      e.preventDefault()
      const press = pressAt.current(e.clientX, e.clientY)
      if (!press) return
      if (press.el) press.el.style.boxShadow = PRESSED_SHADOW
      held.set(-1 - e.pointerId, press)
      const up = () => { window.removeEventListener('pointerup', up); release(-1 - e.pointerId) }
      window.addEventListener('pointerup', up)
    }
    const onMouseDown = (e: MouseEvent) => e.preventDefault()
    root.addEventListener('touchstart', onTouchStart, { passive: true })
    root.addEventListener('touchend', onTouchEnd, { passive: true })
    root.addEventListener('touchcancel', onTouchEnd, { passive: true })
    root.addEventListener('pointerdown', onPointerDown)
    root.addEventListener('mousedown', onMouseDown)
    return () => {
      html.style.touchAction = previousTouchAction
      if (viewport && previousViewport !== null) viewport.setAttribute('content', previousViewport)
      root.removeEventListener('touchstart', onTouchStart)
      root.removeEventListener('touchend', onTouchEnd)
      root.removeEventListener('touchcancel', onTouchEnd)
      root.removeEventListener('pointerdown', onPointerDown)
      root.removeEventListener('mousedown', onMouseDown)
    }
  }, [mounted])

  if (!mounted) return null

  return createPortal(
    <div
      ref={el => {
        rootRef.current = el
        if (padRef) padRef.current = el
      }}
      className="composer-pad"
      role="group"
      aria-label="Number pad"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        zIndex: 120,
        background: 'var(--thread-bg, var(--background))',
        borderTop: '1px solid var(--thread-line)',
        padding: '8px 8px calc(8px + env(safe-area-inset-bottom))',
        touchAction: 'none',
        boxShadow: '0 -4px 14px rgb(0 0 0 / 0.16)',
      }}
    >
      <PadGrid ref={gridRef} layout={layout} accent={accent} submitLabel={submitLabel} plain />
    </div>,
    document.body,
  )
}

function labelSize(label: string): number {
  const n = Array.from(label).length
  return n <= 2 ? 22 : n <= 4 ? 17 : 13
}

function ariaFor(cell: PadCell, label: string): string {
  switch (cell.key.kind) {
    case 'backspace': return 'Backspace'
    case 'enter': return 'Post count'
    case 'space': return 'Space'
    case 'clear': return 'Clear'
    case 'letters': return 'Switch to the letter keyboard'
    case 'macro': return `Macro ${label}`
    default: return label
  }
}

export function PadGrid({
  ref, layout, accent, submitLabel, keyProps, cellStyle, children, plain = false,
}: {
  ref?: React.Ref<HTMLDivElement>
  layout: PadLayout
  accent: string
  submitLabel: string
  keyProps?: (cell: PadCell) => React.HTMLAttributes<HTMLElement> & { [data: `data-${string}`]: string }
  plain?: boolean
  cellStyle?: (cell: PadCell) => React.CSSProperties | undefined
  children?: React.ReactNode
}) {
  return (
    <div
      ref={ref}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
        height: plain ? livePadHeight(layout) : padGridHeight(layout),
        rowGap: padGaps(layout).row,
        columnGap: padGaps(layout).col,
      }}
    >
      {children}
      {layout.cells.map(cell => {
        const label = padKeyLabel(cell.key, submitLabel)
        const dense = isDensePad(layout)
        const isEnter = cell.key.kind === 'enter'
        const isMacro = cell.key.kind === 'macro'
        const isSpaceBar = !cell.key.label && (cell.key.kind === 'space' || (cell.key.kind === 'char' && cell.key.value === ' '))
        const Key = plain ? 'div' : 'button'
        return (
          <Key
            key={`${cell.row},${cell.col}`}
            {...(plain ? { role: 'button' } : { type: 'button' as const })}
            data-pad-pos={`${cell.row},${cell.col}`}
            aria-label={ariaFor(cell, label)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gridColumn: `${cell.col + 1} / span ${cell.w}`,
              gridRow: `${cell.row + 1} / span ${cell.h}`,
              border: 'none',
              borderRadius: dense ? 6 : 8,
              background: isEnter
                ? accent
                : isMacro
                  ? 'color-mix(in srgb, var(--thread-accent) 22%, var(--thread-line))'
                  : 'var(--thread-line)',
              color: isEnter ? '#fff' : 'var(--thread-ink)',
              fontSize: isEnter ? 15 : dense ? Math.min(20, labelSize(label)) : labelSize(label),
              fontWeight: isEnter ? 800 : 600,
              fontFamily: 'var(--font-sans), system-ui, sans-serif',
              padding: '0 4px',
              minWidth: 0,
              overflow: 'hidden',
              cursor: plain ? 'default' : 'pointer',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none' as const,
              ...cellStyle?.(cell),
            }}
            {...keyProps?.(cell)}
          >
            {isSpaceBar ? (
              <span
                aria-hidden
                style={{
                  display: 'block', width: '55%', maxWidth: 160, height: 9, margin: '0 auto',
                  border: '2.5px solid currentColor', borderTop: 'none', borderRadius: '0 0 3px 3px',
                }}
              />
            ) : (
              <span style={{ minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{label}</span>
            )}
          </Key>
        )
      })}
    </div>
  )
}

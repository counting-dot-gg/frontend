'use client'

import { useRef, useState } from 'react'
import { PadGrid, padSpotAt } from '@/components/thread/CountPad'
import {
  type PadCell, type PadKey, type PadKeyKind, type PadLayout,
  MAX_PAD_COLS, MAX_PAD_LABEL, MAX_PAD_ROWS, PAD_TEMPLATES,
  cellAt, clonePadLayout, defaultPadLayout, fitsAt, resizePadGrid,
} from '@/lib/padLayout'
import { type MacroEntryDraft, MACRO_TYPE_LABEL, normalizeMacroTriggerKey, triggerLabel } from '@/lib/macroUtils'

type Props = {
  value: PadLayout | null
  onChange: (next: PadLayout | null) => void
  entries: MacroEntryDraft[]
}

const KIND_OPTIONS: { kind: PadKeyKind; label: string }[] = [
  { kind: 'char', label: 'Type text' },
  { kind: 'macro', label: 'Run macro' },
  { kind: 'enter', label: 'Enter' },
  { kind: 'backspace', label: 'Backspace' },
  { kind: 'space', label: 'Space' },
  { kind: 'clear', label: 'Clear box' },
  { kind: 'letters', label: 'ABC keyboard' },
]

const posKey = (c: { row: number; col: number }) => `${c.row},${c.col}`

export function padLayoutProblems(layout: PadLayout | null, entries: MacroEntryDraft[]): string[] {
  if (!layout) return []
  const triggers = new Set(entries.map(e => normalizeMacroTriggerKey(e.triggerKey)))
  const out: string[] = []
  for (const c of layout.cells) {
    const where = `Pad key at row ${c.row + 1}, column ${c.col + 1}`
    if (c.key.kind === 'char' && Array.from(c.key.value).length !== 1) out.push(`${where} must type one character.`)
    if (c.key.kind === 'macro') {
      if (!triggers.has(normalizeMacroTriggerKey(c.key.triggerKey))) out.push(`${where} runs a macro this preset no longer has.`)
      if (!c.key.label?.trim()) out.push(`${where} needs a label.`)
    }
  }
  return out
}

function nextFreeDigit(layout: PadLayout): string {
  const used = new Set(layout.cells.flatMap(c => (c.key.kind === 'char' ? [c.key.value] : [])))
  return '1234567890'.split('').find(d => !used.has(d)) ?? '0'
}

function keyOfKind(kind: PadKeyKind, prev: PadKey, layout: PadLayout, entries: MacroEntryDraft[]): PadKey {
  switch (kind) {
    case 'char': return { kind: 'char', value: prev.kind === 'char' ? prev.value : nextFreeDigit(layout) }
    case 'macro': {
      const trigger = entries[0]?.triggerKey ?? ''
      return { kind: 'macro', triggerKey: trigger, label: prev.kind === 'macro' ? prev.label : '' }
    }
    default: return { kind }
  }
}

const btn: React.CSSProperties = {
  background: 'rgb(var(--ink-rgb) / 0.08)', border: '1px solid rgb(var(--ink-rgb) / 0.18)', borderRadius: 6,
  color: 'var(--ink-1)', cursor: 'pointer', fontSize: '0.85rem', padding: '6px 10px', minWidth: 36,
  touchAction: 'manipulation',
}
const inp: React.CSSProperties = {
  background: 'rgb(var(--ink-rgb) / 0.07)', border: '1px solid rgb(var(--ink-rgb) / 0.2)',
  borderRadius: 6, color: 'var(--ink-1)', fontSize: '16px', padding: '6px 10px', width: '100%',
}
const small = (text: string) => <div style={{ fontSize: '0.7rem', color: 'var(--ink-3)', marginBottom: 4 }}>{text}</div>

function Stepper({ label, value, min, max, onChange, canInc = true, canDec = true }: {
  label: string; value: number; min: number; max: number; onChange: (n: number) => void; canInc?: boolean; canDec?: boolean
}) {
  const dec = value > min && canDec
  const inc = value < max && canInc
  return (
    <div>
      {small(label)}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} style={{ ...btn, opacity: dec ? 1 : 0.35 }} disabled={!dec} onClick={() => onChange(value - 1)}>−</button>
        <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 700, color: 'var(--ink-1)' }}>{value}</span>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} style={{ ...btn, opacity: inc ? 1 : 0.35 }} disabled={!inc} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  )
}

export default function PadLayoutEditor({ value, onChange, entries }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const lastCustom = useRef<PadLayout | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ cell: PadCell; pointerId: number; x: number; y: number; grabRow: number; grabCol: number; moved: boolean } | null>(null)
  const [ghost, setGhost] = useState<{ cell: PadCell; row: number; col: number } | null>(null)

  const layout = value
  const sel = layout && selected ? layout.cells.find(c => posKey(c) === selected) ?? null : null
  const problems = padLayoutProblems(layout, entries)
  const triggerOptions = entries.filter(e => e.triggerKey)

  const setLayout = (next: PadLayout) => onChange(next)

  const replaceCell = (target: PadCell, next: PadCell) => {
    if (!layout) return
    setLayout({ ...layout, cells: layout.cells.map(c => (c === target ? next : c)) })
    setSelected(posKey(next))
  }

  const spotAt = (x: number, y: number): { row: number; col: number } | null =>
    gridRef.current && layout ? padSpotAt(gridRef.current, layout, x, y) : null

  const landing = (x: number, y: number) => {
    const d = drag.current
    const spot = spotAt(x, y)
    if (!d || !spot || !layout) return null
    return {
      row: Math.max(0, Math.min(layout.rows - d.cell.h, spot.row - d.grabRow)),
      col: Math.max(0, Math.min(layout.cols - d.cell.w, spot.col - d.grabCol)),
    }
  }

  const swapPartner = (cell: PadCell, row: number, col: number): PadCell | undefined => {
    if (!layout) return undefined
    const other = cellAt(layout, row, col)
    return other && other !== cell && other.row === row && other.col === col && other.w === cell.w && other.h === cell.h
      ? other
      : undefined
  }

  const canLand = (cell: PadCell, row: number, col: number) =>
    !!layout && (fitsAt(layout, { row, col, w: cell.w, h: cell.h }, cell) || !!swapPartner(cell, row, col))

  const moveTo = (cell: PadCell, row: number, col: number) => {
    if (!layout || (cell.row === row && cell.col === col)) return
    const partner = swapPartner(cell, row, col)
    if (partner) {
      setLayout({
        ...layout,
        cells: layout.cells.map(c =>
          c === cell ? { ...c, row, col } : c === partner ? { ...c, row: cell.row, col: cell.col } : c),
      })
    } else if (fitsAt(layout, { row, col, w: cell.w, h: cell.h }, cell)) {
      setLayout({ ...layout, cells: layout.cells.map(c => (c === cell ? { ...c, row, col } : c)) })
    } else {
      return
    }
    setSelected(posKey({ row, col }))
  }

  const keyProps = (cell: PadCell) => ({
    'data-pad-key': posKey(cell),
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      const spot = spotAt(e.clientX, e.clientY)
      if (!spot) return
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
      drag.current = { cell, pointerId: e.pointerId, x: e.clientX, y: e.clientY, grabRow: spot.row - cell.row, grabCol: spot.col - cell.col, moved: false }
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      const d = drag.current
      if (!d || d.pointerId !== e.pointerId) return
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return
      d.moved = true
      const at = landing(e.clientX, e.clientY)
      if (at) setGhost({ cell: d.cell, ...at })
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      const d = drag.current
      if (!d || d.pointerId !== e.pointerId) return
      const at = d.moved ? landing(e.clientX, e.clientY) : null
      drag.current = null
      setGhost(null)
      if (!d.moved) { setSelected(posKey(d.cell)); return }
      if (at) moveTo(d.cell, at.row, at.col)
    },
    onPointerCancel: () => { drag.current = null; setGhost(null) },
  })

  const addKeyAt = (row: number, col: number) => {
    if (!layout) return
    const cell: PadCell = { row, col, w: 1, h: 1, key: { kind: 'char', value: nextFreeDigit(layout) } }
    setLayout({ ...layout, cells: [...layout.cells, cell] })
    setSelected(posKey(cell))
  }

  const toggleCustom = (on: boolean) => {
    if (on) {
      setLayout(lastCustom.current ?? defaultPadLayout(null))
    } else {
      lastCustom.current = layout
      onChange(null)
      setSelected(null)
    }
  }

  const empties: React.ReactNode[] = []
  if (layout) {
    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.cols; col++) {
        if (cellAt(layout, row, col)) continue
        empties.push(
          <button
            key={`empty-${row}-${col}`}
            type="button"
            aria-label={`Add a key at row ${row + 1}, column ${col + 1}`}
            onClick={() => addKeyAt(row, col)}
            style={{
              gridRow: row + 1, gridColumn: col + 1,
              border: '1px dashed rgb(var(--ink-rgb) / 0.25)', borderRadius: 8,
              background: 'transparent', color: 'var(--ink-3)', fontSize: 18, cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            +
          </button>,
        )
      }
    }
  }
  if (ghost) {
    const ok = canLand(ghost.cell, ghost.row, ghost.col)
    empties.push(
      <div
        key="ghost"
        aria-hidden
        style={{
          gridRow: `${ghost.row + 1} / span ${ghost.cell.h}`, gridColumn: `${ghost.col + 1} / span ${ghost.cell.w}`,
          border: `2px solid ${ok ? 'var(--success)' : 'var(--danger)'}`, borderRadius: 8,
          background: ok ? 'rgba(76,175,80,0.12)' : 'rgba(244,67,54,0.12)',
          position: 'relative', zIndex: 2, pointerEvents: 'none',
        }}
      />,
    )
  }

  const kindButton = (k: PadKeyKind, text: string) => {
    if (!sel || !layout) return null
    const active = sel.key.kind === k
    const disabled = k === 'macro' && triggerOptions.length === 0
    return (
      <button
        key={k}
        type="button"
        disabled={disabled}
        title={disabled ? 'Add a macro mapping first' : undefined}
        onClick={() => replaceCell(sel, { ...sel, key: keyOfKind(k, sel.key, layout, entries) })}
        style={{
          ...btn,
          background: active ? 'var(--thread-accent)' : btn.background,
          color: active ? '#fff' : 'var(--ink-1)',
          borderColor: active ? 'var(--thread-accent)' : 'rgb(var(--ink-rgb) / 0.18)',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {text}
      </button>
    )
  }

  return (
    <div data-pad-editor style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--ink-1)' }}>Mobile keyboard</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--ink-2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!layout} onChange={e => toggleCustom(e.target.checked)} style={{ width: 18, height: 18 }} />
          Custom
        </label>
      </div>

      {layout && (
        <>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {PAD_TEMPLATES.map(t => (
                <button
                  key={t.name}
                  type="button"
                  style={btn}
                  onClick={() => {
                    if (layout.cells.length && !confirm(`Replace this layout with ${t.name}?`)) return
                    setLayout(clonePadLayout(t.layout)); setSelected(null)
                  }}
                >
                  {t.name}
                </button>
              ))}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
            <Stepper label="Rows" value={layout.rows} min={1} max={MAX_PAD_ROWS} onChange={n => setLayout(resizePadGrid(layout, n, layout.cols))} />
            <Stepper label="Columns" value={layout.cols} min={1} max={MAX_PAD_COLS} onChange={n => setLayout(resizePadGrid(layout, layout.rows, n))} />
          </div>

          <div
            data-pad-preview
            style={{ maxWidth: 420, marginTop: 12, background: 'var(--thread-bg, var(--background))', borderRadius: 10 }}
          >
            <PadGrid
              ref={gridRef}
              layout={layout}
              accent="var(--thread-accent)"
              submitLabel="Enter"
              keyProps={keyProps}
              cellStyle={c => ({
                outline: posKey(c) === selected ? '3px solid var(--thread-accent)' : undefined,
                outlineOffset: 1,
                opacity: ghost?.cell === c ? 0.45 : 1,
              })}
            >
              {empties}
            </PadGrid>
          </div>

          {sel && (
            <div
              data-pad-inspector
              style={{ marginTop: 12, maxWidth: 420, border: '1px solid rgb(var(--ink-rgb) / 0.14)', borderRadius: 10, padding: 12, display: 'grid', gap: 12 }}
            >
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {KIND_OPTIONS.map(o => kindButton(o.kind, o.label))}
              </div>

              {sel.key.kind === 'char' && (
                <input
                  style={inp}
                  aria-label="Character"
                  autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
                  value={sel.key.value}
                  placeholder="Character"
                  onChange={e => {
                    const typed = Array.from(e.target.value)
                    const value = typed.length > 1 ? typed[typed.length - 1] : typed.join('')
                    replaceCell(sel, { ...sel, key: { ...sel.key, kind: 'char', value } as PadKey })
                  }}
                />
              )}

              {sel.key.kind === 'macro' && (
                <select
                  style={{ ...inp, cursor: 'pointer' }}
                  aria-label="Macro"
                  value={sel.key.triggerKey}
                  onChange={e => replaceCell(sel, { ...sel, key: { ...sel.key, triggerKey: e.target.value } as PadKey })}
                >
                  {!triggerOptions.some(t => sel.key.kind === 'macro' && t.triggerKey === sel.key.triggerKey) && (
                    <option value={sel.key.triggerKey}>{sel.key.triggerKey ? triggerLabel(sel.key.triggerKey) : 'pick a macro'} (missing)</option>
                  )}
                  {triggerOptions.map(t => (
                    <option key={t.triggerKey} value={t.triggerKey}>
                      {triggerLabel(t.triggerKey)} · {MACRO_TYPE_LABEL[t.macroType]}
                    </option>
                  ))}
                </select>
              )}

              <input
                style={inp}
                aria-label="Label"
                autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
                value={sel.key.label ?? ''}
                maxLength={MAX_PAD_LABEL}
                placeholder="Label"
                onChange={e => {
                  const label = Array.from(e.target.value).slice(0, MAX_PAD_LABEL).join('')
                  const key = { ...sel.key, label } as PadKey
                  if (!label && key.kind !== 'macro') delete (key as { label?: string }).label
                  replaceCell(sel, { ...sel, key })
                }}
              />

              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Stepper
                  label="Width" value={sel.w} min={1} max={layout.cols}
                  canInc={fitsAt(layout, { ...sel, w: sel.w + 1 }, sel)}
                  onChange={w => replaceCell(sel, { ...sel, w })}
                />
                <Stepper
                  label="Height" value={sel.h} min={1} max={layout.rows}
                  canInc={fitsAt(layout, { ...sel, h: sel.h + 1 }, sel)}
                  onChange={h => replaceCell(sel, { ...sel, h })}
                />
                <div style={{ display: 'flex', gap: 4 }}>
                  {([['←', 0, -1], ['↑', -1, 0], ['↓', 1, 0], ['→', 0, 1]] as const).map(([glyph, dr, dc]) => {
                    const ok = canLand(sel, sel.row + dr, sel.col + dc)
                    return (
                      <button
                        key={glyph}
                        type="button"
                        aria-label={`Move ${glyph}`}
                        disabled={!ok}
                        style={{ ...btn, opacity: ok ? 1 : 0.35 }}
                        onClick={() => moveTo(sel, sel.row + dr, sel.col + dc)}
                      >
                        {glyph}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  style={{ ...btn, background: 'rgba(244,67,54,0.12)', borderColor: 'rgba(244,67,54,0.35)', color: 'var(--danger)' }}
                  onClick={() => { setLayout({ ...layout, cells: layout.cells.filter(c => c !== sel) }); setSelected(null) }}
                >
                  Remove
                </button>
                <button type="button" style={btn} onClick={() => setSelected(null)}>Done</button>
              </div>
            </div>
          )}

          {problems.length > 0 && (
            <div style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--danger)' }}>
              {problems.map((p, i) => <div key={i}>{p}</div>)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export const MAX_PAD_ROWS = 9
export const MAX_PAD_COLS = 8
export const MAX_PAD_LABEL = 8

export type PadKeyKind = 'char' | 'backspace' | 'enter' | 'space' | 'clear' | 'letters' | 'macro'

export type PadKey =
  | { kind: 'char'; value: string; label?: string }
  | { kind: 'backspace' | 'enter' | 'space' | 'clear' | 'letters'; label?: string }
  | { kind: 'macro'; triggerKey: string; label: string }

export type PadCell = { row: number; col: number; w: number; h: number; key: PadKey }

export type PadLayout = { rows: number; cols: number; cells: PadCell[] }

const ch = (row: number, col: number, value: string, w = 1, h = 1): PadCell => ({ row, col, w, h, key: { kind: 'char', value } })
const fixed = (row: number, col: number, kind: 'backspace' | 'enter' | 'space' | 'clear' | 'letters', w = 1, h = 1): PadCell => ({ row, col, w, h, key: { kind } })

const STANDARD: PadLayout = {
  rows: 4, cols: 4,
  cells: [
    ch(0, 0, '1'), ch(0, 1, '2'), ch(0, 2, '3'), fixed(0, 3, 'backspace'),
    ch(1, 0, '4'), ch(1, 1, '5'), ch(1, 2, '6'), ch(1, 3, ','),
    ch(2, 0, '7'), ch(2, 1, '8'), ch(2, 2, '9'), fixed(2, 3, 'enter', 1, 2),
    fixed(3, 0, 'space'), ch(3, 1, '0'), ch(3, 2, '.'),
  ],
}

const HEX: PadLayout = {
  rows: 4, cols: 5,
  cells: [
    ch(0, 0, '1'), ch(0, 1, '2'), ch(0, 2, '3'), ch(0, 3, 'A'), fixed(0, 4, 'backspace'),
    ch(1, 0, '4'), ch(1, 1, '5'), ch(1, 2, '6'), ch(1, 3, 'B'), ch(1, 4, 'C'),
    ch(2, 0, '7'), ch(2, 1, '8'), ch(2, 2, '9'), ch(2, 3, 'D'), fixed(2, 4, 'enter', 1, 2),
    ch(3, 0, 'E'), ch(3, 1, '0'), ch(3, 2, 'F'), fixed(3, 3, 'space'),
  ],
}

const BINARY: PadLayout = {
  rows: 2, cols: 3,
  cells: [
    ch(0, 0, '0'), ch(0, 1, '1'), fixed(0, 2, 'backspace'),
    fixed(1, 0, 'space'), fixed(1, 1, 'enter', 2, 1),
  ],
}

const DEFAULTS_BY_TYPE: Record<string, PadLayout> = {
  hexadecimal: HEX,
  binary: BINARY,
}

export const PAD_TEMPLATES: { name: string; layout: PadLayout }[] = [
  { name: 'Standard', layout: STANDARD },
  { name: 'Blank', layout: { rows: 4, cols: 4, cells: [] } },
]

export function clonePadLayout(layout: PadLayout): PadLayout {
  return { rows: layout.rows, cols: layout.cols, cells: layout.cells.map(c => ({ ...c, key: { ...c.key } as PadKey })) }
}

export function defaultPadLayout(validationType?: string | null): PadLayout {
  return clonePadLayout((validationType && DEFAULTS_BY_TYPE[validationType]) || STANDARD)
}

export function padKeyLabel(key: PadKey, submitLabel = 'Enter'): string {
  if (key.label) return key.label
  switch (key.kind) {
    case 'char': return key.value === ' ' ? '␣' : key.value
    case 'backspace': return '⌫'
    case 'enter': return submitLabel
    case 'space': return '␣'
    case 'clear': return 'Clear'
    case 'letters': return 'ABC'
    case 'macro': return key.triggerKey
  }
}

function spots(c: { row: number; col: number; w: number; h: number }): string[] {
  const out: string[] = []
  for (let r = c.row; r < c.row + c.h; r++) for (let k = c.col; k < c.col + c.w; k++) out.push(`${r},${k}`)
  return out
}

export function fitsAt(
  layout: PadLayout,
  rect: { row: number; col: number; w: number; h: number },
  ignore?: PadCell,
): boolean {
  if (rect.row < 0 || rect.col < 0 || rect.w < 1 || rect.h < 1) return false
  if (rect.row + rect.h > layout.rows || rect.col + rect.w > layout.cols) return false
  const taken = new Set(layout.cells.filter(c => c !== ignore).flatMap(spots))
  return spots(rect).every(s => !taken.has(s))
}

export function cellAt(layout: PadLayout, row: number, col: number): PadCell | undefined {
  return layout.cells.find(c => row >= c.row && row < c.row + c.h && col >= c.col && col < c.col + c.w)
}

export function resizePadGrid(layout: PadLayout, rows: number, cols: number): PadLayout {
  rows = Math.max(1, Math.min(MAX_PAD_ROWS, rows))
  cols = Math.max(1, Math.min(MAX_PAD_COLS, cols))
  const cells = layout.cells
    .filter(c => c.row < rows && c.col < cols)
    .map(c => ({ ...c, w: Math.min(c.w, cols - c.col), h: Math.min(c.h, rows - c.row) }))
  return { rows, cols, cells }
}

export function isValidPadLayout(layout: PadLayout): boolean {
  if (layout.rows < 1 || layout.rows > MAX_PAD_ROWS || layout.cols < 1 || layout.cols > MAX_PAD_COLS) return false
  const seen = new Set<string>()
  for (const c of layout.cells) {
    if (c.row < 0 || c.col < 0 || c.w < 1 || c.h < 1 || c.row + c.h > layout.rows || c.col + c.w > layout.cols) return false
    for (const s of spots(c)) {
      if (seen.has(s)) return false
      seen.add(s)
    }
  }
  return true
}

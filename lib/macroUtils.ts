export type MacroEntryType = 'CHAR_INSERT' | 'ACTION' | 'SUBMIT' | 'SUBMIT_ACTION' | 'TOGGLE' | 'COMBO'
export type MacroActionType =
  | 'BACKSPACE' | 'DELETE' | 'CTRL_BACKSPACE'
  | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN'
  | 'HOME' | 'END' | 'SELECT_ALL' | 'COPY' | 'PASTE'
export type MacroComboId = 'SELECT_ALL_COPY' | 'SELECT_ALL_PASTE'

export type MacroEntryPayload =
  | { char: string }
  | { action: MacroActionType; repeat?: number }
  | Record<string, never>
  | { comboId: MacroComboId }

export type MacroEntryDraft = {
  triggerKey: string
  macroType: MacroEntryType
  payloadJson: MacroEntryPayload
}

export type MacroEntry = {
  id: number
  triggerKey: string
  macroType: MacroEntryType
  payloadJson: MacroEntryPayload
}

export type MacroPresetVersion = {
  id: number
  macroPresetId: number
  versionNumber: number
  changeNote?: string
  createdAt: string
  entries: MacroEntry[]
  keyboardLayout?: import('./padLayout').PadLayout | null
}

export type MacroPreset = {
  id: number
  name: string
  handle: string
  description: string
  ownerCounter?: {
    uuid: string
    username: string
    name: string
    discordId: string
    avatar: string
    color: string
  }
  versions?: MacroPresetVersion[]
}

export type MacroPresetSummaryItem = {
  macroPresetId: number
  latestVersionNumber: number | null
  entries: MacroEntry[]
  threadUsage: { threadId: string; threadName: string; threadTitle?: string; appliesCount: number }[]
  threadUsageTotal: number
}

const MACRO_TRIGGER_KEY_ALIASES: Record<string, string> = {
  win: 'meta', windows: 'meta', cmd: 'meta', command: 'meta', os: 'meta',
  ctrl: 'control', option: 'alt', esc: 'escape', return: 'enter',
  up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright',
}

const NAMED_MACRO_TRIGGER_KEYS = new Set([
  'backspace', 'tab', 'enter', 'shift', 'control', 'alt', 'pause', 'capslock',
  'escape', 'space', 'pageup', 'pagedown', 'end', 'home',
  'arrowleft', 'arrowup', 'arrowright', 'arrowdown',
  'printscreen', 'insert', 'delete', 'meta', 'contextmenu', 'numlock', 'scrolllock',
])

const CODE_STYLE_TRIGGER_PATTERNS = [
  /^key[a-z]$/,
  /^digit[0-9]$/,
  /^numpad[0-9]$/,
  /^f([1-9]|1[0-9]|2[0-4])$/,
  /^(shift|control|alt|meta)(left|right)$/,
  /^(backquote|minus|equal|bracketleft|bracketright|backslash|semicolon|quote|comma|period|slash)$/,
  /^numpad(add|subtract|multiply|divide|decimal|enter|equal|comma|parenleft|parenright)$/,
  /^intl(backslash|ro|yen)$/,
]

export function normalizeMacroTriggerKey(key: string): string {
  const raw = (key || '').toLowerCase()
  if (raw === ' ' || raw === 'spacebar') return 'space'
  const normalized = raw.trim()
  return MACRO_TRIGGER_KEY_ALIASES[normalized] || normalized
}

const PAD_ONLY_TRIGGER_PATTERN = /^pad:[1-9][0-9]?$/

export function isPadOnlyTrigger(key: string): boolean {
  return PAD_ONLY_TRIGGER_PATTERN.test(normalizeMacroTriggerKey(key))
}

export function nextPadOnlyTrigger(entries: { triggerKey: string }[]): string {
  const used = new Set(entries.map(e => normalizeMacroTriggerKey(e.triggerKey)))
  for (let n = 1; n <= 99; n++) if (!used.has(`pad:${n}`)) return `pad:${n}`
  return 'pad:99'
}

export function triggerLabel(key: string): string {
  return isPadOnlyTrigger(key) ? `Pad ${normalizeMacroTriggerKey(key).slice(4)}` : key
}

export function isValidMacroTriggerKey(key: string): boolean {
  const normalized = normalizeMacroTriggerKey(key)
  if (!normalized || normalized.length > 64) return false
  if (Array.from(normalized).length === 1) return true
  if (NAMED_MACRO_TRIGGER_KEYS.has(normalized)) return true
  if (PAD_ONLY_TRIGGER_PATTERN.test(normalized)) return true
  return CODE_STYLE_TRIGGER_PATTERNS.some((pattern) => pattern.test(normalized))
}

export function prioritizeOwnedMacroPresets(presets: MacroPreset[], ownedIds: Set<number>): MacroPreset[] {
  const owned = presets.filter((p) => ownedIds.has(p.id)).sort((a, b) => a.name.localeCompare(b.name))
  const rest = presets.filter((p) => !ownedIds.has(p.id)).sort((a, b) => a.name.localeCompare(b.name))
  return [...owned, ...rest]
}

export const HANDLE_REGEX = /^[a-z][a-z0-9_-]{2,63}$/

export const ACTION_OPTIONS: MacroActionType[] = [
  'BACKSPACE', 'DELETE', 'CTRL_BACKSPACE',
  'LEFT', 'RIGHT', 'UP', 'DOWN',
  'HOME', 'END', 'SELECT_ALL', 'COPY', 'PASTE',
]

export const COMBO_OPTIONS: MacroComboId[] = ['SELECT_ALL_COPY', 'SELECT_ALL_PASTE']

export const MACRO_TYPE_OPTIONS: MacroEntryType[] = ['CHAR_INSERT', 'ACTION', 'SUBMIT', 'SUBMIT_ACTION', 'TOGGLE', 'COMBO']

export const MACRO_TYPE_LABEL: Record<MacroEntryType, string> = {
  CHAR_INSERT: 'Character Remap',
  ACTION: 'Action',
  SUBMIT: 'Submit',
  SUBMIT_ACTION: 'Submit + Action',
  TOGGLE: 'Toggle',
  COMBO: 'Combo',
}

export const ACTION_LABEL: Record<MacroActionType, string> = {
  BACKSPACE: 'Backspace', DELETE: 'Delete', CTRL_BACKSPACE: 'Ctrl+Backspace',
  LEFT: 'Left', RIGHT: 'Right', UP: 'Up', DOWN: 'Down',
  HOME: 'Home', END: 'End', SELECT_ALL: 'Select All', COPY: 'Copy', PASTE: 'Paste',
}

export const COMBO_LABEL: Record<MacroComboId, string> = {
  SELECT_ALL_COPY: 'Select All + Copy',
  SELECT_ALL_PASTE: 'Select All + Paste',
}

export const MAX_ENTRIES = 100
export const MAX_REPEAT = 256
export const MAX_TRIGGERS_PER_CHAR = 2
export const MAX_SUBMIT_MACROS = 10

export type DraftValidationResult = {
  rowErrors: Record<number, string[]>
  globalErrors: string[]
}

export function validateEntries(entries: MacroEntryDraft[]): DraftValidationResult {
  const rowErrors: Record<number, string[]> = {}
  const globalErrors: string[] = []
  const seenTriggers = new Set<string>()
  const charCounts = new Map<string, number>()
  let submitCount = 0

  if (entries.length > MAX_ENTRIES) globalErrors.push(`Too many entries (max ${MAX_ENTRIES}).`)

  entries.forEach((entry, index) => {
    const errs: string[] = []
    const payload = (entry.payloadJson || {}) as Record<string, unknown>
    const trigger = (entry.triggerKey || '').trim()

    if (!trigger) {
      errs.push('Trigger is required.')
    } else {
      const normalized = trigger.toLowerCase()
      if (seenTriggers.has(normalized)) errs.push('Trigger is duplicated.')
      seenTriggers.add(normalized)
      if (!isValidMacroTriggerKey(normalized)) errs.push('Trigger key is not a supported key/code.')
    }

    if (entry.macroType === 'CHAR_INSERT') {
      const c = typeof payload.char === 'string' ? payload.char : ''
      if (Array.from(c).length !== 1) {
        errs.push('Character remap target must be exactly one character.')
      } else {
        const next = (charCounts.get(c) || 0) + 1
        charCounts.set(c, next)
        if (next > MAX_TRIGGERS_PER_CHAR) errs.push(`At most ${MAX_TRIGGERS_PER_CHAR} triggers can map to "${c}".`)
      }
    }

    if (entry.macroType === 'ACTION' || entry.macroType === 'SUBMIT_ACTION') {
      if (!ACTION_OPTIONS.includes(payload.action as MacroActionType)) errs.push('Action is invalid.')
      const repeatValue = payload.repeat === undefined || payload.repeat === null ? 1 : Number(payload.repeat)
      if (!Number.isInteger(repeatValue) || repeatValue < 1 || repeatValue > MAX_REPEAT)
        errs.push(`Repeat must be an integer from 1 to ${MAX_REPEAT}.`)
    }

    if (entry.macroType === 'SUBMIT' || entry.macroType === 'TOGGLE') {
      if (payload.action !== undefined || payload.repeat !== undefined || payload.submit !== undefined || payload.comboId !== undefined || payload.char !== undefined)
        errs.push(`${entry.macroType} cannot include payload fields.`)
    }

    if (entry.macroType === 'COMBO') {
      if (!COMBO_OPTIONS.includes(payload.comboId as MacroComboId)) errs.push('Combo is invalid.')
    }

    if (entry.macroType === 'SUBMIT' || entry.macroType === 'SUBMIT_ACTION') submitCount++

    if (errs.length > 0) rowErrors[index] = errs
  })

  if (submitCount > MAX_SUBMIT_MACROS) globalErrors.push(`At most ${MAX_SUBMIT_MACROS} submit-related macros are allowed.`)

  return { rowErrors, globalErrors }
}

export function defaultEntryByType(macroType: MacroEntryType): MacroEntryDraft {
  switch (macroType) {
    case 'CHAR_INSERT': return { triggerKey: '', macroType, payloadJson: { char: '1' } }
    case 'ACTION': return { triggerKey: '', macroType, payloadJson: { action: 'BACKSPACE' } }
    case 'SUBMIT': return { triggerKey: '', macroType, payloadJson: {} }
    case 'SUBMIT_ACTION': return { triggerKey: '', macroType, payloadJson: { action: 'BACKSPACE', repeat: 1 } }
    case 'TOGGLE': return { triggerKey: '', macroType, payloadJson: {} }
    case 'COMBO': return { triggerKey: '', macroType, payloadJson: { comboId: 'SELECT_ALL_PASTE' } }
  }
}

export function buildGroupedPreviewRows(entries: MacroEntry[]): string[] {
  const groups: Record<string, string[]> = {
    'Character remaps': [], Submit: [], Actions: [], Combos: [], Toggle: [],
  }
  for (const entry of entries) {
    const payload = entry.payloadJson as any
    const t = triggerLabel(entry.triggerKey)
    if (entry.macroType === 'CHAR_INSERT') { groups['Character remaps'].push(`${t}->${payload.char || ''}`); continue }
    if (entry.macroType === 'SUBMIT') { groups.Submit.push(t); continue }
    if (entry.macroType === 'SUBMIT_ACTION') { groups.Submit.push(`${t}+${String(payload.action || '').toLowerCase()} x${payload.repeat ?? 1}`); continue }
    if (entry.macroType === 'ACTION') { groups.Actions.push(`${t}:${String(payload.action || '').toLowerCase()} x${payload.repeat ?? 1}`); continue }
    if (entry.macroType === 'COMBO') { groups.Combos.push(`${t}:${String(payload.comboId || '').toLowerCase()}`); continue }
    if (entry.macroType === 'TOGGLE') { groups.Toggle.push(t) }
  }
  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .slice(0, 4)
    .map(([label, items]) => `${label}: ${items.slice(0, 4).join(', ')}${items.length > 4 ? ` +${items.length - 4}` : ''}`)
}

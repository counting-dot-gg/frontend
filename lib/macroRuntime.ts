import type { MacroActionType, MacroComboId, MacroEntry } from './macroUtils'
import { normalizeMacroTriggerKey } from './macroUtils'
import type { PadLayout } from './padLayout'

export const MACRO_TOGGLE_KEY = 'F8'
export const MAX_MACRO_REPEAT = 256

export type ActiveMacroRuntime = {
  source: 'none' | 'global' | 'thread'
  enabled: boolean
  macroPresetId: number | null
  macroPresetVersionId: number | null
  macroPresetVersionNumber: number | null
  entries: MacroEntry[]
  keyboardLayout?: PadLayout | null
}

export function getMacroTriggerCandidates(key: string, code?: string): string[] {
  const candidates: string[] = []
  const add = (value: string) => {
    const normalized = normalizeMacroTriggerKey(value)
    if (normalized && !candidates.includes(normalized)) candidates.push(normalized)
  }

  if (code) add(code)
  if (key) add(key)

  const normalizedCode = normalizeMacroTriggerKey(code || '')
  const keyCodeMatch = normalizedCode.match(/^key([a-z])$/)
  if (keyCodeMatch?.[1]) add(keyCodeMatch[1])
  const digitCodeMatch = normalizedCode.match(/^digit([0-9])$/)
  if (digitCodeMatch?.[1]) add(digitCodeMatch[1])
  const numpadCodeMatch = normalizedCode.match(/^numpad([0-9])$/)
  if (numpadCodeMatch?.[1]) add(numpadCodeMatch[1])

  return candidates
}

export function findActiveMacroEntry(
  runtime: ActiveMacroRuntime | null | undefined,
  key: string,
  code: string | undefined,
): MacroEntry | undefined {
  if (!runtime || !runtime.enabled || !runtime.entries?.length) return undefined
  const candidates = getMacroTriggerCandidates(key, code)
  return runtime.entries.find(e => candidates.includes(normalizeMacroTriggerKey(e.triggerKey)))
}

export function findToggleMacroEntry(
  runtime: ActiveMacroRuntime | null | undefined,
  key: string,
  code: string | undefined,
): MacroEntry | undefined {
  if (!runtime?.entries?.length) return undefined
  const candidates = getMacroTriggerCandidates(key, code)
  return runtime.entries.find(
    e => e.macroType === 'TOGGLE' && candidates.includes(normalizeMacroTriggerKey(e.triggerKey)),
  )
}

export function buildMacroSubmitMetadata(runtime: ActiveMacroRuntime | null | undefined) {
  if (!runtime || !runtime.enabled) return undefined
  if (!runtime.macroPresetId || !runtime.macroPresetVersionId) return undefined
  return {
    macroPresetId: runtime.macroPresetId,
    macroPresetVersionId: runtime.macroPresetVersionId,
  }
}

export function replaceInputSelection(el: HTMLTextAreaElement, text: string) {
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  el.value = `${el.value.slice(0, start)}${text}${el.value.slice(end)}`
  const next = start + text.length
  el.setSelectionRange(next, next)
}

function moveCursorVertical(el: HTMLTextAreaElement, direction: -1 | 1) {
  const value = el.value || ''
  const start = el.selectionStart ?? value.length

  if (!value.includes('\n')) {
    const next = direction < 0 ? 0 : value.length
    el.setSelectionRange(next, next)
    return
  }

  const lineStarts = [0]
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === '\n') lineStarts.push(i + 1)
  }
  const lineEnds = lineStarts.map((s, i) => (i + 1 < lineStarts.length ? lineStarts[i + 1] - 1 : value.length))

  let currentLine = lineStarts.length - 1
  for (let i = 0; i < lineStarts.length; i += 1) {
    if (start >= lineStarts[i] && start <= lineEnds[i]) { currentLine = i; break }
  }

  const targetLine = Math.max(0, Math.min(lineStarts.length - 1, currentLine + direction))
  const column = start - lineStarts[currentLine]
  const targetLen = lineEnds[targetLine] - lineStarts[targetLine]
  const next = lineStarts[targetLine] + Math.max(0, Math.min(column, targetLen))
  el.setSelectionRange(next, next)
}

function applyCtrlBackspace(el: HTMLTextAreaElement) {
  const start = el.selectionStart ?? 0
  const end = el.selectionEnd ?? 0
  if (end > start) {
    el.value = `${el.value.slice(0, start)}${el.value.slice(end)}`
    el.setSelectionRange(start, start)
    return
  }
  if (start <= 0) return

  let cut = start
  while (cut > 0 && /\s/u.test(el.value[cut - 1])) cut -= 1
  while (cut > 0 && !/\s/u.test(el.value[cut - 1])) cut -= 1

  el.value = `${el.value.slice(0, cut)}${el.value.slice(start)}`
  el.setSelectionRange(cut, cut)
}

export async function applySingleAction(el: HTMLTextAreaElement, action: MacroActionType) {
  const start = el.selectionStart ?? 0
  const end = el.selectionEnd ?? 0
  const hasSelection = end > start

  switch (action) {
    case 'BACKSPACE':
      if (hasSelection) {
        el.value = `${el.value.slice(0, start)}${el.value.slice(end)}`
        el.setSelectionRange(start, start)
      } else if (start > 0) {
        el.value = `${el.value.slice(0, start - 1)}${el.value.slice(end)}`
        el.setSelectionRange(start - 1, start - 1)
      }
      return
    case 'DELETE':
      if (hasSelection) {
        el.value = `${el.value.slice(0, start)}${el.value.slice(end)}`
        el.setSelectionRange(start, start)
      } else if (start < el.value.length) {
        el.value = `${el.value.slice(0, start)}${el.value.slice(start + 1)}`
        el.setSelectionRange(start, start)
      }
      return
    case 'CTRL_BACKSPACE': applyCtrlBackspace(el); return
    case 'LEFT': { const n = Math.max(0, start - 1); el.setSelectionRange(n, n); return }
    case 'RIGHT': { const n = Math.min(el.value.length, end + 1); el.setSelectionRange(n, n); return }
    case 'UP': moveCursorVertical(el, -1); return
    case 'DOWN': moveCursorVertical(el, 1); return
    case 'HOME': el.setSelectionRange(0, 0); return
    case 'END': { const n = el.value.length; el.setSelectionRange(n, n); return }
    case 'SELECT_ALL': el.setSelectionRange(0, el.value.length); return
    case 'COPY': {
      const selected = hasSelection ? el.value.slice(start, end) : el.value
      try { await navigator.clipboard.writeText(selected) } catch {}
      return
    }
    case 'PASTE': {
      try { replaceInputSelection(el, await navigator.clipboard.readText()) } catch {}
      return
    }
  }
}

export async function applyActionRepeated(el: HTMLTextAreaElement, action: MacroActionType, repeat = 1) {
  const reps = Math.max(1, Math.min(MAX_MACRO_REPEAT, Number.isFinite(repeat) ? Math.floor(repeat) : 1))
  for (let i = 0; i < reps; i += 1) await applySingleAction(el, action)
}

export async function executeCombo(el: HTMLTextAreaElement, comboId: MacroComboId) {
  switch (comboId) {
    case 'SELECT_ALL_COPY':
      await applySingleAction(el, 'SELECT_ALL')
      await applySingleAction(el, 'COPY')
      return
    case 'SELECT_ALL_PASTE':
      await applySingleAction(el, 'SELECT_ALL')
      await applySingleAction(el, 'PASTE')
      return
  }
}

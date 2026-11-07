import { isDecimalValidationType } from '@/lib/validationTypes'

export type KeyboardMode = 'numeric' | 'text' | 'pad'

const storageKey = (threadName: string) => `cgg.kbmode.${threadName}`

export function defaultKeyboardMode(validationType?: string | null): KeyboardMode {
  return isDecimalValidationType(validationType) ? 'numeric' : 'text'
}

export function loadKeyboardMode(threadName: string, validationType?: string | null): KeyboardMode {
  try {
    const saved = window.localStorage.getItem(storageKey(threadName))
    if (saved === 'numeric' || saved === 'text' || saved === 'pad') return saved
  } catch {
  }
  return defaultKeyboardMode(validationType)
}

export function saveKeyboardMode(threadName: string, mode: KeyboardMode): void {
  try {
    window.localStorage.setItem(storageKey(threadName), mode)
  } catch {
  }
}

export function inputModeFor(mode: KeyboardMode): 'decimal' | 'text' | 'none' {
  if (mode === 'pad') return 'none'
  return mode === 'numeric' ? 'decimal' : 'text'
}

export function nextKeyboardMode(mode: KeyboardMode): KeyboardMode {
  return mode === 'numeric' ? 'pad' : mode === 'pad' ? 'text' : 'numeric'
}

export function keyboardModeLabel(mode: KeyboardMode): string {
  return mode === 'numeric' ? '123' : mode === 'pad' ? 'PAD' : 'ABC'
}

export function keyboardModeTitle(mode: KeyboardMode): string {
  return mode === 'numeric' ? 'Number pad'
    : mode === 'pad' ? 'Pad with Enter'
    : 'Letters'
}

'use client'

import { useRef, useCallback, useState, useEffect, useMemo } from 'react'
import { sendPost } from '@/lib/regional'
import {
  type KeyboardMode, defaultKeyboardMode, inputModeFor, keyboardModeLabel, keyboardModeTitle,
  loadKeyboardMode, nextKeyboardMode, saveKeyboardMode,
} from '@/lib/keyboardMode'
import CountPad, { type PadTarget } from './CountPad'
import { defaultPadLayout } from '@/lib/padLayout'
import type { Socket } from 'socket.io-client'
import { usePrefs } from './PrefsContext'
import EmotePicker from './EmotePicker'
import dynamic from 'next/dynamic'
import { normalizeShortcodes } from '@/lib/nativeEmoji'
import {
  MACRO_TOGGLE_KEY,
  MAX_MACRO_REPEAT,
  applyActionRepeated,
  buildMacroSubmitMetadata,
  executeCombo,
  findActiveMacroEntry,
  findToggleMacroEntry,
  replaceInputSelection,
  type ActiveMacroRuntime,
} from '@/lib/macroRuntime'
import type { MacroActionType, MacroComboId, MacroEntry } from '@/lib/macroUtils'
import { normalizeMacroTriggerKey } from '@/lib/macroUtils'

const EmojiAutocomplete = dynamic(() => import('./EmojiAutocomplete'), { ssr: false })

interface SubmitBoxProps {
  threadName: string
  padHidden?: boolean
  socket: Socket | null
  isLive: boolean
  isLoggedIn: boolean
  pendingHashesRef: React.RefObject<Map<string, number>>
  inline?: boolean
  userUUID?: string
  userRoles?: string[]
  threadLocked?: boolean
  threadPostBans?: string[]
  threadUpdatableBy?: string[]
  threadValidationType?: string
  isTugOfWarStalled?: () => boolean
  macroRuntime?: ActiveMacroRuntime | null
  macrosEnabled?: boolean
  onMacrosEnabledChange?: (enabled: boolean) => void
  onSubmit?: (text: string) => void | Promise<void>
  fixedIntervalMs?: number
  placeholder?: string
  forceClearMode?: string
}

const MIN_INTERVAL_MS = 35
const BURST_STEP_MS = 20
const MAX_INTERVAL_MS = 500
const SLOW_THREAD_INTERVAL_MS = 1000
const BURST_DECAY_MS = 3000
const MAX_TEXTAREA_ROWS = 4

const OUTBOX_BURST_LIMIT = 12
const OUTBOX_FLUSH_INTERVAL_MS = 100
const MAX_OUTBOX = 100

const MAX_POST_LEN = 4096

type QueuedPost = {
  threadName: string
  text: string
  macroMetadata: unknown
}

export default function SubmitBox({
  threadName, padHidden = false, socket, isLive, isLoggedIn, pendingHashesRef, inline,
  onSubmit, fixedIntervalMs, placeholder, forceClearMode,
  userUUID, userRoles, threadLocked, threadPostBans, threadUpdatableBy,
  threadValidationType, isTugOfWarStalled, macroRuntime, macrosEnabled = true, onMacrosEnabledChange,
}: SubmitBoxProps) {
  const slowThread = threadValidationType === 'bars'

  const colonIsCountSyntax = threadValidationType === 'time' || threadValidationType === 'military'
  const prefs = usePrefs()
  const [keyboardMode, setKeyboardMode] = useState<KeyboardMode>(() => defaultKeyboardMode(threadValidationType))
  const [showKeyboardToggle, setShowKeyboardToggle] = useState(false)

  useEffect(() => {
    setKeyboardMode(loadKeyboardMode(threadName, threadValidationType))
  }, [threadName, threadValidationType])

  useEffect(() => {
    setShowKeyboardToggle(window.matchMedia?.('(pointer: coarse)').matches ?? false)
  }, [])

  const applyKeyboardMode = useCallback((next: KeyboardMode) => {
    setKeyboardMode(next)
    saveKeyboardMode(threadName, next)
    const el = inputRef.current
    if (!el) return

    if (next === 'pad') {
      el.blur()
      return
    }
    const { selectionStart, selectionEnd } = el
    el.blur()
    requestAnimationFrame(() => {
      el.focus()
      try { el.setSelectionRange(selectionStart, selectionEnd) } catch {}
    })
  }, [threadName])

  const toggleKeyboard = useCallback(() => {
    applyKeyboardMode(nextKeyboardMode(keyboardMode))
  }, [applyKeyboardMode, keyboardMode])

  const inputRef = useRef<HTMLTextAreaElement>(null)

  const [autocompleteReady, setAutocompleteReady] = useState(false)
  useEffect(() => {
    if (autocompleteReady || colonIsCountSyntax) return
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    }).requestIdleCallback
    if (typeof ric === 'function') {
      const id = ric(() => setAutocompleteReady(true), { timeout: 3000 })
      const cancel = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback
      return () => { if (typeof cancel === 'function') cancel(id) }
    }
    const t = setTimeout(() => setAutocompleteReady(true), 1500)
    return () => clearTimeout(t)
  }, [autocompleteReady, colonIsCountSyntax])

  useEffect(() => {
    const el = inputRef.current
    if (!el || el.disabled) return
    if (window.matchMedia?.('(pointer: coarse)').matches) return

    const active = document.activeElement
    const inPicker = active instanceof Element && !!active.closest('[data-thread-picker]')
    if (active && active !== document.body && active !== el && !inPicker) return

    el.focus({ preventScroll: true })
  }, [isLive, threadName])
  const customInputRef = useRef<HTMLInputElement>(null)
  const noClearKeepRef = useRef<HTMLInputElement>(null)
  const noClearDeleteRef = useRef<HTMLInputElement>(null)
  const clearPositionRef = useRef<HTMLInputElement>(null)
  const lastSubmitPerf = useRef(0)
  const burstCount = useRef(0)
  const lastAttemptPerf = useRef(0)
  const [feedback, setFeedback] = useState<'idle' | 'throttled' | 'error' | 'offline' | 'full'>('idle')
  const [tooLong, setTooLong] = useState(0)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const outboxRef = useRef<QueuedPost[]>([])
  const [outboxSize, setOutboxSize] = useState(0)
  const flushingRef = useRef(false)

  const mountedThread = useRef(threadName)
  useEffect(() => {
    if (mountedThread.current === threadName) return
    mountedThread.current = threadName

    const el = inputRef.current
    if (el) {
      el.value = ''
      el.style.height = 'auto'
    }
  }, [threadName])

  const clearMode = forceClearMode ?? prefs.pref_clear
  const submitShortcut = prefs.pref_submit_shortcut

  const showFeedback = useCallback((state: 'throttled' | 'error' | 'offline' | 'full') => {
    setFeedback(state)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setFeedback('idle'), 600)
  }, [])

  const showCooldownBar = fixedIntervalMs != null

  const cooldownRef = useRef<HTMLDivElement>(null)
  const cooldownAnim = useRef<Animation | null>(null)
  const runCooldown = useCallback((ms: number) => {
    const el = cooldownRef.current
    if (!el || ms <= 0) return
    cooldownAnim.current?.cancel()
    if (typeof el.animate !== 'function') return
    cooldownAnim.current = el.animate(
      [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
      { duration: ms, easing: 'linear', fill: 'forwards' },
    )
  }, [])

  const applyStartPosition = useCallback((input: HTMLInputElement | HTMLTextAreaElement) => {
    const raw = parseInt(clearPositionRef.current?.value ?? '', 10)
    if (!Number.isFinite(raw)) return
    const pos = Math.max(0, Math.min(raw, input.value.length))
    input.setSelectionRange(pos, pos)
  }, [])

  type PadField = 'main' | 'custom' | 'position' | 'keep' | 'delete'
  const [padField, setPadField] = useState<PadField>('main')

  const padTargetFor = useCallback((field: PadField): PadTarget | null => {
    switch (field) {
      case 'custom': return customInputRef.current
      case 'position': return clearPositionRef.current
      case 'keep': return noClearKeepRef.current
      case 'delete': return noClearDeleteRef.current
      default: return inputRef.current
    }
  }, [])

  const getPadTarget = useCallback(() => padTargetFor(padField), [padTargetFor, padField])


  const padFieldProps = useCallback((field: PadField) => {
    if (!showKeyboardToggle || keyboardMode !== 'pad') return {}
    return {
      readOnly: true,
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault()
        setPadField(field)
      },
      onFocus: (e: React.FocusEvent<HTMLElement>) => {
        e.currentTarget.blur()
      },
      style: undefined as React.CSSProperties | undefined,
    }
  }, [showKeyboardToggle, keyboardMode])

  const padRing = useCallback((field: PadField): React.CSSProperties =>
    showKeyboardToggle && keyboardMode === 'pad' && padField === field
      ? { outline: '2px solid var(--thread-accent)', outlineOffset: -1 }
      : {},
  [showKeyboardToggle, keyboardMode, padField])

  const refocusAfterSubmit = useCallback(() => {
    if (keyboardMode === 'pad') return
    inputRef.current?.focus()
  }, [keyboardMode])

  const applyClear = useCallback(async () => {
    const input = inputRef.current
    if (!input) return
    if (clearMode === 'Clear') {
      input.value = ''
    } else if (clearMode === 'Clipboard') {
      try { input.value = await navigator.clipboard.readText() } catch { input.value = '' }
      applyStartPosition(input)
    } else if (clearMode === 'Custom') {
      input.value = customInputRef.current?.value ?? ''
      applyStartPosition(input)
    } else if (clearMode === 'No Clear') {
      const current = input.value
      const keepRaw = parseInt(noClearKeepRef.current?.value ?? '', 10)
      const deleteRaw = parseInt(noClearDeleteRef.current?.value ?? '', 10)
      const keepCount = Number.isFinite(keepRaw) ? Math.max(0, keepRaw) : current.length
      const deleteCount = Number.isFinite(deleteRaw) ? Math.max(0, deleteRaw) : 0
      const kept = current.substring(0, Math.min(keepCount, current.length))
      const cursor = Math.max(0, Math.min(input.selectionStart ?? kept.length, kept.length))
      const deleteStart = Math.max(0, cursor - deleteCount)
      input.value = kept.substring(0, deleteStart) + kept.substring(cursor)
      input.setSelectionRange(deleteStart, deleteStart)
    }
  }, [clearMode, applyStartPosition])

  const flushOutbox = useCallback(async () => {
    if (flushingRef.current) return
    if (!socket?.connected || outboxRef.current.length === 0) return

    flushingRef.current = true
    try {
      let sent = 0
      while (outboxRef.current.length > 0) {
        if (!socket.connected) break

        const queued = outboxRef.current[0]
        const sentAt = Date.now()
        const post_hash = (Math.random() * 100000000000000000).toString(36)
        pendingHashesRef.current?.set(post_hash, sentAt)

        sendPost(socket, {
          thread_name: queued.threadName,
          text: queued.text,
          post_hash,
          macroMetadata: queued.macroMetadata,
        })

        outboxRef.current.shift()
        setOutboxSize(outboxRef.current.length)
        lastSubmitPerf.current = performance.now()
        sent++

        if (outboxRef.current.length > 0 && sent >= OUTBOX_BURST_LIMIT) {
          await new Promise(r => setTimeout(r, OUTBOX_FLUSH_INTERVAL_MS))
        }
      }
    } finally {
      flushingRef.current = false
    }
  }, [socket, pendingHashesRef])

  useEffect(() => {
    if (!socket) return
    socket.on('connect', flushOutbox)
    if (socket.connected) void flushOutbox()
    return () => { socket.off('connect', flushOutbox) }
  }, [socket, flushOutbox])

  const submit = useCallback(async () => {
    const input = inputRef.current
    if (!input) return
    const text = normalizeShortcodes(input.value.trim())
    if (!text) return
    if (text.length > MAX_POST_LEN) {
      setTooLong(text.length)
      showFeedback('full')
      return
    }

    const connected = onSubmit ? isLive : isLive && !!socket?.connected

    if (!onSubmit && (!connected || outboxRef.current.length > 0)) {
      if (outboxRef.current.length >= MAX_OUTBOX) {
        showFeedback('full')
        return
      }

      outboxRef.current.push({
        threadName,
        text,
        macroMetadata: buildMacroSubmitMetadata(macrosEnabled ? macroRuntime : null),
      })
      setOutboxSize(outboxRef.current.length)

      await applyClear()
      fitHeight(input)
      refocusAfterSubmit()
      showFeedback('offline')

      if (connected) void flushOutbox()
      return
    }

    if (!connected) {
      showFeedback('offline')
      return
    }

    const now = performance.now()

    if (now - lastAttemptPerf.current > BURST_DECAY_MS) burstCount.current = 0
    lastAttemptPerf.current = now

    const required = fixedIntervalMs != null
      ? fixedIntervalMs
      : slowThread || isTugOfWarStalled?.()
        ? SLOW_THREAD_INTERVAL_MS
        : Math.min(MAX_INTERVAL_MS, MIN_INTERVAL_MS + burstCount.current * BURST_STEP_MS)

    if (now - lastSubmitPerf.current < required) {
      burstCount.current += 1
      showFeedback('throttled')
      return
    }
    burstCount.current = 0
    runCooldown(required)

    if (onSubmit) {
      lastSubmitPerf.current = now
      await applyClear()
      fitHeight(input)
      refocusAfterSubmit()
      await onSubmit(text)
      return
    }

    if (!socket) return

    const submitAt = Date.now()
    const post_hash = (Math.random() * 100000000000000000).toString(36)
    pendingHashesRef.current?.set(post_hash, submitAt)

    sendPost(socket, {
      thread_name: threadName,
      text,
      post_hash,
      macroMetadata: buildMacroSubmitMetadata(
        macrosEnabled ? macroRuntime : null,
      ),
    })

    lastSubmitPerf.current = now

    await applyClear()
    fitHeight(input)
    refocusAfterSubmit()
  }, [socket, isLive, threadName, showFeedback, pendingHashesRef, applyClear, macroRuntime, macrosEnabled, slowThread, isTugOfWarStalled, onSubmit, fixedIntervalMs, runCooldown, flushOutbox, refocusAfterSubmit])

  const emojiKeyHandlerRef = useRef<((e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean) | null>(null)
  const onEmojiHandlerReady = useCallback((fn: ((e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean) | null) => {
    emojiKeyHandlerRef.current = fn
  }, [])
  const onEmojiInsert = useCallback(() => {}, [])

  const runMacroEntry = useCallback(async (entry: MacroEntry, el: HTMLTextAreaElement) => {
    const payload = entry.payloadJson as Record<string, any> | null
    const repeat = Math.max(1, Math.min(MAX_MACRO_REPEAT, Number(payload?.repeat ?? 1)))
    const action = payload?.action as MacroActionType | undefined

    switch (entry.macroType) {
      case 'CHAR_INSERT': {
        const char = typeof payload?.char === 'string' ? payload.char.slice(0, 1) : ''
        if (char) {
          replaceInputSelection(el, char)
        }
        return
      }
      case 'ACTION': {
        if (action) {
          await applyActionRepeated(el, action, repeat)
        }
        return
      }
      case 'SUBMIT': {
        await submit()
        return
      }
      case 'SUBMIT_ACTION': {
        await submit()
        if (action) await applyActionRepeated(el, action, repeat)
        return
      }
      case 'COMBO': {
        const comboId = payload?.comboId as MacroComboId | undefined
        if (comboId) {
          await executeCombo(el, comboId)
        }
        return
      }
    }
  }, [submit])

  const onPadMacroKey = useCallback(async (triggerKey: string) => {
    const el = inputRef.current
    if (!el) return
    const wanted = normalizeMacroTriggerKey(triggerKey)
    const entry = macroRuntime?.entries?.find(e => normalizeMacroTriggerKey(e.triggerKey) === wanted)
    if (!entry) return
    if (entry.macroType === 'TOGGLE') { onMacrosEnabledChange?.(!macrosEnabled); return }
    if (!macrosEnabled) return
    el.setSelectionRange(el.value.length, el.value.length)
    await runMacroEntry(entry, el)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, [macroRuntime, macrosEnabled, onMacrosEnabledChange, runMacroEntry])

  const padLayout = useMemo(
    () => macroRuntime?.keyboardLayout ?? defaultPadLayout(threadValidationType),
    [macroRuntime?.keyboardLayout, threadValidationType],
  )

  const onKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (emojiKeyHandlerRef.current?.(e)) return

    const el = inputRef.current
    const isAutoRepeat = e.repeat
    const imeEcho = e.nativeEvent.isComposing || e.key === 'Process'

    const hasMacros = !!macroRuntime?.entries?.length

    if (hasMacros && String(e.key).toUpperCase() === MACRO_TOGGLE_KEY && !isAutoRepeat) {
      e.preventDefault()
      onMacrosEnabledChange?.(!macrosEnabled)
      return
    }

    if (hasMacros && el && !imeEcho) {
      const isCtrlEnter = (e.ctrlKey || e.metaKey) && e.key === 'Enter'
      const modified = (e.ctrlKey || e.metaKey || e.altKey) && !isCtrlEnter

      if (!modified) {
        const toggleEntry = findToggleMacroEntry(macroRuntime, e.key, e.code)
        if (toggleEntry) {
          if (isAutoRepeat) { e.preventDefault(); return }
          e.preventDefault()
          e.stopPropagation()
          onMacrosEnabledChange?.(!macrosEnabled)
          return
        }

        const entry = macrosEnabled ? findActiveMacroEntry(macroRuntime, e.key, e.code) : undefined
        if (entry) {
          e.preventDefault()
          e.stopPropagation()
          if (isAutoRepeat) return

          await runMacroEntry(entry, el)
          return
        }
      }
    }

    if (submitShortcut === 'Off') return
    if (e.key === 'Enter' && !e.shiftKey) {
      if (submitShortcut === 'CtrlEnter' && !e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      if (isAutoRepeat) return
      submit()
    }
  }, [submit, submitShortcut, macroRuntime, macrosEnabled, onMacrosEnabledChange, runMacroEntry])

  const autoGrow = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    if (!el.style.height && el.scrollHeight <= el.clientHeight) return
    fitHeight(el)
  }, [])

  const borderColor = feedback === 'throttled' ? 'var(--thread-accent)'
    : feedback === 'error' ? 'var(--danger)'
    : feedback === 'offline' ? '#f59e0b'
    : feedback === 'full' ? 'var(--danger)'
    : outboxSize > 0 ? '#f59e0b'
    : 'var(--thread-line)'

  const containerStyle: React.CSSProperties = inline
    ? {
        display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap',
        padding: '8px 8px',
        borderBottom: '1px solid var(--thread-line)',
        flexShrink: 0,
      }
    : {
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--surface-0)', borderTop: '1px solid var(--thread-line)',
        padding: '10px 12px',
        display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap',
      }

  const messageStyle: React.CSSProperties = {
    ...containerStyle, justifyContent: 'center', alignItems: 'center',
    minHeight: 44, fontSize: 13, color: 'var(--thread-muted)', textAlign: 'center', lineHeight: 1.5,
  }

  if (!isLoggedIn) {
    return (
      <div style={messageStyle}>
        <a href={process.env.NEXT_PUBLIC_LOGIN ?? '/api/auth/login'} style={{ fontSize: 13, color: 'var(--thread-accent)', textDecoration: 'none', fontWeight: 600 }}>
          Sign up to count →
        </a>
      </div>
    )
  }

  if (userRoles?.includes('banned')) {
    return (
      <div style={messageStyle}>
        You are banned. You can&apos;t post until you&apos;ve been unbanned.
      </div>
    )
  }

  if (userUUID && threadPostBans?.includes(userUUID)) {
    return (
      <div style={messageStyle}>
        You are banned from this thread.
      </div>
    )
  }

  const hasCounterRole = !!userRoles?.includes('counter') || !!userRoles?.includes('bot')

  if (!hasCounterRole) {
    const hasRegistered = !!userRoles?.includes('manual_verification_needed')
    return (
      <div style={messageStyle}>
        {hasRegistered ? (
          <>Your registration is pending approval. No further action is required: check back shortly.</>
        ) : (
          <>
            You need a profile before you can count.{' '}
            <a href="/register" style={{ color: 'var(--thread-accent)', fontWeight: 700 }}>Create one now</a>.
          </>
        )}
      </div>
    )
  }

  if (threadUpdatableBy && threadUpdatableBy.length > 0 &&
      !threadUpdatableBy.some(role => userRoles?.includes(role)) &&
      !userRoles?.includes('bot')) {
    return (
      <div style={messageStyle}>
        You don&apos;t have permission to participate in this thread.
      </div>
    )
  }

  if (threadLocked) {
    return (
      <div style={messageStyle}>
        This thread has been locked. This may be temporary: check the About tab.
      </div>
    )
  }

  const smallInputStyle: React.CSSProperties = {
    width: 72, flexShrink: 0, boxSizing: 'border-box',
    background: 'var(--thread-line)',
    border: '1px solid var(--thread-line)',
    borderRadius: 8, padding: '8px 10px',
    fontSize: 16, lineHeight: '22px', color: 'var(--thread-ink)', outline: 'none',
    fontFamily: 'monospace', textAlign: 'center',
  }

  return (
    <div className="composer-bar" style={containerStyle}>
      <div style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
        {!colonIsCountSyntax && autocompleteReady && (
          <EmojiAutocomplete
            inputRef={inputRef}
            onInsert={onEmojiInsert}
            onHandlerReady={onEmojiHandlerReady}
          />
        )}
        <textarea
          ref={inputRef}
          onKeyDown={onKeyDown}
          onInput={e => {
            autoGrow(e)
            const n = e.currentTarget.value.length
            if (n > MAX_POST_LEN || tooLong) setTooLong(n > MAX_POST_LEN ? n : 0)
          }}
          rows={1}
          placeholder={placeholder ?? ''}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode={inputModeFor(keyboardMode)}
          readOnly={keyboardMode === 'pad'}
          onPointerDown={e => {
            if (keyboardMode !== 'pad') return
            e.preventDefault()
            setPadField('main')
          }}
          onFocus={e => { if (keyboardMode === 'pad') e.currentTarget.blur() }}
          style={{
            width: '100%', boxSizing: 'border-box', display: 'block',
            background: 'var(--thread-line)',
            border: `1px solid ${borderColor}`,
            borderRadius: 8,
            padding: `8px ${showKeyboardToggle ? 64 : 34}px 8px 12px`,
            ...padRing('main'),
            fontSize: 16, color: 'var(--thread-ink)', outline: 'none',
            transition: 'border-color 0.1s', fontFamily: 'monospace',
            resize: 'none', overflowY: 'auto',
            maxHeight: `${MAX_TEXTAREA_ROWS * 22 + 16 + 2}px`,
            lineHeight: '22px',
          }}
        />
        {showCooldownBar && (
          <div
            aria-hidden
            style={{
              position: 'absolute', left: 1, right: 1, bottom: 1, height: 2,
              borderRadius: '0 0 7px 7px', overflow: 'hidden',
              pointerEvents: 'none',
            }}
          >
            <div
              ref={cooldownRef}
              style={{
                width: '100%', height: '100%',
                background: 'var(--primary, #f97316)',
                transform: 'scaleX(0)', transformOrigin: 'left center',
                willChange: 'transform',
              }}
            />
          </div>
        )}

        <div style={{
          position: 'absolute', right: 8, top: 0, bottom: 0,
          display: 'flex', alignItems: 'center', pointerEvents: 'none',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 2, pointerEvents: 'auto' }}>
            {showKeyboardToggle && (
              <button
                type="button"
                onClick={toggleKeyboard}
                aria-label={keyboardModeTitle(keyboardMode)}
                title={keyboardModeTitle(keyboardMode)}
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  padding: '2px 4px', fontSize: 11, fontWeight: 700, lineHeight: 1,
                  fontFamily: 'monospace', letterSpacing: '0.03em',
                  color: 'var(--thread-ink)', opacity: 0.55,
                }}
              >
                {keyboardModeLabel(keyboardMode)}
              </button>
            )}
            <EmotePicker inputRef={inputRef} />
          </span>
        </div>
      </div>

      <div className="composer-extras" style={{ display: 'contents' }}>
      {clearMode === 'No Clear' && (
        <>
          <input
            ref={noClearKeepRef}
            {...padFieldProps('keep')}
            inputMode={inputModeFor(keyboardMode)}
            type="number"
            placeholder="keep"
            title="Characters to keep from start"
            className="submit-mini-input"
            style={smallInputStyle}
          />
          <input
            ref={noClearDeleteRef}
            {...padFieldProps('delete')}
            inputMode={inputModeFor(keyboardMode)}
            type="number"
            placeholder="delete"
            title="Characters to delete at cursor"
            className="submit-mini-input"
            style={smallInputStyle}
          />
        </>
      )}

      {clearMode === 'Custom' && (
        <input
          ref={customInputRef}
          {...padFieldProps('custom')}
          inputMode={inputModeFor(keyboardMode)}
          placeholder="auto-paste"
          title="Pasted into the main input after each submit: and mirrored there as you type"
          autoComplete="off"
          className="submit-mini-input"
          onInput={e => {
            const input = inputRef.current
            if (!input) return
            input.value = (e.target as HTMLInputElement).value
          }}
          style={{ ...smallInputStyle, width: 100, textAlign: 'left' }}
        />
      )}

      {(clearMode === 'Custom' || clearMode === 'Clipboard') && (
        <input
          ref={clearPositionRef}
          {...padFieldProps('position')}
          inputMode={inputModeFor(keyboardMode)}
          type="number"
          min={0}
          placeholder="pos"
          title="Where the cursor starts after each submit (0 = before the first character). Blank leaves it at the end."
          className="submit-mini-input"
          style={{ ...smallInputStyle, width: 52, ...padRing('position') }}
        />
      )}

      </div>

      <button
        onClick={submit}
        className="composer-post"
        title={
          outboxSize > 0
            ? `${outboxSize} count${outboxSize === 1 ? '' : 's'} waiting: they'll send in order when the connection is back`
            : isLive ? undefined : 'Reconnecting: your text is kept'
        }
        style={{
          padding: '8px 14px', borderRadius: 8, border: 'none', flexShrink: 0,
          background: feedback === 'error' || feedback === 'full' ? 'var(--danger)'
            : feedback === 'offline' || outboxSize > 0 ? '#f59e0b'
            : 'var(--thread-accent)',
          color: '#fff', fontSize: 14, fontWeight: 700,
          cursor: 'pointer',
          opacity: isLive ? 1 : 0.5,
          touchAction: 'manipulation',
          transition: 'background 0.1s, opacity 0.1s',
        }}
      >
        {outboxSize > 0 ? `Post (${outboxSize})` : 'Post'}
      </button>
      {tooLong > 0 && (
        <span style={{ color: 'var(--danger)', fontSize: 11, fontWeight: 700, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {tooLong.toLocaleString()} / {MAX_POST_LEN.toLocaleString()}
        </span>
      )}

      {showKeyboardToggle && keyboardMode === 'pad' && !padHidden && (
        <CountPad
          getTarget={getPadTarget}
          onSubmit={submit}
          onRequestLetters={() => applyKeyboardMode('text')}
          onMacroKey={onPadMacroKey}
          layout={padLayout}
          accent={
            feedback === 'error' || feedback === 'full' ? 'var(--danger)'
              : feedback === 'offline' || outboxSize > 0 ? '#f59e0b'
              : 'var(--thread-accent)'
          }
          submitLabel={outboxSize > 0 ? `Post ${outboxSize}` : 'Enter'}
        />
      )}
    </div>
  )
}

function fitHeight(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  if (!el.value) return
  const borders = el.offsetHeight - el.clientHeight
  el.style.height = `${el.scrollHeight + borders}px`
}

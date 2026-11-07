'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { SelectedEmoji } from './EmojiMartPanel'

const EmojiMartPanel = dynamic(() => import('./EmojiMartPanel'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 20, fontSize: 12, color: '#666', width: 280, textAlign: 'center' }}>
      Loading emotes…
    </div>
  ),
})

interface EmotePickerProps {
  inputRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>
  disabled?: boolean
}

export default function EmotePicker({ inputRef, disabled }: EmotePickerProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || buttonRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleSelect = useCallback((emoji: SelectedEmoji) => {
    const input = inputRef.current
    if (!input) return
    const text = emoji.native ?? `\`${emoji.id}\``

    const value = input.value
    const start = input.selectionStart ?? value.length
    const end = input.selectionEnd ?? start
    const needsSpace = start > 0 && !/\s$/.test(value.slice(0, start))
    const insertion = (needsSpace ? ' ' : '') + text

    input.value = value.slice(0, start) + insertion + value.slice(end)
    const cursor = start + insertion.length
    input.setSelectionRange(cursor, cursor)
    input.focus()
    input.dispatchEvent(new Event('input', { bubbles: true }))
    setOpen(false)
  }, [inputRef])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        title="Emotes"
        aria-label="Open emote picker"
        aria-expanded={open}
        tabIndex={-1}
        style={{
          background: 'none', border: 'none', padding: 2, lineHeight: 1,
          fontSize: 17, cursor: disabled ? 'default' : 'pointer',
          color: open ? '#f97316' : 'var(--ink-3)',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        ☺
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            zIndex: 300, borderRadius: 8, overflow: 'hidden',
            boxShadow: '0 8px 28px rgb(var(--shadow-rgb) / 0.5)',
          }}
        >
          <EmojiMartPanel onSelect={handleSelect} />
        </div>
      )}
    </>
  )
}

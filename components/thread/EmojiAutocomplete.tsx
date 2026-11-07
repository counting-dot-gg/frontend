'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { searchEmoji, insertionTextFor, type IndexEntry } from '@/lib/emojiIndex'

export type EmojiAutocompleteHandle = {
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => boolean
  onInput: (e: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => void
}

type Props = {
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  onInsert: (text: string) => void
  onHandlerReady: (fn: ((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => boolean) | null) => void
}

export default function EmojiAutocomplete({ inputRef, onInsert, onHandlerReady }: Props) {
  const [results, setResults] = useState<IndexEntry[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const getActiveQuery = useCallback((): string | null => {
    const input = inputRef.current
    if (!input) return null
    const val = input.value
    const cursor = input.selectionStart ?? val.length
    let i = cursor - 1
    while (i >= 0) {
      if (val[i] === ':') {
        const q = val.slice(i + 1, cursor)
        if (q.length >= 1 && !q.includes(' ')) return q
        return null
      }
      if (val[i] === ' ') return null
      i--
    }
    return null
  }, [inputRef])

  const update = useCallback(() => {
    const q = getActiveQuery()
    if (!q) { setResults([]); setQuery(''); return }
    setQuery(q)
    setResults(searchEmoji(q))
    setActiveIdx(0)
  }, [getActiveQuery])

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    const handler = () => update()
    input.addEventListener('input', handler)
    input.addEventListener('click', handler)
    return () => { input.removeEventListener('input', handler); input.removeEventListener('click', handler) }
  }, [inputRef, update])

  useEffect(() => {
    if (results.length === 0) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setResults([])
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [results.length])

  const insert = useCallback((entry: IndexEntry) => {
    const input = inputRef.current
    if (!input) return
    const val = input.value
    const cursor = input.selectionStart ?? val.length
    let colonPos = cursor - 1
    while (colonPos >= 0 && val[colonPos] !== ':') colonPos--
    if (colonPos < 0) return

    const replacement = insertionTextFor(entry)
    const newVal = val.slice(0, colonPos) + replacement + val.slice(cursor)
    input.value = newVal
    const newCursor = colonPos + replacement.length
    input.setSelectionRange(newCursor, newCursor)
    input.focus()
    onInsert(replacement)
    setResults([])
    setQuery('')
  }, [inputRef, onInsert])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): boolean => {
    if (results.length === 0) return false
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => (i + 1) % results.length)
      return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => (i - 1 + results.length) % results.length)
      return true
    }
    if (e.key === 'Tab' || (e.key === 'Enter' && results.length > 0)) {
      e.preventDefault()
      insert(results[activeIdx])
      return true
    }
    if (e.key === 'Escape') {
      setResults([])
      return true
    }
    return false
  }, [results, activeIdx, insert])

  useEffect(() => {
    onHandlerReady(results.length > 0 ? handleKeyDown : null)
    return () => onHandlerReady(null)
  }, [results.length, handleKeyDown, onHandlerReady])

  if (results.length === 0) return null

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: 4,
        background: 'var(--surface-raised)',
        border: '1px solid rgb(var(--ink-rgb) / 0.12)',
        borderRadius: 8,
        overflow: 'hidden',
        zIndex: 200,
        boxShadow: '0 4px 20px rgb(var(--shadow-rgb) / 0.5)',
      }}
    >
      <div style={{
        padding: '4px 8px 2px',
        fontSize: '0.6rem',
        letterSpacing: '0.15em',
        color: 'rgb(var(--ink-rgb) / 0.25)',
        borderBottom: '1px solid rgb(var(--ink-rgb) / 0.06)',
      }}>
        :{query}
      </div>
      {results.map((entry, i) => (
        <div
          key={entry.id}
          onMouseDown={(e) => { e.preventDefault(); insert(entry) }}
          onMouseEnter={() => setActiveIdx(i)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 10px',
            cursor: 'pointer',
            background: i === activeIdx ? 'rgb(var(--ink-rgb) / 0.08)' : 'transparent',
            transition: 'background 0.05s',
          }}
        >
          <span style={{ width: 22, height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {entry.kind === 'native'
              ? <span style={{ fontSize: 18, lineHeight: 1 }}>{entry.native}</span>
              : <img src={entry.imgUrl} alt={entry.id} style={{ width: 22, height: 22, objectFit: 'contain' }} />
            }
          </span>
          <span style={{ fontSize: '0.8rem', color: i === activeIdx ? 'var(--ink-1)' : '#888' }}>
            :{entry.label}:
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: 'rgb(var(--ink-rgb) / 0.2)' }}>
            {i === activeIdx ? '↵' : ''}
          </span>
        </div>
      ))}
      <div style={{ padding: '3px 10px 4px', fontSize: '0.6rem', color: 'rgb(var(--ink-rgb) / 0.2)' }}>
        ↑↓ navigate · Tab/Enter select · Esc close
      </div>
    </div>
  )
}

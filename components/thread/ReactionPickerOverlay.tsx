'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { SelectedEmoji } from './EmojiMartPanel'

const EmojiMartPanel = dynamic(() => import('./EmojiMartPanel'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 20, fontSize: 12, color: '#666', width: 280, textAlign: 'center' }}>
      Loading…
    </div>
  ),
})

const PANEL_W = 352
const PANEL_H = 400

export default function ReactionPickerOverlay({ x, y, onSelect, onClose }: {
  x: number
  y: number
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y + 6 })

  useEffect(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const left = Math.max(8, Math.min(x, vw - PANEL_W - 8))
    const top = y + PANEL_H + 8 > vh ? Math.max(8, y - PANEL_H - 28) : y + 6
    setPos({ left, top })
  }, [x, y])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed', left: pos.left, top: pos.top, zIndex: 1500,
        borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 28px rgb(var(--shadow-rgb) / 0.55)',
      }}
    >
      <EmojiMartPanel onSelect={(emoji: SelectedEmoji) => onSelect(emoji.id)} />
    </div>
  )
}

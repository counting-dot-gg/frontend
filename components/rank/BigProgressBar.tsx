'use client'

import { useEffect, useRef } from 'react'

const COLLAPSE_BEZIER = 'cubic-bezier(0.4, 0, 0.2, 1)'
const MIN_DURATION_MS = 150
const MAX_DURATION_MS = 600
const MS_PER_PCT_POINT = 6

function durationForDelta(deltaPct: number) {
  const ms = Math.abs(deltaPct) * MS_PER_PCT_POINT
  return Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, ms))
}

type Props = {
  pct: number
  label: string
  color: string
  hidden?: boolean
  replayDurationMs?: number
  onAnimationDone?: () => void
}

export function BigProgressBar({ pct, label, color, hidden, replayDurationMs, onAnimationDone }: Props) {
  const clampedPct = Math.max(0, Math.min(100, pct))
  const prevPctRef = useRef(clampedPct)
  const durationMsRef = useRef(MIN_DURATION_MS)

  if (prevPctRef.current !== clampedPct) {
    durationMsRef.current = replayDurationMs ?? durationForDelta(clampedPct - prevPctRef.current)
  }
  useEffect(() => { prevPctRef.current = clampedPct }, [clampedPct])

  useEffect(() => {
    if (replayDurationMs == null || !onAnimationDone) return
    const t = setTimeout(() => onAnimationDone(), durationMsRef.current)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedPct, replayDurationMs])

  return (
    <div style={{ position: 'relative', height: 56, borderRadius: 6, backgroundColor: '#232a3d', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        width: `${hidden ? 100 : clampedPct}%`,
        backgroundColor: color,
        transition: hidden ? 'none' : `width ${durationMsRef.current}ms ${COLLAPSE_BEZIER}`,
        opacity: hidden ? 0 : 1,
      }} />
      {!hidden && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: '1.4rem', fontWeight: 800, lineHeight: 1,
            color: '#fff', textShadow: '0 1px 3px rgb(var(--shadow-rgb) / 0.4)',
          }}>
            {label}
          </span>
        </div>
      )}
    </div>
  )
}

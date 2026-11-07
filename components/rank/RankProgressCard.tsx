'use client'

import { useEffect, useState } from 'react'
import { RANK_COLORS, type RankName } from '@/lib/rankUtils'
import { useAnimatedNumber } from './useAnimatedNumber'
import { RankIconBadge } from './RankIconBadge'
import { RankUpOverlay } from './RankUpOverlay'
import { BigProgressBar } from './BigProgressBar'

const GG_COUNT_DURATION_MS = 700
const RANK_UP_MIN_HEIGHT = 220
const RANK_UP_GROW_DURATION_MS = 400

type Props = {
  rank: RankName
  division: 1 | 2 | 3
  gg: number
  divFloor: number
  divCeil: number
  threadName?: string
  pendingRankUp?: { rank: RankName; division: 1 | 2 | 3 } | null
  onRankUpAnimationDone?: () => void
}

export function RankProgressCard({ rank, division, gg, divFloor: floor, divCeil: ceil, threadName, pendingRankUp, onRankUpAnimationDone }: Props) {
  const animatedGg = useAnimatedNumber(gg, GG_COUNT_DURATION_MS)
  const [grown, setGrown] = useState(false)
  const [showRankUp, setShowRankUp] = useState(false)

  useEffect(() => {
    if (!pendingRankUp) {
      setGrown(false)
      setShowRankUp(false)
      return
    }
    const growTimer = setTimeout(() => setGrown(true), GG_COUNT_DURATION_MS + 150)
    return () => clearTimeout(growTimer)
  }, [pendingRankUp])

  useEffect(() => {
    if (!grown) return
    const contentTimer = setTimeout(() => setShowRankUp(true), RANK_UP_GROW_DURATION_MS)
    return () => clearTimeout(contentTimer)
  }, [grown])

  const hasNextDiv = isFinite(ceil) && ceil > floor
  const pct = hasNextDiv ? Math.min(100, Math.round(((gg - floor) / (ceil - floor)) * 100)) : 100
  const rankColor = RANK_COLORS[rank]
  const divGg = Math.max(0, animatedGg - floor)
  const divSpan = ceil - floor
  const progressLabel = `${divGg.toLocaleString()} / ${divSpan.toLocaleString()} GG`

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      border: '1px solid rgb(var(--ink-rgb) / 0.12)', borderRadius: 8,
      minHeight: grown ? RANK_UP_MIN_HEIGHT : 0,
      transition: `min-height ${RANK_UP_GROW_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
    }}>
      {pendingRankUp && showRankUp && (
        <RankUpOverlay
          rank={pendingRankUp.rank}
          division={pendingRankUp.division}
          threadName={threadName}
          onDismiss={() => {
            setShowRankUp(false)
            setGrown(false)
            onRankUpAnimationDone?.()
          }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
        <RankIconBadge rank={rank} division={division} size="normal" />
        <div style={{ flex: 1, minWidth: 0 }}>
          {hasNextDiv ? (
            <BigProgressBar pct={pct} label={progressLabel} color={rankColor} />
          ) : (
            <span style={{ fontSize: '0.875rem', color: 'var(--success-ink)', fontWeight: 600 }}>
              Max division for this rank
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

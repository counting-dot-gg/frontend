'use client'

import { useEffect, useState } from 'react'
import { BigProgressBar } from './BigProgressBar'
import { useAnimatedNumber } from './useAnimatedNumber'
import { CHALLENGE_BAR_COLOR, formatClockTime } from '@/lib/rankUtils'

const ENTRANCE_BAR_DURATION_MS = 3000

type Props = {
  type: 'split_under_ms' | 'get_under_ms' | 'bars_within_ms'
  maxMs: number
  target: number
  progress: number
  entranceAnimate?: boolean
  onEntranceAnimationDone?: () => void
  hidden?: boolean
}

export function SpeedChallengeCard({ type, maxMs, target, progress, entranceAnimate, onEntranceAnimationDone, hidden }: Props) {
  const pct = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0
  const [displayPct, setDisplayPct] = useState(entranceAnimate ? 0 : pct)
  const [animateTarget, setAnimateTarget] = useState(entranceAnimate ? 0 : progress)

  useEffect(() => {
    if (!entranceAnimate) {
      setDisplayPct(pct)
      setAnimateTarget(progress)
      return
    }
    const raf = requestAnimationFrame(() => {
      setDisplayPct(pct)
      setAnimateTarget(progress)
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entranceAnimate])

  const animatedProgress = useAnimatedNumber(animateTarget, ENTRANCE_BAR_DURATION_MS)
  const displayProgress = entranceAnimate ? animatedProgress : progress

  let progressLabel: string
  if (type === 'bars_within_ms') {
    const barNoun = target === 1 ? 'bar' : 'bars'
    progressLabel = `${displayProgress.toLocaleString()}/${target.toLocaleString()} sub-${formatClockTime(maxMs)} ${barNoun}`
  } else {
    const verb = type === 'get_under_ms' ? 'Get' : 'Split'
    const noun = target > 1 ? `${verb}s` : verb
    progressLabel = `${displayProgress.toLocaleString()}/${target.toLocaleString()} ${formatClockTime(maxMs)} ${noun}`
  }

  return (
    <BigProgressBar
      pct={entranceAnimate ? displayPct : pct}
      label={progressLabel}
      color={CHALLENGE_BAR_COLOR}
      hidden={hidden}
      replayDurationMs={entranceAnimate ? ENTRANCE_BAR_DURATION_MS : undefined}
      onAnimationDone={entranceAnimate ? onEntranceAnimationDone : undefined}
    />
  )
}

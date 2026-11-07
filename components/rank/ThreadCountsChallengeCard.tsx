'use client'

import { useEffect, useState } from 'react'
import { ChallengeCompletionWrapper } from './ChallengeCompletionWrapper'
import { BigProgressBar } from './BigProgressBar'
import { useAnimatedNumber } from './useAnimatedNumber'
import { CHALLENGE_BAR_COLOR, getProgressLabel, type RankName } from '@/lib/rankUtils'

const ENTRANCE_BAR_DURATION_MS = 3000

type Props = {
  challengeId: string
  type: string
  params: Record<string, any> | null
  ggReward: number
  progress: number
  target: number
  isComplete: boolean
  completedCount: number
  rank?: RankName
  sequencePosition?: number
  sequenceTotal?: number
  onAnimationDone?: (challengeId: string) => void
  forcePlay?: boolean
  entranceAnimate?: boolean
  onEntranceAnimationDone?: () => void
  summary?: { main: string; sub?: string }
  firstAppearance?: boolean
}

export function ThreadCountsChallengeCard({
  challengeId, type, params, ggReward, progress, target, isComplete, completedCount,
  rank, sequencePosition, sequenceTotal, onAnimationDone, forcePlay,
  entranceAnimate, onEntranceAnimationDone, summary, firstAppearance,
}: Props) {
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
  const progressLabel = getProgressLabel({ type, target, params }, entranceAnimate ? animatedProgress : progress)

  return (
    <ChallengeCompletionWrapper
      challengeId={challengeId} ggReward={ggReward} completedCount={completedCount}
      isComplete={isComplete} rank={rank} sequencePosition={sequencePosition} sequenceTotal={sequenceTotal}
      onAnimationDone={onAnimationDone} forcePlay={forcePlay} summary={summary} firstAppearance={firstAppearance}
    >
      {(isAnimating) => (
        <BigProgressBar
          pct={entranceAnimate ? displayPct : pct}
          label={progressLabel}
          color={CHALLENGE_BAR_COLOR}
          hidden={isAnimating}
          replayDurationMs={entranceAnimate ? ENTRANCE_BAR_DURATION_MS : undefined}
          onAnimationDone={entranceAnimate ? onEntranceAnimationDone : undefined}
        />
      )}
    </ChallengeCompletionWrapper>
  )
}

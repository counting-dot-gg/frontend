'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import type { RankName } from '@/lib/rankUtils'

const BOUNCE_BEZIER = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
const COLLAPSE_BEZIER = 'cubic-bezier(0.4, 0, 0.2, 1)'
const GG_ORANGE = '#ff8c00'

type Phase = 'idle' | 'splash' | 'collapsing'

type Props = {
  challengeId: string
  ggReward: number
  completedCount: number
  isComplete: boolean
  rank?: RankName
  sequencePosition?: number
  sequenceTotal?: number
  onAnimationDone?: (challengeId: string) => void
  forcePlay?: boolean
  summary?: { main: string; sub?: string }
  firstAppearance?: boolean
  children: (isAnimating: boolean) => ReactNode
}

export function ChallengeCompletionWrapper({
  challengeId, ggReward, completedCount, isComplete,
  onAnimationDone, forcePlay, summary, firstAppearance = true, children,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const wasCompleteRef = useRef(false)
  const forcePlayHandledRef = useRef(false)
  const hasSummaryAtSplashRef = useRef(Boolean(summary))

  useEffect(() => {
    if (isComplete && !wasCompleteRef.current) setPhase('splash')
    wasCompleteRef.current = isComplete
  }, [isComplete])

  useEffect(() => {
    if (forcePlay && !forcePlayHandledRef.current) {
      forcePlayHandledRef.current = true
      setPhase('splash')
    }
    if (!forcePlay) forcePlayHandledRef.current = false
  }, [forcePlay])

  useEffect(() => {
    if (phase !== 'splash') return
    hasSummaryAtSplashRef.current = Boolean(summary)
    const t = setTimeout(() => setPhase('collapsing'), (hasSummaryAtSplashRef.current ? 2200 : 1400) + 3000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    if (phase !== 'collapsing') return
    const t = setTimeout(() => {
      setPhase('idle')
      onAnimationDone?.(challengeId)
    }, 420)
    return () => clearTimeout(t)
  }, [phase, challengeId, onAnimationDone])

  const isAnimating = phase !== 'idle'

  return (
    <>
      <style>{`
        @keyframes challengeSplashIn { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes challengeCheckPop {
          0% { transform: scale(0) rotate(-15deg); opacity: 0; }
          60% { transform: scale(1.15) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes challengeTextSlideIn { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes challengeSummarySlideIn {
          from { transform: translateY(8px) scaleX(0); opacity: 0; }
          60% { transform: translateY(0) scaleX(1.05); opacity: 1; }
          100% { transform: translateY(0) scaleX(1); opacity: 1; }
        }
        @keyframes challengeRingExpand { from { transform: scale(0.6); opacity: 0.6; } to { transform: scale(2.2); opacity: 0; } }
        @keyframes challengeCardEnter {
          from { transform: translateY(-6px) scale(0.97); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
      <div style={{
        maxHeight: phase === 'collapsing' ? 0 : 500,
        opacity: phase === 'collapsing' ? 0 : 1,
        transform: phase === 'collapsing' ? 'translateY(-8px)' : 'translateY(0)',
        transition: `max-height 0.4s ${COLLAPSE_BEZIER}, opacity 0.25s ease, transform 0.4s ${COLLAPSE_BEZIER}`,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'relative', overflow: 'hidden',
          border: '1px solid rgb(var(--ink-rgb) / 0.12)', borderRadius: 8,
          animation: firstAppearance ? `challengeCardEnter 0.35s ${BOUNCE_BEZIER} both` : 'none',
        }}>
          {isAnimating && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 2,
              backgroundColor: 'var(--success)',
              animation: `challengeSplashIn 0.35s ${BOUNCE_BEZIER}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <div style={{
                  position: 'absolute', width: 40, height: 40, borderRadius: '50%',
                  border: '2px solid rgb(var(--ink-rgb) / 0.9)',
                  animation: 'challengeRingExpand 0.7s ease-out 0.15s both',
                }} />
                <svg width="32" height="32" viewBox="0 0 24 24" style={{
                  fill: '#fff', animation: `challengeCheckPop 0.5s ${BOUNCE_BEZIER} 0.1s both`,
                  filter: 'drop-shadow(0 1px 3px rgb(var(--shadow-rgb) / 0.35))',
                }}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span style={{
                  fontSize: '1.4rem', fontWeight: 800, color: '#fff',
                  textShadow: '0 1px 3px rgb(var(--shadow-rgb) / 0.35)',
                  animation: `challengeTextSlideIn 0.4s ${BOUNCE_BEZIER} 0.3s both`,
                }}>
                  Complete!
                </span>
              </div>
              {summary && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '1.1rem', fontWeight: 700, color: '#fff',
                    textShadow: '0 1px 3px rgb(var(--shadow-rgb) / 0.35)',
                    animation: `challengeSummarySlideIn 0.45s ${BOUNCE_BEZIER} 0.7s both`,
                  }}>
                    {summary.main}
                  </span>
                  {summary.sub && (
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 600,
                      color: 'rgb(255 255 255 / 0.85)',
                      animation: `challengeSummarySlideIn 0.45s ${BOUNCE_BEZIER} 0.85s both`,
                    }}>
                      {summary.sub}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          <div style={{ padding: 8, position: 'relative' }}>
            <div style={{
              position: 'absolute', top: 2, left: 8, right: 4, zIndex: 2, pointerEvents: 'none',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              </div>
              <div style={{
                flexShrink: 0, transform: 'rotate(2deg)',
                backgroundColor: GG_ORANGE, color: '#1a1200',
                fontWeight: 800, fontSize: '0.7rem', lineHeight: 1,
                padding: '4px 8px', borderRadius: 4,
                boxShadow: '0 2px 4px rgb(var(--shadow-rgb) / 0.25)', whiteSpace: 'nowrap',
              }}>
                +{ggReward} GG
              </div>
            </div>
            {children(isAnimating)}
          </div>
        </div>
      </div>
    </>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { calculateLevel, levelThresholds } from '@/lib/levels'
import type { Item } from '@/lib/types'

import { API } from '@/lib/apiBase'

const SEASON = 1

function indexByLevel(items: Item[]): Map<number, Item> {
  const map = new Map<number, Item>()
  for (const item of items) {
    if (item.levelToUnlock > 0 && (item.season == null || item.season === SEASON)) {
      map.set(item.levelToUnlock, item)
    }
  }
  return map
}

interface Props {
  xp: number
  initialItems: Item[]
  isLoggedIn: boolean
}

export default function RewardsClient({ xp, initialItems, isLoggedIn }: Props) {
  const [rewardByLevel, setRewardByLevel] = useState<Map<number, Item>>(
    () => indexByLevel(initialItems),
  )
  const [claiming, setClaiming] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currentLevel = useMemo(() => Number(calculateLevel(xp).level), [xp])
  const [open, setOpen] = useState(currentLevel)
  const scrolledRef = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/auth/status`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setRewardByLevel(indexByLevel(data.items ?? []))
    } catch {
    }
  }, [])

  useEffect(() => {
    if (scrolledRef.current) return
    scrolledRef.current = true
    document.getElementById(`lvl-${currentLevel}`)
      ?.scrollIntoView({ block: 'center', behavior: 'auto' })
  }, [currentLevel])

  const claim = useCallback(async (level: number) => {
    setClaiming(level)
    setError(null)
    try {
      const res = await fetch(`${API}/api/api/unlockReward`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      })
      if (!res.ok) {
        setError("Couldn't open that gift. Reach out to an admin if you've genuinely earned it.")
        return
      }
      await refresh()
    } catch {
      setError('Network error: try again.')
    } finally {
      setClaiming(null)
    }
  }, [refresh])

  if (!isLoggedIn) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--surface-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#555' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎁</div>
          <div style={{ fontSize: 16, color: 'var(--ink-3)', fontWeight: 600 }}>Sign in to see your XP rewards</div>
        </div>
      </div>
    )
  }

  const nextLevel = levelThresholds.find(t => Number(t.level) === currentLevel + 1)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-0)', padding: '24px 16px 64px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>
            XP Rewards
          </h1>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 13px', borderRadius: 20,
            background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.3)',
            fontSize: 14, fontWeight: 700, color: '#facc15',
          }}>
            Level {currentLevel}
          </div>
          <div style={{ fontSize: 13, color: '#888', fontVariantNumeric: 'tabular-nums' }}>
            {xp.toLocaleString()} XP
            {nextLevel && ` · ${(nextLevel.minXP - xp).toLocaleString()} to level ${nextLevel.level}`}
          </div>
        </div>

        {error && (
          <div style={{
            margin: '14px 0', padding: '10px 16px', borderRadius: 10,
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
            color: 'var(--danger)', fontSize: 13, fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {levelThresholds.map((tier) => {
            const level = Number(tier.level)
            const reached = xp >= tier.minXP
            const reward = rewardByLevel.get(level)
            const claimable = reached && !reward
            const isOpen = open === level
            const pct = tier.minXP <= 0 ? 100 : Math.min(100, (xp / tier.minXP) * 100)

            return (
              <div
                key={level}
                id={`lvl-${level}`}
                style={{
                  borderRadius: 12,
                  border: `1px solid ${
                    claimable ? 'rgba(250,204,21,0.45)'
                    : reward   ? 'rgba(74,222,128,0.25)'
                    : 'var(--line)'
                  }`,
                  background: claimable
                    ? 'linear-gradient(135deg, rgba(250,204,21,0.14), var(--surface-raised))'
                    : 'var(--surface-raised)',
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => setOpen(isOpen ? -1 : level)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                    padding: '11px 14px', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{
                    flexShrink: 0, minWidth: 62, fontSize: 13, fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    color: reached ? 'var(--ink-1)' : '#5b6172',
                  }}>
                    LVL {level}
                  </span>

                  <span style={{
                    flex: 1, height: 6, borderRadius: 3, minWidth: 60,
                    background: 'rgb(var(--ink-rgb) / 0.07)', overflow: 'hidden',
                  }}>
                    <span style={{
                      display: 'block', height: '100%', width: `${pct}%`,
                      background: reached ? 'var(--success)' : '#7c6df0',
                      transition: 'width 0.3s',
                    }} />
                  </span>

                  <span style={{
                    flexShrink: 0, fontSize: 11, fontWeight: 700,
                    color: claimable ? '#facc15' : reward ? 'var(--success-ink)' : 'var(--ink-3)',
                  }}>
                    {claimable ? '🎁 Ready' : reward ? 'Claimed' : `${tier.minXP.toLocaleString()} XP`}
                  </span>
                </button>

                {isOpen && (
                  <div style={{ padding: '0 14px 14px', fontSize: 13, color: '#9aa2b5', lineHeight: 1.6 }}>
                    {reward ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                        borderRadius: 10, background: 'rgba(74,222,128,0.07)',
                        border: '1px solid rgba(74,222,128,0.2)',
                      }}>
                        <span style={{ fontSize: 32, lineHeight: 1 }}>{reward.name}</span>
                        <span>
                          <span style={{ display: 'block', color: 'var(--ink-1)', fontWeight: 700 }}>
                            {reward.description || reward.name}
                          </span>
                          <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'capitalize' }}>
                            {reward.category}
                          </span>
                        </span>
                      </div>
                    ) : claimable ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <button
                          onClick={() => claiming === null && claim(level)}
                          disabled={claiming !== null}
                          style={{
                            fontSize: 34, lineHeight: 1, padding: '10px 18px', borderRadius: 12,
                            border: '1px solid rgba(250,204,21,0.4)',
                            background: 'rgba(250,204,21,0.12)',
                            cursor: claiming === null ? 'pointer' : 'wait',
                            animation: claiming === level ? 'none' : 'giftNudge 1.6s ease-in-out infinite',
                          }}
                        >
                          🎁
                        </button>
                        {claiming === level && <span>Opening…</span>}
                      </div>
                    ) : (
                      <>You&rsquo;re {(tier.minXP - xp).toLocaleString()} XP away from unlocking this reward.</>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes giftNudge {
          0%, 70%, 100% { transform: rotate(0deg); }
          78% { transform: rotate(-9deg); }
          86% { transform: rotate(9deg); }
          94% { transform: rotate(-4deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes giftNudge { from, to { transform: none; } }
        }
      `}</style>
    </div>
  )
}

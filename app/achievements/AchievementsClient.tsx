'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  buildRarityFn,
  RARITY_CONFIG,
  type AchievementType,
  type CounterAchievementType,
  type Rarity,
} from '@/lib/achievements'

import { API } from '@/lib/apiBase'

function AchievementCard({
  achievement,
  counterAchievement,
  getRarity,
  locked,
}: {
  achievement: AchievementType
  counterAchievement?: CounterAchievementType
  getRarity: (n: number) => Rarity
  locked: boolean
}) {
  const rarity = getRarity(achievement.countersEarned)
  const cfg = RARITY_CONFIG[rarity]

  const progressPct =
    counterAchievement && !counterAchievement.isComplete && achievement.maxProgress > 0
      ? Math.min(100, (counterAchievement.progress / achievement.maxProgress) * 100)
      : counterAchievement?.isComplete
      ? 100
      : 0

  const [shineKey, setShineKey] = useState(0)

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 16,
        border: `1.5px solid ${cfg.color}`,
        background: `linear-gradient(135deg, ${cfg.bg}, rgb(var(--surface-0-rgb) / 0.95))`,
        boxShadow: `0 0 ${rarity === 'legendary' ? 24 : rarity === 'epic' ? 16 : 8}px ${cfg.glow}, inset 0 1px 0 rgb(var(--ink-rgb) / 0.06)`,
        padding: '16px',
        opacity: locked ? 0.6 : 1,
        overflow: 'hidden',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(-2px)'
        el.style.boxShadow = `0 0 ${rarity === 'legendary' ? 36 : rarity === 'epic' ? 24 : 14}px ${cfg.glow}, inset 0 1px 0 rgb(var(--ink-rgb) / 0.08)`
        setShineKey(k => k + 1)
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = ''
        el.style.boxShadow = `0 0 ${rarity === 'legendary' ? 24 : rarity === 'epic' ? 16 : 8}px ${cfg.glow}, inset 0 1px 0 rgb(var(--ink-rgb) / 0.06)`
      }}
    >
      {cfg.shimmer && shineKey > 0 && (
        <div
          key={shineKey}
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `linear-gradient(105deg, transparent 40%, ${cfg.color}18 50%, transparent 60%)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.1s linear forwards',
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink-1)', lineHeight: 1.3 }}>
          {achievement.name}
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8, whiteSpace: 'nowrap', flexShrink: 0,
          background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}55`,
          letterSpacing: '0.05em',
        }}>
          {cfg.label}
        </span>
      </div>

      {achievement.isPublic && achievement.description ? (
        <div style={{ fontSize: 12, color: '#888', marginBottom: 10, lineHeight: 1.4 }}>
          {achievement.description}
        </div>
      ) : !achievement.isPublic && !counterAchievement ? (
        <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>Secret achievement</div>
      ) : null}

      {counterAchievement && !counterAchievement.isComplete && achievement.maxProgress > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#666', marginBottom: 3 }}>
            <span>Progress</span>
            <span>{counterAchievement.progress} / {achievement.maxProgress}</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: 'rgb(var(--ink-rgb) / 0.08)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: cfg.color, borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {counterAchievement?.isComplete && (
        <div style={{ fontSize: 10, color: 'var(--success-ink)', marginBottom: 8 }}>Completed</div>
      )}

      <div style={{ marginTop: 'auto' }}>
        <div style={{ display: 'flex', gap: 5, fontSize: 10, color: 'var(--ink-3)', marginBottom: 3 }}>
          <span>Earned by</span>
          <span style={{ color: cfg.color }}>{achievement.countersEarned} counters</span>
        </div>
      </div>
    </div>
  )
}

interface Props {
  userUUID: string | null
  isLoggedIn: boolean
}

export default function AchievementsClient({ userUUID, isLoggedIn }: Props) {
  const [allAchievements, setAllAchievements] = useState<AchievementType[]>([])
  const [userAchievements, setUserAchievements] = useState<CounterAchievementType[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'public' | 'secret'>('public')

  const load = useCallback(async () => {
    try {
      const uuid = userUUID ?? 'undefined'
      const res = await fetch(`${API}/api/counter/achievements/${uuid}`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setAllAchievements(data.all_achievements ?? [])
      setUserAchievements(data.user_achievements ?? [])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [userUUID])

  useEffect(() => { load() }, [load])

  const publicAchievements = allAchievements
    .filter(a => a.isPublic)
    .sort((a, b) => b.countersEarned - a.countersEarned)

  const secretAchievements = allAchievements
    .filter(a => !a.isPublic)
    .sort((a, b) => b.countersEarned - a.countersEarned)

  const earned = new Set(userAchievements.filter(u => u.isComplete).map(u => u.achievementId))

  const displayed = tab === 'public' ? publicAchievements : secretAchievements

  const getRarity = buildRarityFn(allAchievements)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-0)', padding: '24px 16px' }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes legendaryPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>
            Achievements
          </h1>
          {isLoggedIn && userAchievements.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 13, color: '#666' }}>
              You've earned {earned.size} of {allAchievements.length} achievements
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgb(var(--ink-rgb) / 0.08)', paddingBottom: 0 }}>
          {([['public', `Public (${publicAchievements.length})`], ['secret', `Secret (${secretAchievements.length})`]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px', fontSize: 13, fontWeight: 600,
                color: tab === key ? '#f97316' : '#666',
                borderBottom: tab === key ? '2px solid #f97316' : '2px solid transparent',
                marginBottom: -1, transition: 'color 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: '#555', fontSize: 13, padding: '40px 0' }}>Loading achievements…</div>
        ) : displayed.length === 0 ? (
          <div style={{ color: '#555', fontSize: 13, padding: '40px 0' }}>No achievements here yet.</div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 14,
          }}>
            {displayed.map(achievement => {
              const counterAchievement = userAchievements.find(u => u.achievementId === achievement.id)
              const locked = isLoggedIn && !counterAchievement?.isComplete
              return (
                <Link
                  key={achievement.id}
                  href={`/achievements/${achievement.id}`}
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  <AchievementCard
                    achievement={achievement}
                    counterAchievement={counterAchievement}
                    getRarity={getRarity}
                    locked={locked}
                  />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

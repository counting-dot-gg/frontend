'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  buildRarityFn,
  RARITY_CONFIG,
  type AchievementType,
  type CounterAchievementType,
  type Rarity,
} from '@/lib/achievements'

import { API } from '@/lib/apiBase'

const EARNER_LIMIT = 200

type Earner = { uuid: string; username: string; name: string; color: string }

export interface AchievementPayloads {
  detail: {
    achievement?: AchievementType
    countersWhoEarnedAchievement?: Earner[]
    counterAchievements?: CounterAchievementType[]
  } | null
  list: { all_achievements?: AchievementType[] } | null
}

interface Derived {
  achievement: AchievementType | null
  earners: Earner[]
  mine: CounterAchievementType | undefined
  rarity: Rarity | null
}

export function deriveAchievement(
  { detail, list }: AchievementPayloads,
  userUUID: string | null,
): Derived {
  const empty: Derived = { achievement: null, earners: [], mine: undefined, rarity: null }
  if (!detail?.achievement) return empty
  const a = detail.achievement

  const all: AchievementType[] = list?.all_achievements ?? []
  return {
    achievement: a,
    earners: (detail.countersWhoEarnedAchievement ?? []).filter((c: Earner) => c.username),
    mine: userUUID
      ? (detail.counterAchievements ?? []).find(
          c => c.achievementId === a.id && c.counterUUID === userUUID,
        )
      : undefined,
    rarity: all.length ? buildRarityFn(all)(a.countersEarned) : null,
  }
}

interface Props {
  achievementId: number
  userUUID: string | null
  initial?: AchievementPayloads | null
}

export default function AchievementClient({ achievementId, userUUID, initial = null }: Props) {
  const seed = initial ? deriveAchievement(initial, userUUID) : null
  const [achievement, setAchievement] = useState<AchievementType | null>(seed?.achievement ?? null)
  const [mine, setMine] = useState<CounterAchievementType | undefined>(seed?.mine)
  const [earners, setEarners] = useState<Earner[]>(seed?.earners ?? [])
  const [rarity, setRarity] = useState<Rarity | null>(seed?.rarity ?? null)
  const [loading, setLoading] = useState(initial === null)

  const load = useCallback(async () => {
    try {
      const [detailRes, listRes] = await Promise.all([
        fetch(`${API}/api/counter/achievement/${achievementId}`, { credentials: 'include' }),
        fetch(`${API}/api/counter/achievements/${userUUID ?? 'undefined'}`, { credentials: 'include' }),
      ])

      if (!detailRes.ok) return
      const next = deriveAchievement(
        { detail: await detailRes.json(), list: listRes.ok ? await listRes.json() : null },
        userUUID,
      )
      if (!next.achievement) return

      setAchievement(next.achievement)
      setEarners(next.earners)
      setMine(next.mine)
      if (next.rarity) setRarity(next.rarity)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [achievementId, userUUID])

  useEffect(() => { if (!initial) load() }, [load, initial])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--surface-0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#555', fontSize: 14 }}>Loading achievement…</div>
      </div>
    )
  }

  if (!achievement) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--surface-0)', padding: '24px 16px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <BackLink />
          <div style={{ marginTop: 32, color: '#888', fontSize: 16 }}>No achievement found :(</div>
        </div>
      </div>
    )
  }

  const cfg = RARITY_CONFIG[rarity ?? 'common']
  const revealed = achievement.isPublic || !!mine

  const earnedOn = (() => {
    const ms = Number(mine?.timestamp)
    if (!Number.isFinite(ms) || ms <= 0) return null
    return new Date(ms).toLocaleDateString()
  })()
  const progressPct = mine?.isComplete
    ? 100
    : mine && achievement.maxProgress > 0
    ? Math.min(100, (mine.progress / achievement.maxProgress) * 100)
    : 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-0)', padding: '24px 16px 64px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <BackLink />

        <div style={{
          marginTop: 18,
          borderRadius: 18,
          border: `1.5px solid ${cfg.color}`,
          background: `linear-gradient(135deg, ${cfg.bg}, rgb(var(--surface-0-rgb) / 0.95))`,
          boxShadow: `0 0 20px ${cfg.glow}, inset 0 1px 0 rgb(var(--ink-rgb) / 0.06)`,
          padding: '24px 22px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{
              margin: 0, flex: 1, minWidth: 200,
              fontSize: 26, fontWeight: 800, color: 'var(--ink-1)', letterSpacing: '-0.02em',
            }}>
              {achievement.name}
            </h1>
            {rarity && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 9,
                background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}55`,
                letterSpacing: '0.05em', whiteSpace: 'nowrap',
              }}>
                {cfg.label}
              </span>
            )}
          </div>

          <div style={{ marginTop: 10, fontSize: 14, color: '#9aa2b5', lineHeight: 1.6 }}>
            {revealed
              ? achievement.description || 'No description.'
              : 'Secret achievement: earn it to reveal what it is.'}
          </div>

          {mine && !mine.isComplete && achievement.maxProgress > 0 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666', marginBottom: 4 }}>
                <span>Your progress</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {mine.progress} / {achievement.maxProgress}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgb(var(--ink-rgb) / 0.08)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progressPct}%`, background: cfg.color, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}

          {mine?.isComplete && (
            <div style={{ marginTop: 18, fontSize: 13, fontWeight: 700, color: 'var(--success-ink)' }}>
              ✓ Completed
              {earnedOn && (
                <span style={{ color: '#666', fontWeight: 400, marginLeft: 8 }}>
                  {earnedOn}
                </span>
              )}
            </div>
          )}

          <div style={{
            marginTop: 20, paddingTop: 16, borderTop: '1px solid rgb(var(--ink-rgb) / 0.07)',
            fontSize: 12, color: '#555',
          }}>
            Earned by <span style={{ color: cfg.color, fontWeight: 700 }}>
              {achievement.countersEarned.toLocaleString()}
            </span> counters
          </div>
        </div>

        {earners.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h2 style={{
              margin: '0 0 10px', fontSize: 12, fontWeight: 700, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: 'rgb(var(--ink-rgb) / 0.35)',
            }}>
              Earned by
            </h2>
            <div style={{ fontSize: 13, lineHeight: 1.9, color: '#666' }}>
              {earners.slice(0, EARNER_LIMIT).map((c, i) => (
                <span key={c.uuid ?? c.username}>
                  <Link
                    href={`/counter/${c.username}`}
                    style={{ color: c.color || 'var(--ink-1)', textDecoration: 'none' }}
                  >
                    {c.name}
                  </Link>
                  {i < Math.min(earners.length, EARNER_LIMIT) - 1 ? ', ' : ''}
                </span>
              ))}
              {earners.length > EARNER_LIMIT && (
                <span> and {(earners.length - EARNER_LIMIT).toLocaleString()} more</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <Link href="/achievements" style={{ fontSize: 14, color: '#7cc4ff', textDecoration: 'none' }}>
      ‹ View all achievements
    </Link>
  )
}

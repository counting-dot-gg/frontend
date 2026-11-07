'use client'

import { useCallback, useEffect, useState } from 'react'
import { revalidateHomeScene } from './actions'

import { API } from '@/lib/apiBase'

interface Goal {
  goalKey: string
  name: string
  description: string | null
  funding: 'community' | 'solo'
  targetCost: number
  raised: number
  unlocked: boolean
  unlockedAt: number | null
  unlockedBy: string | null
}

interface Contributor {
  uuid: string
  username: string
  color: string | null
  amount: number
}

export default function SiteGoalsSection({ money, onSpent }: {
  money: number
  onSpent: () => void
}) {
  const [goals, setGoals] = useState<Goal[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const load = useCallback(async (): Promise<Goal[]> => {
    try {
      const res = await fetch(`${API}/api/site-goals`, { credentials: 'include' })
      if (!res.ok) { setGoals([]); return [] }
      const data = await res.json()
      const rows: Goal[] = Array.isArray(data) ? data : []
      setGoals(rows)
      return rows
    } catch {
      setGoals([])
      return []
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const contribute = useCallback(async (goal: Goal) => {
    const remaining = goal.targetCost - goal.raised
    const raw = goal.funding === 'solo'
      ? goal.targetCost
      : Math.floor(Number(amounts[goal.goalKey] ?? ''))

    if (!Number.isFinite(raw) || raw <= 0) {
      setMessage({ text: 'Enter an amount first.', ok: false })
      return
    }
    if (raw > remaining) {
      setMessage({ text: `Only ${remaining.toLocaleString()} left to raise.`, ok: false })
      return
    }
    if (raw > money) {
      setMessage({ text: 'Not enough coins.', ok: false })
      return
    }

    setBusy(goal.goalKey)
    setMessage(null)
    try {
      const res = await fetch(`${API}/api/site-goals/${goal.goalKey}/contribute`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: raw }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ text: data.message ?? 'Contribution failed.', ok: false })
        return
      }
      setMessage({ text: 'Contributed! Updating…', ok: true })
      setAmounts(prev => ({ ...prev, [goal.goalKey]: '' }))
      await new Promise(r => setTimeout(r, 1200))
      const fresh = await load()
      onSpent()

      const justUnlocked =
        !goal.unlocked && fresh.find(g => g.goalKey === goal.goalKey)?.unlocked

      if (justUnlocked) {
        await revalidateHomeScene()
        setMessage({ text: `${goal.name} is funded: it's on the front page now.`, ok: true })
      } else {
        setMessage({ text: 'Thanks for chipping in.', ok: true })
      }
    } catch {
      setMessage({ text: 'Network error.', ok: false })
    } finally {
      setBusy(null)
    }
  }, [amounts, money, load, onSpent])

  if (goals === null || goals.length === 0) return null

  return (
    <div style={{ marginTop: 36 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#555', letterSpacing: '0.1em',
        textTransform: 'uppercase', marginBottom: 14,
      }}>
        Community goals
      </div>
      {message && (
        <div style={{
          marginBottom: 14, padding: '10px 16px', borderRadius: 10,
          background: message.ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
          border: `1px solid ${message.ok ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
          color: message.ok ? 'var(--success-ink)' : 'var(--danger)',
          fontSize: 13, fontWeight: 600,
        }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {goals.map(goal => (
          <GoalCard
            key={goal.goalKey}
            goal={goal}
            money={money}
            busy={busy === goal.goalKey}
            amount={amounts[goal.goalKey] ?? ''}
            onAmount={v => setAmounts(prev => ({ ...prev, [goal.goalKey]: v }))}
            onContribute={() => void contribute(goal)}
          />
        ))}
      </div>
    </div>
  )
}

function GoalCard({ goal, money, busy, amount, onAmount, onContribute }: {
  goal: Goal
  money: number
  busy: boolean
  amount: string
  onAmount: (v: string) => void
  onContribute: () => void
}) {
  const [contributors, setContributors] = useState<Contributor[] | null>(null)
  const [showBoard, setShowBoard] = useState(false)

  const remaining = Math.max(0, goal.targetCost - goal.raised)
  const pct = goal.targetCost > 0
    ? Math.min(100, (goal.raised / goal.targetCost) * 100)
    : 0

  useEffect(() => {
    if (!showBoard || contributors !== null) return
    fetch(`${API}/api/site-goals/${goal.goalKey}/contributors`)
      .then(r => (r.ok ? r.json() : []))
      .then(d => setContributors(Array.isArray(d) ? d : []))
      .catch(() => setContributors([]))
  }, [showBoard, contributors, goal.goalKey])

  return (
    <div style={{
      padding: 18, borderRadius: 12,
      background: goal.unlocked ? 'rgba(74,222,128,0.06)' : 'rgb(var(--ink-rgb) / 0.03)',
      border: `1px solid ${goal.unlocked ? 'rgba(74,222,128,0.25)' : 'rgb(var(--ink-rgb) / 0.08)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink-1)' }}>{goal.name}</div>
        {goal.unlocked ? (
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
            padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase',
            background: 'rgba(74,222,128,0.15)', color: 'var(--success-ink)',
          }}>
            Unlocked
          </span>
        ) : (
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
            padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase',
            background: 'rgb(var(--ink-rgb) / 0.06)', color: '#888',
          }}>
            {goal.funding === 'solo' ? 'One buyer' : 'Community funded'}
          </span>
        )}
      </div>

      {goal.description && (
        <p style={{ margin: '7px 0 0', fontSize: 13, color: '#999', lineHeight: 1.55, maxWidth: 620 }}>
          {goal.description}
        </p>
      )}

      <div style={{ marginTop: 14 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          fontSize: 12, marginBottom: 5, fontVariantNumeric: 'tabular-nums',
        }}>
          <span style={{ color: goal.unlocked ? 'var(--success-ink)' : 'var(--warn)', fontWeight: 700 }}>
            {goal.raised.toLocaleString()} / {goal.targetCost.toLocaleString()}
          </span>
          <span style={{ color: '#666' }}>
            {goal.unlocked ? 'Funded' : `${remaining.toLocaleString()} to go`}
          </span>
        </div>
        <div style={{
          height: 8, borderRadius: 4, overflow: 'hidden',
          background: 'rgb(var(--ink-rgb) / 0.07)',
        }}>
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: 4,
            background: goal.unlocked ? 'var(--success)' : 'var(--warn)',
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {!goal.unlocked && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {goal.funding === 'community' && (
            <input
              type="number"
              min={1}
              max={remaining}
              value={amount}
              onChange={e => onAmount(e.target.value)}
              placeholder="Amount"
              disabled={busy}
              style={{
                width: 120, padding: '8px 10px', borderRadius: 8,
                background: 'rgb(var(--shadow-rgb) / 0.35)', border: '1px solid rgb(var(--ink-rgb) / 0.12)',
                color: 'var(--ink-1)', fontSize: 13, fontWeight: 600,
              }}
            />
          )}
          <button
            onClick={onContribute}
            disabled={busy || money <= 0}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              cursor: busy || money <= 0 ? 'default' : 'pointer',
              background: busy || money <= 0 ? 'rgb(var(--ink-rgb) / 0.08)' : 'var(--warn)',
              color: busy || money <= 0 ? '#666' : '#000',
              fontSize: 13, fontWeight: 800,
            }}
          >
            {busy
              ? 'Sending…'
              : goal.funding === 'solo'
                ? `Buy for ${goal.targetCost.toLocaleString()}`
                : 'Contribute'}
          </button>
          {goal.funding === 'community' && remaining > 0 && money > 0 && (
            <button
              onClick={() => onAmount(String(Math.min(remaining, money)))}
              disabled={busy}
              style={{
                padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                background: 'none', border: '1px solid rgb(var(--ink-rgb) / 0.14)',
                color: '#999', fontSize: 12, fontWeight: 700,
              }}
            >
              Max ({Math.min(remaining, money).toLocaleString()})
            </button>
          )}
        </div>
      )}

      <button
        onClick={() => setShowBoard(v => !v)}
        style={{
          marginTop: 12, padding: 0, background: 'none', border: 'none',
          color: '#666', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {showBoard ? 'Hide supporters' : 'Show supporters'}
      </button>

      {showBoard && (
        <div style={{ marginTop: 10 }}>
          {contributors === null ? (
            <div style={{ fontSize: 12, color: '#555' }}>Loading…</div>
          ) : contributors.length === 0 ? (
            <div style={{ fontSize: 12, color: '#555' }}>Nobody yet. Be first.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {contributors.map((c, i) => (
                <div key={c.uuid} style={{
                  display: 'flex', justifyContent: 'space-between', gap: 12,
                  fontSize: 12, fontVariantNumeric: 'tabular-nums',
                }}>
                  <span style={{ color: c.color || '#bbb', fontWeight: 600 }}>
                    {i + 1}. {c.username}
                  </span>
                  <span style={{ color: '#777' }}>{c.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

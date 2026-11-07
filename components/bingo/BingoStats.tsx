'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RANK_COLORS, RANK_LABELS, type RankName } from '@/lib/rankUtils'

type Category = 'solo' | 'coop' | 'versus'

interface Stats {
  played: number
  won: number
  lines: number
  claims: number
  steals: number
  saves: number
  playedWith: number
  records: Array<{ rank: string; category: Category; ms: number; gameId: number; format: string }>
}

const CATEGORIES: Array<{ key: Category; label: string }> = [
  { key: 'solo', label: 'Solo' },
  { key: 'coop', label: 'Co-op' },
  { key: 'versus', label: 'Versus' },
]

export function lineTime(ms: number): string {
  const m = Math.floor(ms / 60000)
  const s = (ms % 60000) / 1000
  return `${m}:${s.toFixed(3).padStart(6, '0')}`
}

export default function BingoStats({ uuid, color }: { uuid: string; color: string }) {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    let live = true
    fetch(`/api/bingo/stats/${uuid}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (live) setStats(d) })
      .catch(() => {})
    return () => { live = false }
  }, [uuid])

  if (!stats || stats.played === 0) return null

  const figure = (value: number, label: string) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 'clamp(1.2rem, 3.4vw, 1.8rem)', fontWeight: 800, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', color: 'var(--ink-1)' }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: 'clamp(0.58rem, 1.3vw, 0.68rem)', letterSpacing: '0.2em', fontWeight: 600, color: 'rgb(var(--ink-rgb) / 0.52)', marginTop: 4 }}>
        {label}
      </div>
    </div>
  )

  const ranks = [...new Set(stats.records.map(r => r.rank))]
  const cats = CATEGORIES.filter(c => stats.records.some(r => r.category === c.key))
  const cell = (rank: string, cat: Category) => stats.records.find(r => r.rank === rank && r.category === cat)

  return (
    <section style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.14em', margin: '0 0 12px', color }}>BINGO</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: '14px 18px' }}>
        {figure(stats.played, 'PLAYED')}
        {figure(stats.won, 'WON')}
        {figure(stats.claims + stats.steals + stats.saves, 'SQUARES')}
        {figure(stats.playedWith, 'PLAYED WITH')}
      </div>

      {ranks.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: `minmax(90px, auto) repeat(${cats.length}, minmax(0, 1fr))`,
          gap: '6px 16px', marginTop: 18, alignItems: 'baseline', fontSize: 13,
        }}>
          <span />
          {cats.map(c => (
            <span key={c.key} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'rgb(var(--ink-rgb) / 0.52)' }}>
              {c.label}
            </span>
          ))}
          {ranks.map(rank => (
            <RankRow key={rank} rank={rank}>
              {cats.map(c => {
                const r = cell(rank, c.key)
                return r ? (
                  <Link key={c.key} href={`/bingo/${r.gameId}`} prefetch={false} style={{ color: 'var(--ink-1)', textDecoration: 'none', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {lineTime(r.ms)}
                    {c.key === 'versus' && (
                      <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: 'rgb(var(--ink-rgb) / 0.52)' }}>{r.format}</span>
                    )}
                  </Link>
                ) : <span key={c.key} style={{ color: 'rgb(var(--ink-rgb) / 0.3)' }}>–</span>
              })}
            </RankRow>
          ))}
        </div>
      )}
    </section>
  )
}

function RankRow({ rank, children }: { rank: string; children: React.ReactNode }) {
  const r = rank as RankName
  return (
    <>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: RANK_COLORS[r] ?? 'var(--muted-foreground)', flexShrink: 0 }} />
        {RANK_LABELS[r] ?? rank}
      </span>
      {children}
    </>
  )
}

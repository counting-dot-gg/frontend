'use client'

import { RANK_COLORS, RANK_NUMERAL_FONT, type RankName } from '@/lib/rankUtils'

function dimHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const mix = (channel: number) => Math.round(channel * (1 - amount))
  const r = mix((num >> 16) & 0xff)
  const g = mix((num >> 8) & 0xff)
  const b = mix(num & 0xff)
  return `rgb(${r}, ${g}, ${b})`
}

type Props = {
  rank: RankName
  division: 1 | 2 | 3
  size?: 'mini' | 'normal'
  animated?: boolean
}

export function RankIconBadge({ rank, division, size = 'normal', animated = false }: Props) {
  const color = RANK_COLORS[rank]
  const ringColor = dimHex(color, 0.35)
  const divStr = rank === 'peak' ? '≈' : division === 1 ? 'I' : division === 2 ? 'II' : 'III'
  const isMini = size === 'mini'
  const dimension = isMini ? 20 : 64
  const fontSize = isMini ? '0.6rem' : '1.5rem'
  const borderWidth = isMini ? 2 : 3
  const outlineOffset = isMini ? 0.6 : 1
  const textOutline = [-1, 0, 1]
    .flatMap((x) => [-1, 0, 1].map((y) => [x, y]))
    .filter(([x, y]) => x !== 0 || y !== 0)
    .map(([x, y]) => `${x * outlineOffset}px ${y * outlineOffset}px 1.5px rgb(var(--shadow-rgb) / 0.95)`)
    .join(', ')

  return (
    <div title={`${rank} ${divStr}`} style={{
      position: 'relative',
      width: dimension, height: dimension, flexShrink: 0,
      borderRadius: '50%',
      backgroundColor: ringColor,
      boxShadow: isMini ? '0 1px 2px rgb(var(--shadow-rgb) / 0.4)' : '0 2px 6px rgb(var(--shadow-rgb) / 0.45)',
    }}>
      <div style={{
        position: 'absolute', inset: borderWidth,
        borderRadius: '50%', backgroundColor: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        {!isMini && animated && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(60deg, transparent 40%, rgb(var(--ink-rgb) / 0.5) 50%, transparent 60%)',
            animation: 'rankShineSweep 1.8s ease-in-out 0.5s infinite backwards',
          }} />
        )}
        <span style={{
          position: 'relative', fontSize, fontWeight: 800, lineHeight: 1, color: '#fff',
          textShadow: textOutline,
          fontFamily: RANK_NUMERAL_FONT,
          letterSpacing: isMini ? '0.04em' : '0.06em',
          textIndent: isMini ? '0.04em' : '0.06em',
        }}>
          {divStr}
        </span>
      </div>
      <style>{`
        @keyframes rankShineSweep {
          from { transform: translateX(-120%) rotate(20deg); }
          to { transform: translateX(120%) rotate(20deg); }
        }
      `}</style>
    </div>
  )
}

'use client'

import { RANK_COLORS, RANK_LABELS, type RankName } from '@/lib/rankUtils'
import { RankIconBadge } from './RankIconBadge'

function mixHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const target = amount < 0 ? 0 : 255
  const a = Math.abs(amount)
  const mix = (channel: number) => Math.round(channel * (1 - a) + target * a)
  const r = mix((num >> 16) & 0xff)
  const g = mix((num >> 8) & 0xff)
  const b = mix(num & 0xff)
  return `rgb(${r}, ${g}, ${b})`
}

type Props = {
  rank: RankName
  division: 1 | 2 | 3
  threadName?: string
  onDismiss: () => void
}

const ON_DARK = (alpha: number) => `rgb(255 255 255 / ${alpha})`

export function RankUpOverlay({ rank, division, threadName, onDismiss }: Props) {
  const color = RANK_COLORS[rank]
  const rayColorA = mixHex(color, -0.35)
  const rayColorB = mixHex(color, -0.75)
  const label = RANK_LABELS[rank]
  const divStr = rank === 'peak' ? '≈' : division === 1 ? 'I' : division === 2 ? 'II' : 'III'

  const rayCount = 12
  const wedgeDeg = 360 / rayCount
  const featherDeg = 0.75
  const featheredStops = Array.from({ length: rayCount }, (_, i) => {
    const start = i * wedgeDeg
    const mid = start + wedgeDeg / 2
    const end = start + wedgeDeg
    const colorHere = i % 2 === 0 ? rayColorA : rayColorB
    const colorNext = i % 2 === 0 ? rayColorB : rayColorA
    return [
      `${colorHere} ${start}deg`,
      `${colorHere} ${mid - featherDeg}deg`,
      `${colorNext} ${mid + featherDeg}deg`,
      `${colorNext} ${end}deg`,
    ]
  }).flat()
  const rayGradient = featheredStops.join(', ')

  return (
    <>
      <style>{`
        @keyframes rankFadeInBackdrop { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rankBadgePop {
          0% { transform: scale(0) rotate(-20deg); opacity: 0; }
          60% { transform: scale(1.2) rotate(8deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes rankTextSlideUp {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes rankRaysRotate {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>
      <div
        onClick={(e) => { e.stopPropagation(); onDismiss() }}
        style={{
          position: 'absolute', inset: 0, zIndex: 20, overflow: 'hidden',
          backgroundColor: rayColorB,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', textAlign: 'center', padding: '12px 16px',
          animation: 'rankFadeInBackdrop 0.3s ease',
        }}
      >
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: '400%', aspectRatio: '1 / 1',
          background: `conic-gradient(${rayGradient})`,
          animation: 'rankRaysRotate 16s linear infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, rgb(var(--shadow-rgb) / 0.55) 0%, rgb(var(--shadow-rgb) / 0.15) 45%, transparent 70%)',
        }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '140%', height: '140%', borderRadius: '50%',
            backgroundColor: 'rgb(var(--shadow-rgb) / 0.35)', filter: 'blur(18px)',
          }} />
          <div style={{ animation: 'rankBadgePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both', marginBottom: 8 }}>
            <RankIconBadge rank={rank} division={division} size="normal" animated />
          </div>
          <span style={{
            position: 'relative', fontSize: '0.65rem', fontWeight: 700,
            letterSpacing: 1.5, color: ON_DARK(0.85), textTransform: 'uppercase',
            textShadow: '0 1px 4px rgb(var(--shadow-rgb) / 0.9)',
            animation: 'rankTextSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both',
          }}>
            Rank up!
          </span>
          <span style={{
            position: 'relative', fontSize: '1.25rem', fontWeight: 800, color: '#fff', lineHeight: 1.1,
            textShadow: `0 0 14px ${color}, 0 2px 6px rgb(var(--shadow-rgb) / 0.9)`,
            animation: 'rankTextSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both',
          }}>
            {label} {divStr}
          </span>
          {threadName && (
            <span style={{
              position: 'relative', marginTop: 2, fontSize: '0.75rem', fontWeight: 600,
              color: ON_DARK(0.8), textShadow: '0 1px 4px rgb(var(--shadow-rgb) / 0.9)',
              animation: 'rankTextSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s both',
            }}>
              {threadName}
            </span>
          )}
          <span style={{
            position: 'relative', marginTop: 8, fontSize: '0.65rem',
            color: ON_DARK(0.7), textShadow: '0 1px 4px rgb(var(--shadow-rgb) / 0.9)',
            animation: 'rankTextSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s both',
          }}>
            Click to continue
          </span>
        </div>
      </div>
    </>
  )
}

'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { isPointerPress } from '@/lib/pointerPress'
import { easternHourFraction, skyAt } from '@/lib/daylight'
import { getSocket } from '@/lib/socket'

const HORIZON_PCT = 70

const RADIUS_X_PCT = 44
const RADIUS_Y_PCT = 40

const REFRESH_MS = 60_000

function arcPosition(p: number) {
  const theta = 2 * Math.PI * p
  return {
    leftPct: 50 - RADIUS_X_PCT * Math.cos(theta),
    topPct: 100 - (RADIUS_Y_PCT / HORIZON_PCT) * 100 * Math.sin(theta),
    height: Math.sin(theta),
  }
}

function SkyBodies({ initialHour, parkMode = false }: {
  initialHour: number
  parkMode?: boolean
}) {
  const [hour, setHour] = useState(initialHour)

  useEffect(() => {
    const tick = () => setHour(easternHourFraction())
    tick()
    const id = setInterval(tick, REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  const sunP = (hour - 6) / 24
  const sun = arcPosition(sunP)
  const moon = arcPosition(sunP + 0.5)

  const { count, nudge } = useSkyCounter()

  return (
    <div
      style={{
        position: 'absolute',
        left: 0, right: 0, top: 0,
        height: `${HORIZON_PCT}%`,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <Stars darkness={skyAt(hour).darkness} />

      {count !== null && <CounterCloud count={count} />}

      {sun.height > -0.35 && (
        <Body leftPct={sun.leftPct} topPct={sun.topPct}>
          <SkyButton
            active={parkMode}
            label="The sun"
            glow="rgba(255,196,92,0.85)"
            onClick={() => nudge(1)}
          >
            <Mascot />
          </SkyButton>
        </Body>
      )}
      {moon.height > -0.35 && (
        <Body leftPct={moon.leftPct} topPct={moon.topPct}>
          <SkyButton
            active={parkMode}
            label="The moon"
            glow="rgba(168,208,255,0.8)"
            onClick={() => nudge(-1)}
          >
            <Mascot night />
          </SkyButton>
        </Body>
      )}
    </div>
  )
}

export default memo(SkyBodies)

function useSkyCounter() {
  const [count, setCount] = useState<number | null>(null)
  const joined = useRef(false)

  useEffect(() => {
    const socket = getSocket()
    const onCount = (n: number) => setCount(Number(n) || 0)
    socket.on('sky_count', onCount)
    return () => { socket.off('sky_count', onCount) }
  }, [])

  const nudge = useCallback((dir: 1 | -1) => {
    const socket = getSocket()
    if (!joined.current) {
      joined.current = true
      socket.emit('watchSky')
    }
    socket.emit('skyClick', { dir })
    setCount(c => (c ?? 0) + dir)
  }, [])

  return { count, nudge }
}

function SkyButton({ active, label, glow, onClick, children }: {
  active: boolean
  label: string
  glow: string
  onClick: () => void
  children: React.ReactNode
}) {
  const [flare, setFlare] = useState(0)

  useEffect(() => {
    if (flare <= 0) return
    const id = window.setTimeout(() => setFlare(f => Math.max(0, f - 0.07)), 80)
    return () => window.clearTimeout(id)
  }, [flare])

  const [rings, setRings] = useState<{ id: number; x: number; y: number }[]>([])
  const ringId = useRef(0)

  const ringTimers = useRef<number[]>([])
  useEffect(() => () => { ringTimers.current.forEach(window.clearTimeout) }, [])

  if (!active) return <>{children}</>

  return (
    <button
      type="button"
      onClick={e => {
        if (!isPointerPress(e)) return
        const box = e.currentTarget.getBoundingClientRect()
        const id = ++ringId.current
        setRings(prev => [...prev, {
          id,
          x: e.clientX - box.left,
          y: e.clientY - box.top,
        }])
        const t = window.setTimeout(
          () => setRings(prev => prev.filter(r => r.id !== id)),
          850,
        )
        ringTimers.current.push(t)

        setFlare(f => Math.min(1, f + 0.42))
        onClick()
      }}
      aria-label={label}
      onDragStart={e => e.preventDefault()}
      onContextMenu={e => e.preventDefault()}
      style={{
        display: 'block', width: '100%',
        background: 'none', border: 'none', padding: 0,
        pointerEvents: 'auto', cursor: 'pointer',
        position: 'relative',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
    >
      <style>{`@keyframes skyRing{
  from{transform:translate(-50%,-50%) scale(0.2);opacity:0.85}
  to{transform:translate(-50%,-50%) scale(1);opacity:0}
}
@media (prefers-reduced-motion: reduce){.sky-ring{display:none}}`}</style>

      {rings.map(r => (
        <span
          key={r.id}
          aria-hidden
          className="sky-ring"
          style={{
            position: 'absolute',
            left: r.x, top: r.y,
            width: 190, height: 190,
            marginLeft: 0, marginTop: 0,
            borderRadius: '50%',
            border: `2px solid ${glow}`,
            animation: 'skyRing 0.85s cubic-bezier(0.16,1,0.3,1) forwards',
            pointerEvents: 'none',
          }}
        />
      ))}

      <span
        aria-hidden
        style={{
          position: 'absolute', left: '50%', top: '50%',
          width: '210%', height: '210%',
          transform: `translate(-50%, -50%) scale(${(0.7 + flare * 0.5).toFixed(3)})`,
          background: `radial-gradient(circle, ${glow} 0%, transparent 62%)`,
          opacity: flare * 0.85,
          transition: 'opacity 0.28s ease-out, transform 0.28s ease-out',
          pointerEvents: 'none',
        }}
      />

      <div style={{
        transform: `scale(${(1 + flare * 0.14).toFixed(3)})`,
        transformOrigin: 'center',
        transition: 'transform 0.12s ease-out',
        position: 'relative',
      }}>
        {children}
      </div>
    </button>
  )
}

function CounterCloud({ count }: { count: number }) {
  return (
    <div
      aria-live="polite"
      style={{
        position: 'absolute', top: '9%', left: 0,
        pointerEvents: 'none',
        animation: 'cloudDriftIn 1.5s cubic-bezier(0.16,1,0.3,1) both',
      }}
    >
      <style>{`@keyframes cloudDriftIn{from{transform:translateX(-140%)}to{transform:translateX(18%)}}
@media (prefers-reduced-motion: reduce){.sky-cloud{animation:none!important;transform:translateX(18%)}}`}</style>
      <div className="sky-cloud" style={{ position: 'relative', width: 148, height: 62 }}>
        <svg width="148" height="62" viewBox="0 0 148 62" style={{ display: 'block' }}>
          <g fill="#FFF8EC" stroke="#2C1B0E" strokeWidth="3" strokeLinejoin="round">
            <path d="M28 50 Q10 50 12 38 Q13 28 26 28 Q28 12 46 14 Q56 2 76 8
                     Q94 2 104 16 Q124 14 126 30 Q140 32 138 42 Q136 50 120 50 Z" />
          </g>
        </svg>
        <span style={{
          position: 'absolute', inset: 0,
          display: 'grid', placeItems: 'center',
          paddingTop: 8,
          fontWeight: 900, fontSize: 17,
          color: count < 0 ? '#B4451F' : '#241C12',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {count > 0 ? `+${count}` : count}
        </span>
      </div>
    </div>
  )
}


function starHash(i: number, salt: number): number {
  let h = Math.imul(2166136261 ^ salt, 16777619)
  h = Math.imul(h ^ i, 16777619)
  h ^= h >>> 13
  return ((h >>> 0) % 100000) / 100000
}

const STAR_COUNT = 84

const TWINKLE_GROUPS = 4

function Stars({ darkness }: { darkness: number }) {
  const visible = Math.max(0, Math.min(1, (darkness - 0.32) / 0.5))
  if (visible <= 0) return null

  const groups: { left: number; top: number; size: number; bright: boolean; opacity: number }[][] =
    Array.from({ length: TWINKLE_GROUPS }, () => [])
  for (let i = 0; i < STAR_COUNT; i++) {
    groups[Math.floor(starHash(i, 37) * TWINKLE_GROUPS) % TWINKLE_GROUPS].push({
      top: Math.pow(starHash(i, 3), 1.7) * 88,
      left: starHash(i, 7) * 100,
      bright: starHash(i, 11) > 0.88,
      size: starHash(i, 11) > 0.88 ? 2.4 : 1.1 + starHash(i, 13) * 0.9,
      opacity: 0.25 + starHash(i, 17) * 0.6,
    })
  }

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: visible }}>
      <style>{`@keyframes twinkle{0%,100%{opacity:0.55}50%{opacity:1}}
@media (prefers-reduced-motion: reduce){.sky-twinkle{animation:none!important}}`}</style>

      {groups.map((stars, g) => (
        <div
          key={g}
          className="sky-twinkle"
          style={{
            position: 'absolute', inset: 0,
            animation: `twinkle ${(3.1 + g * 1.7).toFixed(2)}s ease-in-out ${(g * 0.9).toFixed(2)}s infinite`,
            willChange: 'opacity',
          }}
        >
          {stars.map((s, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: `${s.left.toFixed(2)}%`,
                top: `${s.top.toFixed(2)}%`,
                width: s.size, height: s.size,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: s.bright ? '0 0 4px rgb(var(--ink-rgb) / 0.9)' : undefined,
                opacity: s.opacity,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function Body({ leftPct, topPct, children }: {
  leftPct: number
  topPct: number
  children: React.ReactNode
}) {
  return (
    <div style={{
      position: 'absolute',
      left: `${leftPct}%`,
      top: `${topPct}%`,
      transform: 'translate(-50%, -50%)',
      width: 'clamp(54px, 7vw, 96px)',
      transition: 'left 2s linear, top 2s linear',
    }}>
      {children}
    </div>
  )
}

const MASCOT_SRC = '/mascot/cute-ball.png'

function Mascot({ night }: { night?: boolean }) {
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1' }}>
      <div style={{
        position: 'absolute', inset: '-32%',
        borderRadius: '50%',
        background: night
          ? 'radial-gradient(circle, rgba(214,222,238,0.38) 40%, rgba(214,222,238,0) 70%)'
          : 'radial-gradient(circle, rgba(255,222,150,0.6) 40%, rgba(255,222,150,0) 70%)',
      }} />
      <img
        src={MASCOT_SRC}
        alt=""
        width={128}
        height={128}
        decoding="async"
        draggable={false}
        style={{
          position: 'relative',
          width: '100%', height: '100%',
          display: 'block',
          pointerEvents: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          filter: night
            ? 'grayscale(0.82) saturate(0.6) brightness(0.9) contrast(1.05) '
              + 'drop-shadow(0 0 7px rgba(196,214,255,0.55))'
            : 'saturate(1.08) brightness(1.05) drop-shadow(0 0 8px rgba(255,205,120,0.55))',
        }}
      />
    </div>
  )
}

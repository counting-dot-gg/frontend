'use client'

import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { avatarUrl } from '@/lib/counterUtils'
import { ambientFilter, lightAt, type LightDirection } from '@/lib/daylight'
import { getSocket } from '@/lib/socket'
import { alpha8, px } from '@/lib/cssRound'
import { WISDOM_ENDPOINT, type WisdomShape } from '@/lib/dailyWisdomShared'
import {
  RIDGE_H,
  RIDGE_VISIBLE_PX,
  farRidgePath,
  nearRidgePath,
  hashUnit,
} from '@/lib/ridgeline'
import {
  subscribeSkyWisdom,
  readSkyWisdom,
  readSkyWisdomServer,
  toggleSkyWisdom,
  WISDOM_RISE_MS,
  WISDOM_SHADOW_DELAY_MS,
} from '@/lib/skyWisdom'

export type Camper = {
  uuid: string
  name: string
  color: string
  discordId?: string
  avatar?: string
  counts: number
}

const MIN_COUNTS = 10
const MAX_COUNTS = 300_000
const LOG_MIN = Math.log10(MIN_COUNTS)
const LOG_MAX = Math.log10(MAX_COUNTS)

const MIN_SIZE = 16
const MAX_SIZE = 38

export const MAX_CAMPERS = 200

const CAMP_X_MIN = 26
const CAMP_X_MAX = 70

export function countsToScale(counts: number): number {
  const t = (Math.log10(Math.max(counts, 1) + 1) - LOG_MIN) / (LOG_MAX - LOG_MIN)
  return Math.max(0, Math.min(1, t))
}

function Ridgeline({ seed }: { seed: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', left: 0, right: 0,
        bottom: '100%', height: RIDGE_VISIBLE_PX,
        pointerEvents: 'none',
      }}
    >
      <svg
        width="100%" height="100%"
        viewBox={`0 0 100 ${RIDGE_H}`}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        <path d={farRidgePath(seed)} fill="rgba(46,66,84,0.34)" />
        <path d={nearRidgePath(seed)} fill="rgba(28,54,38,0.55)" />
      </svg>
    </div>
  )
}

type Placed = Camper & {
  size: number
  x: number
  y: number
  flip: boolean
}

function place(campers: Camper[], narrow: boolean): Placed[] {
  const xMin = narrow ? 14 : CAMP_X_MIN
  const xMax = narrow ? 72 : CAMP_X_MAX
  const sizeScale = narrow ? 0.68 : 1

  return campers
    .slice(0, MAX_CAMPERS)
    .map(c => {
      const scale = countsToScale(c.counts)
      const jitter = hashUnit(c.uuid, 7)
      return {
        ...c,
        size: (MIN_SIZE + (MAX_SIZE - MIN_SIZE) * scale) * sizeScale,
        x: xMin + hashUnit(c.uuid, 1) * (xMax - xMin),
        y: 12 + scale * 70 + (jitter - 0.5) * 14,
        flip: hashUnit(c.uuid, 3) > 0.5,
      }
    })
    .sort((a, b) => a.y - b.y)
}

function Campground({
  campers, horizonPct = 70, darkness = 0, totalCounts = 0, hour = 12, onTogglePark, parkMode = false,
  daySeed = '', narrow = false, wisdom = null, isCounter = false,
}: {
  campers: Camper[]
  isCounter?: boolean
  daySeed?: string
  wisdom?: WisdomShape | null
  narrow?: boolean
  horizonPct?: number
  darkness?: number
  totalCounts?: number
  hour?: number
  onTogglePark?: () => void
  parkMode?: boolean
}) {
  const placed = place(campers, narrow)
  const light = lightAt(hour)
  const ambient = ambientFilter(hour)

  return (
    <div
      style={{
        position: 'absolute',
        left: 0, right: 0,
        top: `${horizonPct}%`,
        bottom: 0,
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <style>{`
        @keyframes flicker {
          0%, 100% { transform: scaleY(1) scaleX(1); opacity: 1; }
          40%      { transform: scaleY(1.16) scaleX(0.92); opacity: 0.9; }
          70%      { transform: scaleY(0.94) scaleX(1.06); opacity: 1; }
        }
        @keyframes wisdomShadowCross {
          0%   { transform: translate(-50%, 0) scaleX(1) scaleY(0.14) skewX(var(--skew)); opacity: 0; }
          8%   { opacity: 0.95; }
          25%  { transform: translate(calc(-50% + var(--sx1)), 9vh) scaleX(1.35) scaleY(0.85) skewX(var(--skew)); opacity: 1; }
          60%  { transform: translate(calc(-50% + var(--sx2)), 22vh) scaleX(2) scaleY(1.9) skewX(var(--skew)); opacity: 0.9; }
          82%  { transform: translate(calc(-50% + var(--sx2)), 31vh) scaleX(2.6) scaleY(2.8) skewX(var(--skew)); opacity: 0.55; }
          100% { transform: translate(calc(-50% + var(--sx2)), 40vh) scaleX(3.1) scaleY(3.4) skewX(var(--skew)); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .wisdom-shadow { animation: none !important; opacity: 0.45 !important;
                           transform: translate(-50%, 16vh) scaleY(1.4) !important; }
        }
        @keyframes drift {
          0%, 100% { transform: translate(0, 0); opacity: 0.25; }
          25%      { transform: translate(7px, -9px); opacity: 0.95; }
          60%      { transform: translate(-6px, -4px); opacity: 0.6; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cg-flicker, .cg-drift { animation: none !important; }
        }
      `}</style>

      <Ridgeline seed={daySeed} />

      {wisdom && <WisdomShadow wisdom={wisdom} light={light} />}

      <Tree growth={treeGrowth(totalCounts)} light={light} narrow={narrow} ambient={ambient} />
      <Meadow darkness={darkness} light={light} onTogglePark={onTogglePark} parkMode={parkMode} narrow={narrow} ambient={ambient} daySeed={daySeed} wisdom={wisdom} isCounter={isCounter} />
      {placed.map((c, i) => (
        <Figure key={c.uuid} camper={c} z={i} />
      ))}
      {darkness > 0.6 && <Fireflies darkness={darkness} />}
    </div>
  )
}

export default memo(Campground)

function Meadow({ darkness, light, onTogglePark, parkMode, narrow, ambient, daySeed, wisdom, isCounter }: {
  darkness: number
  light: LightDirection
  onTogglePark?: () => void
  parkMode: boolean
  narrow: boolean
  ambient: string
  daySeed: string
  wisdom: WisdomShape | null
  isCounter: boolean
}) {
  return (
    <>
      <Signpost onToggle={onTogglePark} entered={parkMode} light={light} narrow={narrow} ambient={ambient} />

      {isCounter && (
        <Vault parkMode={parkMode} light={light} narrow={narrow} ambient={ambient} />
      )}

      {wisdom && (
        <CrystalBall
          parkMode={parkMode}
          light={light}
          narrow={narrow}
          ambient={ambient}
          wisdom={wisdom}
          darkness={darkness}
        />
      )}

      <div style={{
        position: 'absolute',
        left: narrow ? '46%' : '20%',
        top: narrow ? '58%' : '64%',
        transform: 'translate(-50%, -100%)',
      }}>
        {darkness > 0.45 && (
          <div style={{
            position: 'absolute', left: '50%', bottom: -12,
            width: 110, height: 40, transform: 'translateX(-50%)',
            background: 'radial-gradient(ellipse at center, rgba(255,170,70,0.45), rgba(255,170,70,0) 70%)',
            opacity: Math.min(1, (darkness - 0.45) * 4),
          }} />
        )}
        <svg width="34" height="38" viewBox="0 0 34 38" style={{ position: 'relative' }}>
          {[4, 11, 18, 25].map(x => (
            <ellipse key={x} cx={x + 2} cy="34" rx="4" ry="2.6" fill="#9AA0A6" stroke="#2C1B0E" strokeWidth="1.6" />
          ))}
          <rect x="4" y="26" width="26" height="5.5" rx="2.75" fill="#7A5335" stroke="#2C1B0E" strokeWidth="2"
            transform="rotate(9 17 29)" />
          <rect x="4" y="26" width="26" height="5.5" rx="2.75" fill="#93683F" stroke="#2C1B0E" strokeWidth="2"
            transform="rotate(-11 17 29)" />
          {darkness > 0.45 && (
            <g
              className="cg-flicker"
              style={{
                transformOrigin: '17px 27px',
                animation: 'flicker 1.1s ease-in-out infinite',
                opacity: Math.min(1, (darkness - 0.45) * 4),
              }}
            >
              <path d="M17 4 C23 12, 26 16, 26 21 a9 9 0 0 1 -18 0 C8 16, 11 12, 17 4 Z" fill="#FF8A3D" />
              <path d="M17 12 C20 16, 21.5 18, 21.5 21 a4.5 4.5 0 0 1 -9 0 C12.5 18, 14 16, 17 12 Z" fill="#FFD166" />
            </g>
          )}
        </svg>
      </div>
    </>
  )
}

function Vault({ parkMode, light, narrow = false, ambient = 'none' }: {
  parkMode: boolean
  light: LightDirection
  narrow?: boolean
  ambient?: string
}) {
  const boxW = narrow ? 46 : 60
  const boxH = narrow ? 42 : 55

  const [state, setState] = useState<'idle' | 'robbing' | 'done'>('idle')
  const [took, setTook] = useState<number | null>(null)
  const [hover, setHover] = useState(false)

  useEffect(() => {
    const socket = getSocket()
    const onResult = (data: { amount?: number }) => {
      setTook(Number(data?.amount ?? 0))
      setState('done')
    }
    socket.on('rob_result', onResult)
    return () => { socket.off('rob_result', onResult) }
  }, [])

  const rob = () => {
    if (state !== 'idle') return
    setState('robbing')
    getSocket().emit('rob')
    window.setTimeout(() => {
      setState(prev => (prev === 'robbing' ? 'done' : prev))
    }, 2500)
  }

  const label =
    state === 'robbing' ? 'Cracking…'
      : state === 'done'
        ? took == null || took === 0
          ? 'Empty. Come back tomorrow.'
          : `You took $${took.toLocaleString()}!`
        : 'Rob'

  const [emptyFaded, setEmptyFaded] = useState(false)
  useEffect(() => {
    if (state !== 'done' || took) return
    const id = window.setTimeout(() => setEmptyFaded(true), 4000)
    return () => window.clearTimeout(id)
  }, [state, took])

  const showLabel = hover || state === 'robbing' || (state === 'done' && !emptyFaded)

  const open = state === 'done'

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      style={{
        position: 'absolute', left: narrow ? 8 : 30, top: narrow ? '99%' : '80%',
        transform: 'translateY(-100%)',
        pointerEvents: parkMode ? 'auto' : 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
      }}>
      <div style={{ position: 'relative', display: 'flex' }}>
        {light.strength > 0 && (
          <div style={{
            position: 'absolute', left: '50%', bottom: -4,
            width: px(boxW * (1 + (1 - light.elevation) * 1.2)), height: 12,
            transform: `translateX(-50%) translateX(${px(-light.x * 34 * (1 - light.elevation))})`,
            background: `rgba(24,46,20,${alpha8(0.34 * light.strength)})`,
            borderRadius: '50%', filter: 'blur(3px)',
          }} />
        )}

      <button
        type="button"
        onClick={rob}
        disabled={state !== 'idle'}
        aria-label="Rob the bank"
        style={{
          background: 'none', border: 'none', padding: 0,
          cursor: state === 'idle' ? 'pointer' : 'default',
        }}
      >
        <svg width={boxW} height={boxH} viewBox="0 0 46 42" style={{ filter: ambient }}>
          <rect x="3" y="8" width="40" height="31" rx="4"
            fill="#8A5E36" stroke="#2C1B0E" strokeWidth="3" />

          {open ? (
            <>
              <rect x="8" y="13" width="30" height="21" rx="2"
                fill="#2A1B10" stroke="#2C1B0E" strokeWidth="2" />
              <line x1="8" y1="25" x2="38" y2="25" stroke="#4A3320" strokeWidth="1.5" />

              {took ? (
                <g>
                  {[[14, 3], [23, 2], [31, 1]].map(([x, n]) =>
                    Array.from({ length: n }, (_, i) => (
                      <ellipse key={`${x}-${i}`} cx={x} cy={32 - i * 2.6} rx="4.2" ry="1.9"
                        fill="#F2C24E" stroke="#2C1B0E" strokeWidth="1" />
                    )),
                  )}
                  <ellipse cx="16" cy="22" rx="4.2" ry="1.9" fill="#F2C24E" stroke="#2C1B0E" strokeWidth="1" />
                  <ellipse cx="26" cy="22" rx="4.2" ry="1.9" fill="#E8A863" stroke="#2C1B0E" strokeWidth="1" />
                </g>
              ) : (
                <g stroke="#5A4530" strokeWidth="0.9" fill="none" opacity="0.85">
                  <path d="M10 15 L18 15 M10 15 L10 23 M10 15 L17 22" />
                  <path d="M13 15 Q13.4 17.6 10 18" />
                  <path d="M16 15 Q16.6 20.4 10 21" />
                </g>
              )}

              <g>
                <rect x="37" y="11" width="7" height="25" rx="2"
                  fill="#B77C41" stroke="#2C1B0E" strokeWidth="2" />
                <circle cx="40.5" cy="23" r="2.1" fill="#E8A863" stroke="#2C1B0E" strokeWidth="1.5" />
              </g>
            </>
          ) : (
            <>
              <rect x="8" y="13" width="30" height="21" rx="2"
                fill="#C98B4B" stroke="#2C1B0E" strokeWidth="2" />
              <g>
                {state === 'robbing' && (
                  <animateTransform attributeName="transform" type="rotate"
                    from="0 23 23" to="360 23 23" dur="0.9s" repeatCount="indefinite" />
                )}
                <circle cx="23" cy="23" r="6" fill="#E8A863" stroke="#2C1B0E" strokeWidth="2.5" />
                <circle cx="23" cy="23" r="1.8" fill="#2C1B0E" />
                {[0, 45, 90, 135].map(a => (
                  <line key={a}
                    x1={23 + 6 * Math.cos((a * Math.PI) / 180)}
                    y1={23 + 6 * Math.sin((a * Math.PI) / 180)}
                    x2={23 + 8.5 * Math.cos((a * Math.PI) / 180)}
                    y2={23 + 8.5 * Math.sin((a * Math.PI) / 180)}
                    stroke="#2C1B0E" strokeWidth="2" strokeLinecap="round" />
                ))}
              </g>
            </>
          )}

          <rect x="3" y="39" width="40" height="3" rx="1.5" fill="#2C1B0E" />
        </svg>
      </button>
      </div>

      <span style={{
        padding: '3px 9px', borderRadius: 6, whiteSpace: 'nowrap',
        background: '#FFF4DF', border: '2px solid #2C1B0E',
        fontWeight: 900, fontSize: 11,
        color: state === 'done' && took ? '#1B7A3A' : '#241C12',
        opacity: showLabel ? 1 : 0,
        transition: 'opacity 0.16s ease',
      }}>
        {label}
      </span>
    </div>
  )
}

function CrystalBall({ parkMode, light, narrow, ambient, wisdom, darkness }: {
  parkMode: boolean
  light: LightDirection
  narrow: boolean
  ambient: string
  wisdom: WisdomShape
  darkness: number
}) {
  const open = useSyncExternalStore(
    subscribeSkyWisdom,
    readSkyWisdom,
    readSkyWisdomServer,
  )
  const [hover, setHover] = useState(false)

  const [casting, setCasting] = useState(false)
  const [castFading, setCastFading] = useState(false)
  const castTimer = useRef<number | null>(null)
  const castFadeTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (castTimer.current) window.clearTimeout(castTimer.current)
    if (castFadeTimer.current) window.clearTimeout(castFadeTimer.current)
  }, [])

  useEffect(() => {
    if (!hover) return
    const img = new Image()
    img.src = WISDOM_ENDPOINT
  }, [hover])

  const size = narrow ? 40 : 52
  const glow = 0.35 + darkness * 0.5

  return (
    <div style={{
      position: 'absolute',
      left: narrow ? '26%' : '40%',
      top: narrow ? '86%' : '62%',
      transform: 'translate(-50%, -100%)',
      pointerEvents: parkMode ? 'auto' : 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      zIndex: MAX_CAMPERS + 5,
    }}>
      <button
        type="button"
        onClick={() => {
          if (open) return
          setCasting(true)
          setCastFading(false)
          if (castTimer.current) window.clearTimeout(castTimer.current)
          if (castFadeTimer.current) window.clearTimeout(castFadeTimer.current)
          castFadeTimer.current = window.setTimeout(() => setCastFading(true), 3800)
          castTimer.current = window.setTimeout(() => setCasting(false), 5200)
          toggleSkyWisdom()
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        aria-label="See today's wisdom"
        aria-expanded={open}
        style={{
          position: 'relative',
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        }}
      >
        {light.strength > 0 && (
          <div style={{
            position: 'absolute', left: '50%', bottom: -3,
            width: px(size * 0.8 * (1 + (1 - light.elevation) * 1.2)), height: 8,
            transform: `translateX(-50%) translateX(${px(-light.x * 20 * (1 - light.elevation))})`,
            background: `rgba(24,46,20,${alpha8(0.3 * light.strength)})`,
            borderRadius: '50%', filter: 'blur(2.5px)',
          }} />
        )}

        {casting && <CastingAura size={size} fading={castFading} />}

        <svg width={size} height={size * 1.15} viewBox="0 0 46 53" style={{ filter: ambient, position: 'relative' }}>
          <path d="M12 44 L34 44 L30 51 L16 51 Z"
            fill="#8A5E36" stroke="#2C1B0E" strokeWidth="3" strokeLinejoin="round" />
          <ellipse cx="23" cy="43" rx="13" ry="4"
            fill="#C98B4B" stroke="#2C1B0E" strokeWidth="2.5" />

          <circle cx="23" cy="25" r="17" fill="#7FD4E8" stroke="#2C1B0E" strokeWidth="3" />
          <path d="M13 28 Q19 20, 26 25 T35 22" fill="none"
            stroke="rgb(var(--ink-rgb) / 0.55)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="17" cy="19" r="4.2" fill="rgb(var(--ink-rgb) / 0.75)" />
        </svg>

        <div aria-hidden style={{
          position: 'absolute', left: '50%', top: size * 0.42,
          width: size * 1.9, height: size * 1.9,
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, rgba(150,230,255,${alpha8(glow * (hover ? 0.85 : 0.55))}), transparent 65%)`,
          pointerEvents: 'none',
          transition: 'background 0.25s ease',
        }} />
      </button>
    </div>
  )
}

function WisdomShadow({ wisdom, light }: { wisdom: WisdomShape; light: LightDirection }) {
  const open = useSyncExternalStore(
    subscribeSkyWisdom,
    readSkyWisdom,
    readSkyWisdomServer,
  )
  if (!open) return null

  const width = Math.min(wisdom.w * 2, 1100)

  const shadowH = Math.max(34, Math.min(210, width * (wisdom.h / wisdom.w) * 0.42))

  const skewDeg = (light.x * 14).toFixed(1)
  const throwPx = -light.x * (90 + (1 - light.elevation) * 260)

  const ink = alpha8(0.3 + 0.22 * light.strength)

  return (
    <div
      aria-hidden
      className="wisdom-shadow"
      style={{
        position: 'absolute',
        left: '50%', top: 0, marginTop: -shadowH / 2,
        width, maxWidth: '86vw',
        height: shadowH,
        borderRadius: '12%',
        background: `rgba(14,28,16,${ink})`,
        filter: 'blur(18px)',
        pointerEvents: 'none',
        ['--skew' as string]: `${skewDeg}deg`,
        ['--sx1' as string]: `${(throwPx * 0.35).toFixed(1)}px`,
        ['--sx2' as string]: `${throwPx.toFixed(1)}px`,
        animation: `wisdomShadowCross ${WISDOM_RISE_MS - WISDOM_SHADOW_DELAY_MS}ms linear ${WISDOM_SHADOW_DELAY_MS}ms both`,
      } as Record<string, string | number>}
    />
  )
}

const MOTE_COUNT = 18

function CastingAura({ size, fading }: { size: number; fading: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        opacity: fading ? 0 : 1,
        transition: 'opacity 1.4s ease-out',
      }}
    >
      <style>{`
        @keyframes ballMote{
          0%{transform:translate(-50%,-50%) translate(0,0) scale(0.15);opacity:0}
          12%{opacity:1}
          55%{transform:translate(-50%,-50%) translate(var(--mx),var(--my)) scale(1);opacity:0.95}
          100%{transform:translate(-50%,-50%) translate(var(--dx),var(--dy)) scale(0.3);opacity:0}
        }
        @keyframes ballRing{
          0%{transform:translate(-50%,-50%) scale(0.25);opacity:0}
          20%{opacity:0.55}
          100%{transform:translate(-50%,-50%) scale(2.6);opacity:0}
        }
        @keyframes ballCore{
          0%,100%{opacity:0.35;transform:translate(-50%,-50%) scale(1)}
          50%{opacity:0.9;transform:translate(-50%,-50%) scale(1.25)}
        }
        @media (prefers-reduced-motion: reduce){
          .cg-mote,.cg-ring,.cg-core{animation:none!important;opacity:0!important}
        }
      `}</style>

      <div
        className="cg-core"
        style={{
          position: 'absolute', left: '50%', top: size * 0.42,
          width: size * 1.1, height: size * 1.1,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(190,245,255,0.85), rgba(120,210,240,0) 68%)',
          transform: 'translate(-50%, -50%)',
          animation: 'ballCore 1.9s ease-in-out infinite',
        }}
      />

      {[0, 1, 2].map(i => (
        <div
          key={`ring-${i}`}
          className="cg-ring"
          style={{
            position: 'absolute', left: '50%', top: size * 0.42,
            width: size * 1.3, height: size * 1.3,
            borderRadius: '50%',
            border: '1.5px solid rgba(178,235,255,0.75)',
            transform: 'translate(-50%, -50%)',
            opacity: 0,
            animation: `ballRing 2.6s cubic-bezier(0.2,0.6,0.2,1) ${i * 0.85}s infinite`,
          }}
        />
      ))}

      {Array.from({ length: MOTE_COUNT }, (_, i) => {
        const angle = (i / MOTE_COUNT) * Math.PI * 2 + hashUnit(`mote${i}`, 5) * 1.2
        const reach = size * (0.85 + hashUnit(`mote${i}`, 9) * 0.9)
        const dx = Math.cos(angle) * reach
        const dy = Math.sin(angle) * reach * 0.55 - size * 0.9
        const mx = Math.cos(angle + 0.9) * reach * 0.5
        const my = Math.sin(angle + 0.9) * reach * 0.3 - size * 0.35
        const dot = 2.5 + hashUnit(`mote${i}`, 13) * 3.5
        return (
          <span
            key={`mote-${i}`}
            className="cg-mote"
            style={{
              position: 'absolute', left: '50%', top: size * 0.42,
              width: dot, height: dot, borderRadius: '50%',
              background: hashUnit(`mote${i}`, 17) > 0.6 ? '#FFFFFF' : '#9FE6FF',
              boxShadow: '0 0 6px rgba(160,230,255,0.9)',
              transform: 'translate(-50%, -50%)',
              opacity: 0,
              ['--dx' as string]: `${dx.toFixed(1)}px`,
              ['--dy' as string]: `${dy.toFixed(1)}px`,
              ['--mx' as string]: `${mx.toFixed(1)}px`,
              ['--my' as string]: `${my.toFixed(1)}px`,
              animation: `ballMote ${(2.4 + hashUnit(`mote${i}`, 21) * 1.6).toFixed(2)}s ease-out ${(hashUnit(`mote${i}`, 25) * 2.4).toFixed(2)}s infinite`,
            } as Record<string, string | number>}
          />
        )
      })}
    </div>
  )
}

function Signpost({ onToggle, entered, light, narrow = false, ambient = 'none' }: {
  onToggle?: () => void
  entered: boolean
  light: LightDirection
  narrow?: boolean
  ambient?: string
}) {
  const [hover, setHover] = useState(false)
  const lit = hover

  const leaving = entered && hover

  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      aria-label={entered ? 'Leave Counting Park' : 'Enter Counting Park'}
      style={{
        position: 'absolute', left: narrow ? 8 : 12, top: narrow ? '40%' : '52%',
        transform: 'translateY(-100%) rotate(-5deg)',
        transformOrigin: 'bottom left',
        pointerEvents: 'auto',
        background: 'none', border: 'none', padding: 0,
        cursor: 'pointer',
      }}
    >
      <div style={{
        filter: ambient,
        padding: '5px 11px 6px',
        background: lit ? '#E8A863' : '#C98B4B',
        border: '3px solid #2C1B0E',
        borderRadius: 6,
        boxShadow: lit ? '0 3px 0 #2C1B0E, 0 0 14px rgba(255,214,140,0.75)' : '0 3px 0 #2C1B0E',
        transition: 'background 0.18s ease, box-shadow 0.18s ease',
        textAlign: 'center',
        lineHeight: 1.05,
        whiteSpace: 'nowrap',
      }}>
        <div style={{
          display: 'grid',
          fontWeight: 900,
          fontSize: 'clamp(10px, 1.5vw, 13px)', letterSpacing: '0.04em',
          color: lit ? '#FFFFFF' : '#FFF6E8',
          WebkitTextStroke: '0.6px #2C1B0E', paintOrder: 'stroke fill',
          transition: 'color 0.18s ease',
        }}>
          <span style={{ gridArea: '1 / 1', visibility: leaving ? 'hidden' : 'visible' }}>
            COUNTING
          </span>
          <span aria-hidden={!leaving} style={{ gridArea: '1 / 1', visibility: leaving ? 'visible' : 'hidden' }}>
            ← LEAVE
          </span>
        </div>
        <div style={{
          fontWeight: 900,
          fontSize: 'clamp(12px, 1.8vw, 15px)', letterSpacing: '0.12em',
          color: lit ? '#FFFFFF' : '#FFF6E8',
          WebkitTextStroke: '0.6px #2C1B0E', paintOrder: 'stroke fill',
          transition: 'color 0.18s ease',
        }}>
          PARK
        </div>
      </div>
      <div style={{
        width: 9, height: 24, margin: '0 auto',
        background: '#8A5E36', border: '3px solid #2C1B0E', borderTop: 'none',
        borderRadius: '0 0 3px 3px',
        filter: ambient,
      }} />

      {light.strength > 0 && (
        <div style={{
          position: 'absolute',
          left: '38%', bottom: -5,
          width: px(54 * (1 + (1 - light.elevation) * 1.5)),
          height: 11,
          transform: `translateX(-50%) translateX(${px(-light.x * 34 * (1 - light.elevation))})`,
          background: `rgba(24,46,20,${alpha8(0.34 * light.strength)})`,
          borderRadius: '50%',
          filter: 'blur(2.5px)',
          transition: 'transform 1s linear, width 1s linear, background 1s linear',
        }} />
      )}
    </button>
  )
}


const TREE_MIN_COUNTS = 500
const TREE_MAX_COUNTS = 500_000

export function treeGrowth(totalCounts: number): number {
  const lo = Math.log10(TREE_MIN_COUNTS)
  const hi = Math.log10(TREE_MAX_COUNTS)
  const t = (Math.log10(Math.max(totalCounts, 1) + 1) - lo) / (hi - lo)
  return Math.max(0, Math.min(1, t))
}

function Tree({ growth, light, narrow = false, ambient = 'none' }: {
  growth: number
  light: LightDirection
  narrow?: boolean
  ambient?: string
}) {
  const s = narrow ? 0.66 : 1
  const w = (44 + growth * 132) * s
  const h = (84 + growth * 300) * s
  const trunkW = (7 + growth * 20) * s
  const canopyR = w * (0.3 + growth * 0.2)
  const canopyY = h * (0.36 - growth * 0.06)
  const outline = Math.max(2, 2 + growth * 1.6)

  return (
    <div aria-hidden style={{
      position: 'absolute', right: narrow ? '3%' : '9%', top: narrow ? '92%' : '84%',
      transform: 'translate(50%, -100%)',
      zIndex: MAX_CAMPERS + 10,
    }}>
      {light.strength > 0 && (
        <div style={{
          position: 'absolute',
          left: '50%', bottom: px(-h * 0.012),
          width: px(w * 0.78 * (1 + (1 - light.elevation) * 1.8)),
          height: px(w * 0.17),
          transform: `translateX(-50%) translateX(${px(-light.x * h * 0.42 * (1 - light.elevation))})`,
          background: `rgba(24,46,20,${alpha8(0.32 * light.strength)})`,
          borderRadius: '50%',
          filter: 'blur(3px)',
          transition: 'transform 1s linear, width 1s linear, background 1s linear',
        }} />
      )}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{
        display: 'block', overflow: 'visible', position: 'relative',
        filter: ambient,
      }}>
        <path
          d={`M ${w / 2 - trunkW / 2} ${h}
              L ${w / 2 - trunkW * 0.34} ${canopyY}
              L ${w / 2 + trunkW * 0.34} ${canopyY}
              L ${w / 2 + trunkW / 2} ${h} Z`}
          fill="#8A5E36" stroke="#2C1B0E" strokeWidth={outline} strokeLinejoin="round"
        />
        <g fill="#5E9448" stroke="#22401B" strokeWidth={outline} strokeLinejoin="round">
          <circle cx={w / 2 - canopyR * 0.52} cy={canopyY} r={canopyR * 0.72} />
          <circle cx={w / 2 + canopyR * 0.52} cy={canopyY} r={canopyR * 0.72} />
          <circle cx={w / 2} cy={canopyY - canopyR * 0.42} r={canopyR * 0.84} />
        </g>
        <circle
          cx={w / 2 - canopyR * 0.2} cy={canopyY - canopyR * 0.62}
          r={canopyR * 0.3} fill="rgb(var(--ink-rgb) / 0.16)"
        />
      </svg>
    </div>
  )
}

function Fireflies({ darkness }: { darkness: number }) {
  return (
    <>
      {Array.from({ length: 12 }, (_, i) => {
        const x = hashUnit(`fly${i}`, 23) * 96
        const y = 10 + hashUnit(`fly${i}`, 29) * 78
        const delay = hashUnit(`fly${i}`, 31) * 6
        return (
          <div
            key={`fly${i}`}
            className="cg-drift"
            style={{
              position: 'absolute', left: `${x}%`, top: `${y}%`,
              width: 4, height: 4, borderRadius: '50%',
              background: '#FFF3A8',
              boxShadow: '0 0 6px 2px rgba(255,240,150,0.6)',
              opacity: Math.min(1, (darkness - 0.6) * 3),
              animation: `drift ${5 + (i % 4)}s ease-in-out ${delay}s infinite`,
              willChange: 'transform, opacity',
            }}
          />
        )
      })}
    </>
  )
}

function Figure({ camper, z }: { camper: Placed; z: number }) {
  const src = camper.discordId && camper.avatar
    ? avatarUrl({ discordId: camper.discordId, avatar: camper.avatar })
    : undefined

  const head = camper.size
  const bodyW = head * 0.86
  const bodyH = head * 0.62
  const ring = Math.max(2, head * 0.07)

  return (
    <div style={{
      position: 'absolute',
      left: `${camper.x}%`,
      top: `${camper.y}%`,
      transform: `translate(-50%, -100%) ${camper.flip ? 'scaleX(-1)' : ''}`,
      zIndex: z,
      width: head,
    }}>
      <div style={{
        position: 'absolute',
        left: '50%',
        bottom: -bodyH * 0.34,
        width: bodyW,
        height: bodyH,
        transform: 'translateX(-50%)',
        background: camper.color || '#94a3b8',
        border: `${ring}px solid #1b1207`,
        borderRadius: `${bodyW}px ${bodyW}px ${bodyW * 0.3}px ${bodyW * 0.3}px`,
      }} />

      <div style={{
        position: 'relative',
        width: head,
        height: head,
        borderRadius: '50%',
        border: `${ring}px solid #1b1207`,
        background: camper.color || '#94a3b8',
        overflow: 'hidden',
        boxShadow: '0 2px 0 rgb(var(--shadow-rgb) / 0.25)',
      }}>
        {src && (
          <img
            src={src}
            alt=""
            width={head}
            height={head}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
      </div>

      <div style={{
        position: 'absolute',
        left: '50%',
        bottom: -bodyH * 0.5,
        width: bodyW * 1.15,
        height: bodyW * 0.22,
        transform: 'translateX(-50%)',
        background: 'rgba(20,40,16,0.28)',
        borderRadius: '50%',
        filter: 'blur(1px)',
      }} />
    </div>
  )
}

'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { truncatedPercent } from '@/lib/pct'

const API = ''

const INK = '#241C12'
const FILL = '#F9A03F'
const TRACK = 'rgba(36,28,18,0.09)'
const MINE = '#1D7A5F'

export type HourDatum = { hour: number; pct: number; claimed: number }

export type Unit = 'ms' | 'cs'

const UNITS = {
  ms: {
    route: 'msCoverage',
    perSecond: 1000,
    perHour: 3_600_000,
    total: 86_400_000,
    label: 'millisecond',
    leafColumns: 40,
    hasOwners: true,
    decimals: 3,
  },
  cs: {
    route: 'csCoverage',
    perSecond: 100,
    perHour: 360_000,
    total: 8_640_000,
    label: 'centisecond',
    leafColumns: 10,
    hasOwners: true,
    decimals: 2,
  },
} as const

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

function remainingLabel(n: number): string {
  if (n <= 0) return '✓'
  if (n < 1000) return String(n)
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

const POPCOUNT = (() => {
  const t = new Uint8Array(256)
  for (let i = 0; i < 256; i++) t[i] = (i & 1) + t[i >> 1]
  return t
})()

function secondLabel(hour: number, second: number): string {
  return `${pad(hour)}:${pad(Math.floor(second / 60))}:${pad(second % 60)}`
}

const RAMP = [
  '#7B8794',
  '#A9803F',
  '#D08A2E',
  '#F9A03F',
  '#F2622E',
  '#D6202B',
]

const DONE = '#0F9D58'

export function MsCoverageExplorer({
  byHour,
  claimed,
  total,
  myClaims,
  myClaimsByHour,
  myUuid,
  unit = 'ms',
}: {
  byHour: HourDatum[]
  claimed: number
  total: number
  myClaims: number | null
  myClaimsByHour: number[] | null
  myUuid: string | null
  unit?: Unit
}) {
  const U = UNITS[unit]
  const [level, setLevel] = useState<Level>({ kind: 'hours' })
  const [hover, setHover] = useState<string | null>(null)

  const [seconds, setSeconds] = useState<number[] | null>(null)
  const [msBits, setMsBits] = useState<Uint8Array | null>(null)
  const [loading, setLoading] = useState(false)

  const hasMine = !!myClaimsByHour && myClaimsByHour.some((n) => n > 0)

  useEffect(() => {
    setHover(null)
  }, [level])

  useEffect(() => {
    if (level.kind !== 'seconds') return
    let cancelled = false
    setSeconds(null)
    setLoading(true)
    fetch(`${API}/api/thread/${U.route}/hour/${level.hour}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && d && setSeconds(d.seconds))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [level])

  useEffect(() => {
    if (level.kind !== 'ms') return
    let cancelled = false
    setMsBits(null)
    setLoading(true)
    fetch(`${API}/api/thread/${U.route}/hour/${level.hour}/second/${level.second}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.blob) return
        const bin = atob(d.blob)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        setMsBits(bytes)
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [level, U.route])

  let levelSummary: React.ReactNode = null
  if (level.kind === 'seconds' && seconds) {
    const left = seconds.reduce((a, b) => a + (U.perSecond - b), 0)
    const claimedHere = U.perHour - left
    const mineHere = myClaimsByHour?.[level.hour] ?? 0
    levelSummary = (
      <>
        {pad(level.hour)}:00 · {claimedHere.toLocaleString()}/{U.perHour.toLocaleString()}
        {hasMine && mineHere > 0 && (
          <span style={{ color: MINE }}>
            {'  ·  '}you counted {mineHere.toLocaleString()} first
          </span>
        )}
      </>
    )
  } else if (level.kind === 'ms' && msBits) {
    let n = 0
    for (const b of msBits) n += POPCOUNT[b]
    levelSummary = (
      <>
        {secondLabel(level.hour, level.second)} · {n}/{U.perSecond}
      </>
    )
  }

  const crumb = useCallback(
    (label: string, onClick?: () => void) => (
      <button
        key={label}
        type="button"
        onClick={onClick}
        disabled={!onClick}
        style={{
          background: 'none', border: 'none', padding: 0, font: 'inherit',
          color: onClick ? 'rgba(36,28,18,0.55)' : INK,
          fontWeight: onClick ? 600 : 800,
          cursor: onClick ? 'pointer' : 'default',
          textDecoration: onClick ? 'underline' : 'none',
        }}
      >
        {label}
      </button>
    ),
    [],
  )

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '2px solid rgba(36,28,18,0.14)' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          marginBottom: 10, fontSize: 11,
          fontWeight: 800, letterSpacing: '0.04em',
        }}
      >
        {crumb('24 hours', level.kind === 'hours' ? undefined : () => setLevel({ kind: 'hours' }))}
        {level.kind !== 'hours' && (
          <>
            <span style={{ color: 'rgba(36,28,18,0.35)' }}>›</span>
            {crumb(
              `${pad(level.hour)}:00 UTC`,
              level.kind === 'seconds' ? undefined : () => setLevel({ kind: 'seconds', hour: level.hour }),
            )}
          </>
        )}
        {level.kind === 'ms' && (
          <>
            <span style={{ color: 'rgba(36,28,18,0.35)' }}>›</span>
            {crumb(secondLabel(level.hour, level.second))}
          </>
        )}
      </div>

      <Morph>
      {level.kind === 'hours' && (
        <HourBars
          byHour={byHour}
          unit={unit}
          minePerHour={hasMine ? myClaimsByHour : null}
          onPick={(h) => setLevel({ kind: 'seconds', hour: h })}
          setHover={setHover}
        />
      )}

      {level.kind === 'seconds' && (
        <SecondGrid
          hour={level.hour}
          seconds={seconds}
          unit={unit}
          loading={loading}
          onPick={(s) => setLevel({ kind: 'ms', hour: level.hour, second: s })}
          setHover={setHover}
        />
      )}

      {level.kind === 'ms' && (
        <MsGrid
          hour={level.hour}
          second={level.second}
          bits={msBits}
          unit={unit}
          loading={loading}
          myUuid={myUuid}
          setHover={setHover}
        />
      )}
      </Morph>

      <div
        style={{
          marginTop: 8, textAlign: 'center',
          height: 18, lineHeight: '18px', overflow: 'hidden', whiteSpace: 'nowrap',
          fontSize: 'clamp(10px, 1.1vw, 12px)',
          fontWeight: 800,
          letterSpacing: '0.03em', color: 'rgba(36,28,18,0.62)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {hover ?? levelSummary ?? (
          <>
            {claimed.toLocaleString()}/{total.toLocaleString()}
            {myClaims !== null && myClaims > 0 && (
              <span style={{ color: MINE }}>
                {'  ·  '}you counted {myClaims.toLocaleString()} first
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

type Level =
  | { kind: 'hours' }
  | { kind: 'seconds'; hour: number }
  | { kind: 'ms'; hour: number; second: number }

function HourBars({
  byHour,
  unit,
  minePerHour,
  onPick,
  setHover,
}: {
  byHour: HourDatum[]
  unit: Unit
  minePerHour: number[] | null
  onPick: (hour: number) => void
  setHover: (s: string | null) => void
}) {
  const U = UNITS[unit]

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 64 }}>
        {byHour.map((d) => {
          const left = U.perHour - d.claimed
          const done = left === 0
          return (
          <button
            key={d.hour}
            type="button"
            onClick={() => onPick(d.hour)}
            onMouseEnter={() =>
              setHover(
                `${pad(d.hour)}:00 · ${d.claimed.toLocaleString()}/${U.perHour.toLocaleString()}` +
                  (minePerHour && minePerHour[d.hour] > 0
                    ? `  ·  you counted ${minePerHour[d.hour].toLocaleString()} first`
                    : ''),
              )
            }
            onMouseLeave={() => setHover(null)}
            aria-label={`Hour ${pad(d.hour)} UTC, ${truncatedPercent(d.pct, 1)} percent claimed`}
            style={{
              flex: 1, minWidth: 0, height: '100%', padding: 0, border: 'none',
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
              background: TRACK, borderRadius: 2, cursor: 'pointer', position: 'relative',
            }}
          >
            <div
              style={{
                height: `${d.pct}%`,
                minHeight: d.claimed > 0 ? 1 : 0,
                background: done ? DONE : FILL,
                borderRadius: 2,
              }}
            />
            <div
              style={{
                position: 'absolute', left: 0, right: 0, bottom: 2,
                textAlign: 'center',
                fontSize: 'clamp(8px, 1vw, 11px)', lineHeight: 1.1,
                fontWeight: 900,
                fontVariantNumeric: 'tabular-nums',
                color: done ? '#FFFFFF' : INK,
                pointerEvents: 'none',
                textShadow: done ? 'none' : '0 0 2px rgba(255,244,223,0.9)',
              }}
            >
              {remainingLabel(left)}
            </div>
          </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', marginTop: 3 }}>
        {byHour.map((d) => (
          <div
            key={d.hour}
            style={{
              flex: 1, minWidth: 0, textAlign: 'center',
              fontSize: 'clamp(8px, 1.05vw, 12px)',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 800, color: 'rgba(36,28,18,0.55)',
            }}
          >
            {pad(d.hour)}
          </div>
        ))}
      </div>
    </>
  )
}

function SecondGrid({
  hour,
  seconds,
  unit,
  loading,
  onPick,
  setHover,
}: {
  hour: number
  seconds: number[] | null
  unit: Unit
  loading: boolean
  onPick: (second: number) => void
  setHover: (s: string | null) => void
}) {
  const U = UNITS[unit]
  const model = useMemo(() => {
    if (!seconds) return null
    const remaining = seconds.map((n) => U.perSecond - n)
    const best = Math.min(...remaining)
    const worst = Math.max(...remaining)
    const endgame = best <= 25

    let colourOf: (i: number) => string
    if (endgame) {
      colourOf = (i: number) => {
        const r = remaining[i]
        if (r === 0) return DONE
        if (r === 1) return RAMP[1]
        if (r === 2) return RAMP[2]
        if (r <= 5) return RAMP[3]
        if (r <= 25) return RAMP[4]
        return RAMP[5]
      }
    } else {
      const order = remaining.map((r, i) => [r, i] as const).sort((a, b) => b[0] - a[0])
      const bucket = new Uint8Array(remaining.length)
      order.forEach(([, idx], rank) => {
        bucket[idx] = Math.min(Math.floor((rank / order.length) * RAMP.length), RAMP.length - 1)
      })
      colourOf = (i: number) => RAMP[bucket[i]]
    }

    let leader = 0
    for (let i = 1; i < remaining.length; i++) if (remaining[i] < remaining[leader]) leader = i
    return { remaining, best, worst, endgame, colourOf, leader }
  }, [seconds, U.perSecond])

  if (loading || !seconds || !model) {
    return <Placeholder text={loading ? 'Reading the hour…' : 'No data'} ratio={1} />
  }

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      {model.best > 0 && (
      <button
        type="button"
        onClick={() => onPick(model.leader)}
        style={{
          display: 'block', width: '100%', marginBottom: 6, padding: '4px 6px',
          background: 'rgba(214,32,43,0.08)', border: '1px solid rgba(214,32,43,0.25)',
          borderRadius: 4, cursor: 'pointer', font: 'inherit',
          fontSize: 10, fontWeight: 800,
          color: INK, letterSpacing: '0.03em', textAlign: 'center',
        }}
      >
        closest: {secondLabel(hour, model.leader)} — {model.best} to go
      </button>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(60, 1fr)', gap: 0 }}>
        {seconds.map((n, s) => {
          const isLeader = s === model.leader
          return (
            <div
              key={s}
              onClick={() => onPick(s)}
              onMouseEnter={() =>
                setHover(
                  `${secondLabel(hour, s)} · ${n}/${U.perSecond}`,
                )
              }
              onMouseLeave={() => setHover(null)}
              title={`${secondLabel(hour, s)} - ${U.perSecond - n} to go`}
              style={{
                aspectRatio: '1', cursor: 'pointer', position: 'relative',
                border: '1px solid rgb(var(--shadow-rgb) / 0.20)',
                background: 'rgb(var(--shadow-rgb) / 0.05)',
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                borderRadius: 1,
                outline: isLeader && model.best > 0 ? `2px solid ${INK}` : undefined,
                outlineOffset: isLeader && model.best > 0 ? 1 : undefined,
                zIndex: isLeader && model.best > 0 ? 1 : undefined,
              }}
            >
              <div
                style={{
                  height: `${(n / U.perSecond) * 100}%`,
                  background: model.colourOf(s),
                  borderRadius: 1,
                }}
              />
            </div>
          )
        })}
      </div>

      <div
        style={{
          marginTop: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 4, fontSize: 9, color: 'rgba(36,28,18,0.55)',
          fontWeight: 700,
        }}
      >
        {model.endgame ? (
          <>
            <div style={{ width: 11, height: 9, borderRadius: 1, background: DONE }} />
            <span>done</span>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ width: 11, height: 9, borderRadius: 1, background: RAMP[i] }} />
            ))}
            <span>{model.worst} to go</span>
          </>
        ) : (
          <>
            <span>{model.worst} to go</span>
            {RAMP.map((c) => (
              <div key={c} style={{ width: 11, height: 9, borderRadius: 1, background: c }} />
            ))}
            <span>{model.best}</span>
          </>
        )}
      </div>

    </div>
  )
}

function MsGrid({
  hour,
  second,
  bits,
  unit,
  loading,
  myUuid,
  setHover,
}: {
  hour: number
  second: number
  bits: Uint8Array | null
  unit: Unit
  loading: boolean
  myUuid: string | null
  setHover: (s: string | null) => void
}) {
  const U = UNITS[unit]
  const [owners, setOwners] = useState<OwnerData | null>(null)

  useEffect(() => {
    if (!U.hasOwners) {
      setOwners(null)
      return
    }
    let cancelled = false
    setOwners(null)
    fetch(`${API}/api/thread/${U.route}/hour/${hour}/second/${second}/owners`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.available) return
        setOwners({ owners: d.owners ?? [], tally: d.tally ?? [] })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [hour, second, U.hasOwners, U.route])

  if (loading || !bits) {
    return <Placeholder text={loading ? 'Reading the second…' : 'No data'} ratio={40 / 25} />
  }

  const mineHere = myUuid && owners ? owners.tally.find((t) => t.counterUuid === myUuid) : undefined
  const colourOf = new Map(
    (owners?.tally ?? []).map((t) => [t.counterUuid, ownerColour(t.counterUuid, t.color)]),
  )
  const nameOf = new Map(
    (owners?.tally ?? []).map((t) => [t.counterUuid, t.name ?? null]),
  )

  const cells = []
  for (let ms = 0; ms < U.perSecond; ms++) {
    const on = (bits[ms >> 3] & (1 << (7 - (ms & 7)))) !== 0
    const owner = owners?.owners[ms] ?? null
    const isMine = !!myUuid && owner === myUuid
    const ownerName = owner ? nameOf.get(owner) : null
    cells.push(
      <div
        key={ms}
        onMouseEnter={() =>
          setHover(
            `${secondLabel(hour, second)}.${pad(ms, U.decimals)} · ` +
              (!on ? 'free' : isMine ? 'yours' : ownerName || 'claimed'),
          )
        }
        onMouseLeave={() => setHover(null)}
        title={`.${pad(ms, U.decimals)} - ${on ? (isMine ? 'yours' : 'claimed') : 'unclaimed'}`}
        style={{
          aspectRatio: '1',
          borderRadius: 1,
          background: !on ? TRACK : owner ? (colourOf.get(owner) ?? FILL) : FILL,
          boxShadow: isMine ? `0 0 0 1.5px ${INK}` : undefined,
          zIndex: isMine ? 1 : undefined,
          position: isMine ? 'relative' : undefined,
        }}
      />,
    )
  }

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${U.leafColumns}, 1fr)`,
          gap: 1,
          maxWidth: U.leafColumns < 20 ? 260 : undefined,
          margin: U.leafColumns < 20 ? '0 auto' : undefined,
        }}
      >
        {cells}
      </div>
      {owners && owners.tally.length > 0 && (
        <div
          style={{
            marginTop: 7, display: 'flex', flexWrap: 'wrap', gap: '3px 8px',
            justifyContent: 'center', fontSize: 9,
            fontWeight: 700, color: 'rgba(36,28,18,0.72)',
          }}
        >
          {mineHere && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 800 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: colourOf.get(myUuid!) ?? MINE, boxShadow: `0 0 0 1.5px ${INK}` }} />
              you · {mineHere.claims}
            </span>
          )}
          {owners.tally
            .filter((t) => t.counterUuid !== myUuid)
            .slice(0, 8)
            .map((t) => (
              <span key={t.counterUuid} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: ownerColour(t.counterUuid, t.color) }} />
                {t.name ?? t.counterUuid.slice(0, 8)} · {t.claims}
              </span>
            ))}
          {owners.tally.length > 9 && (
            <span style={{ color: 'rgba(36,28,18,0.45)' }}>
              +{owners.tally.length - (mineHere ? 9 : 8)} more
            </span>
          )}
        </div>
      )}

    </div>
  )
}

type OwnerData = {
  owners: (string | null)[]
  tally: { counterUuid: string; claims: number; name?: string | null; color?: string | null }[]
}

function ownerColour(uuid: string, colour?: string | null): string {
  if (colour) return colour
  let h = 0
  for (let i = 0; i < uuid.length; i++) h = (h * 31 + uuid.charCodeAt(i)) >>> 0
  return `hsl(${h % 360} 62% 52%)`
}

function Placeholder({ text, ratio }: { text: string; ratio: number }) {
  return (
    <div
      style={{
        width: '100%', aspectRatio: String(ratio),
        display: 'grid', placeItems: 'center',
        fontSize: 11,
        color: 'rgba(36,28,18,0.45)', background: TRACK, borderRadius: 4,
      }}
    >
      {text}
    </div>
  )
}

function Morph({ children }: { children: React.ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)
  const settled = useRef(false)

  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setHeight(entry.contentRect.height)
      settled.current = true
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      style={{
        height,
        overflow: 'hidden',
        transition: settled.current ? 'height 240ms cubic-bezier(0.4, 0, 0.2, 1)' : undefined,
      }}
    >
      <div ref={inner}>{children}</div>
    </div>
  )
}

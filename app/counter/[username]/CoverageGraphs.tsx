'use client'

import { useMemo, useState } from 'react'
import { decodeSecondsBlob } from '@/lib/seconds'
import { truncatedPercent } from '@/lib/pct'
import { formatDurationCompact, formatDurationFull } from '@/lib/duration'

export type ContributionDays = Record<string, number>

export type SecondsCoverage = {
  covered: number
  total: number
  pct: number
  byHour: number[]
  blob?: string
}

const COMPLETE = '#0F9D58'

type Tip = { x: number; y: number; title: string; sub?: string } | null

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null
  return (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: tip.x,
        top: tip.y - 10,
        transform: 'translate(-50%, -100%)',
        pointerEvents: 'none',
        zIndex: 60,
        padding: '6px 9px',
        borderRadius: 6,
        background: 'var(--surface-raised)',
        border: '1px solid rgb(var(--ink-rgb) / 0.18)',
        color: 'var(--ink-1)',
        fontSize: '0.7rem',
        lineHeight: 1.35,
        whiteSpace: 'nowrap',
        boxShadow: '0 6px 18px rgb(var(--shadow-rgb) / 0.28)',
      }}
    >
      <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{tip.title}</div>
      {tip.sub && (
        <div style={{ color: 'rgb(var(--ink-rgb) / 0.62)', fontVariantNumeric: 'tabular-nums' }}>
          {tip.sub}
        </div>
      )}
    </div>
  )
}

function StepButton({
  dir,
  onClick,
  disabled,
  label,
}: {
  dir: 'prev' | 'next'
  onClick: () => void
  disabled: boolean
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        width: 24,
        height: 24,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 6,
        border: '1px solid rgb(var(--ink-rgb) / 0.14)',
        background: 'transparent',
        color: disabled ? 'rgb(var(--ink-rgb) / 0.34)' : 'rgb(var(--ink-rgb) / 0.68)',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: '0.85rem',
        lineHeight: 1,
        padding: 0,
      }}
    >
      {dir === 'prev' ? '‹' : '›'}
    </button>
  )
}

const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function prettyDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function level(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0
  const r = count / max
  if (r > 0.6) return 4
  if (r > 0.3) return 3
  if (r > 0.1) return 2
  return 1
}

export function ContributionGraph({
  days,
  timeDays,
  color,
  since,
}: {
  days: ContributionDays
  timeDays?: ContributionDays
  color: string
  since?: number | null
}) {
  const [tip, setTip] = useState<Tip>(null)
  const hasTime = !!timeDays && Object.keys(timeDays).length > 0
  const [mode, setMode] = useState<'counts' | 'time'>('counts')
  const showTime = mode === 'time' && hasTime
  const shown = showTime ? timeDays! : days
  const fmt = (n: number) => (showTime ? formatDurationCompact(n) : n.toLocaleString())

  const startDay = useMemo(() => {
    let start: Date | null = null
    if (since != null) {
      start = new Date(since)
      start.setHours(0, 0, 0, 0)
    }
    let earliest: string | null = null
    for (const k of Object.keys(days)) {
      if ((days[k] ?? 0) > 0 && (earliest === null || k < earliest)) earliest = k
    }
    if (earliest) {
      const [ey, em, ed] = earliest.split('-').map(Number)
      const dataStart = new Date(ey, em - 1, ed)
      if (!start || dataStart < start) start = dataStart
    }
    return start
  }, [days, since])

  const years = useMemo(() => {
    const present = new Set<number>()
    for (const k of Object.keys(days)) {
      const y = Number(k.slice(0, 4))
      if (Number.isFinite(y)) present.add(y)
    }
    present.add(new Date().getFullYear())
    if (startDay) present.add(startDay.getFullYear())
    const floor = startDay ? startDay.getFullYear() : -Infinity
    return [...present].filter((y) => y >= floor).sort((a, b) => a - b)
  }, [days, startDay])

  const [year, setYear] = useState(() => years[years.length - 1])
  const yearIdx = years.indexOf(year)

  const { weeks, total, max, activeDays, best } = useMemo(() => {
    const first = new Date(year, 0, 1)
    const last = new Date(year, 11, 31)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const start = new Date(first)
    start.setDate(start.getDate() - start.getDay())

    const cells: ({ key: string; count: number } | null)[] = []
    const cursor = new Date(start)
    while (cursor <= last || cursor.getDay() !== 0) {
      const inYear = cursor.getFullYear() === year
      const beforeStart = startDay != null && cursor < startDay
      const afterToday = cursor > today
      if (inYear && !beforeStart && !afterToday) {
        const key = dayKey(cursor)
        cells.push({ key, count: shown[key] ?? 0 })
      } else {
        cells.push(null)
      }
      cursor.setDate(cursor.getDate() + 1)
      if (cursor > last && cursor.getDay() === 0) break
    }

    const weeks: ({ key: string; count: number } | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) {
      const col = cells.slice(i, i + 7)
      while (col.length < 7) col.push(null)
      weeks.push(col)
    }

    let total = 0
    let max = 0
    let activeDays = 0
    let best: { key: string; count: number } | null = null
    for (const c of cells) {
      if (!c) continue
      total += c.count
      if (c.count > max) {
        max = c.count
        best = c
      }
      if (c.count > 0) activeDays++
    }

    return { weeks, total, max, activeDays, best }
  }, [shown, year, startDay])

  const monthLabels = useMemo(() => {
    const out: { index: number; label: string }[] = []
    let last = -1
    weeks.forEach((col, i) => {
      const firstDay = col.find(Boolean)
      if (!firstDay) return
      const month = Number(firstDay.key.slice(5, 7)) - 1
      if (month !== last) {
        out.push({ index: i, label: MONTH_LABELS[month] })
        last = month
      }
    })
    return out
  }, [weeks])

  const shade = (lv: number): string =>
    lv === 0
      ? 'rgb(var(--ink-rgb) / 0.06)'
      : `color-mix(in srgb, ${color} ${lv * 25}%, transparent)`

  return (
    <section style={{ marginBottom: 28 }}>
      <Tooltip tip={tip} />

      <div
        style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end',
          gap: 12, marginBottom: 14, flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {hasTime && (
            <div role="group" aria-label="Show" style={{ display: 'flex', gap: 2 }}>
              {(['counts', 'time'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', cursor: 'pointer',
                    border: '1px solid rgb(var(--ink-rgb) / 0.14)',
                    background: mode === m ? 'rgb(var(--ink-rgb) / 0.1)' : 'transparent',
                    color: mode === m ? 'var(--ink-1)' : 'rgb(var(--ink-rgb) / 0.55)',
                    fontWeight: mode === m ? 700 : 400,
                  }}
                >
                  {m === 'counts' ? 'Counts' : 'Time'}
                </button>
              ))}
            </div>
          )}
          <div
            style={{
              fontSize: 'clamp(0.7rem, 1.6vw, 1rem)', color: 'rgb(var(--ink-rgb) / 0.45)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {showTime ? `${formatDurationCompact(total)} counting` : `${total.toLocaleString()} counts`}
            {' · '}{activeDays} active {activeDays === 1 ? 'day' : 'days'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <StepButton
              dir="prev"
              label="Previous year"
              disabled={yearIdx <= 0}
              onClick={() => setYear(years[Math.max(yearIdx - 1, 0)])}
            />
            <div
              style={{
                minWidth: 42, textAlign: 'center', fontWeight: 700,
                fontSize: 'clamp(0.78rem, 2.4vw, 1.5rem)',
                color: 'var(--ink-1)', fontVariantNumeric: 'tabular-nums',
              }}
            >
              {year}
            </div>
            <StepButton
              dir="next"
              label="Next year"
              disabled={yearIdx >= years.length - 1}
              onClick={() => setYear(years[Math.min(yearIdx + 1, years.length - 1)])}
            />
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ display: 'inline-block', minWidth: 'min-content' }}>
          <div style={{ display: 'flex', marginLeft: 30, marginBottom: 4, position: 'relative', height: 12 }}>
            {monthLabels.map(({ index, label }) => (
              <div
                key={`${label}-${index}`}
                style={{
                  position: 'absolute', left: index * 14, fontSize: '0.6rem',
                  color: 'rgb(var(--ink-rgb) / 0.55)', whiteSpace: 'nowrap',
                }}
              >
                {label}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 3 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 27, flexShrink: 0 }}>
              {WEEKDAY_LABELS.map((d, i) => (
                <div
                  key={i}
                  style={{
                    height: 11, fontSize: '0.55rem', lineHeight: '11px',
                    color: 'rgb(var(--ink-rgb) / 0.55)',
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            {weeks.map((col, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {col.map((cell, di) => (
                  <div
                    key={di}
                    onMouseEnter={
                      cell
                        ? (e) => {
                            const r = (e.target as HTMLElement).getBoundingClientRect()
                            setTip({
                              x: r.left + r.width / 2,
                              y: r.top,
                              title: showTime
                                ? cell.count > 0
                                  ? formatDurationFull(cell.count)
                                  : 'No time recorded'
                                : cell.count > 0
                                  ? `${cell.count.toLocaleString()} ${cell.count === 1 ? 'count' : 'counts'}`
                                  : 'No counts',
                              sub: prettyDate(cell.key),
                            })
                          }
                        : undefined
                    }
                    onMouseLeave={cell ? () => setTip(null) : undefined}
                    style={{
                      width: 11, height: 11, borderRadius: 2,
                      background: cell ? shade(level(cell.count, max)) : 'transparent',
                    }}
                  />
                ))}
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 4, marginTop: 8,
              marginLeft: 30, fontSize: '0.55rem', color: 'rgb(var(--ink-rgb) / 0.55)',
            }}
          >
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((lv) => (
              <div key={lv} style={{ width: 11, height: 11, borderRadius: 2, background: shade(lv) }} />
            ))}
            <span>More</span>
            {best && best.count > 0 && (
              <span style={{ marginLeft: 10 }}>
                Best day: {fmt(best.count)} on {prettyDate(best.key)}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function CoveragePanel({
  title,
  figure,
  pct,
  color,
  children,
}: {
  title: string
  figure: string
  pct: number
  color: string
  children: React.ReactNode
}) {
  return (
    <section style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <h3
        style={{
          margin: '0 0 8px', minWidth: 0,
          fontSize: 'clamp(0.74rem, 2.2vw, 1rem)', letterSpacing: '0.2em',
          color, fontWeight: 700,
        }}
      >
        {title}
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div
          style={{
            flex: 1, minWidth: 0,
            height: 6, borderRadius: 3, overflow: 'hidden',
            background: 'rgb(var(--ink-rgb) / 0.08)',
          }}
        >
          <div
            style={{
              width: `${Math.min(pct, 100)}%`, height: '100%',
              background: color, borderRadius: 3,
            }}
          />
        </div>
        <div
          style={{
            flexShrink: 0, whiteSpace: 'nowrap',
            fontSize: 'clamp(0.6rem, 1.3vw, 0.75rem)', color: 'rgb(var(--ink-rgb) / 0.55)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {figure}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </section>
  )
}

const SECS_PER_HOUR = 3600
const SECS_PER_MINUTE = 60

const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`

export function ClockCoverage({
  coverage,
  color,
}: {
  coverage: SecondsCoverage
  color: string
}) {
  const [openHour, setOpenHour] = useState<number | null>(null)
  const [tip, setTip] = useState<Tip>(null)

  const covered = useMemo(() => decodeSecondsBlob(coverage.blob), [coverage.blob])
  const hasDetail = covered.size > 0

  return (
    <>
      <Tooltip tip={tip} />
      <CoveragePanel
        title="UNIQUE SECONDS"
        figure={`${coverage.covered.toLocaleString()} / ${coverage.total.toLocaleString()} · ${truncatedPercent(coverage.pct, 2, { part: coverage.covered, whole: coverage.total })}%`}
        pct={coverage.pct}
        color={color}
      >

      <div style={{
        display: 'flex', alignItems: 'stretch', gap: 0,
        height: BOARD_H, flexShrink: 0,
      }}>
        {coverage.byHour.map((n, h) => {
          const hourPct = (n / SECS_PER_HOUR) * 100
          const isOpen = openHour === h
          return (
            <button
              key={h}
              type="button"
              onClick={() => hasDetail && setOpenHour(isOpen ? null : h)}
              onMouseEnter={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                setTip({
                  x: r.left + r.width / 2,
                  y: r.top,
                  title: `${hourLabel(h)} UTC (${truncatedPercent(hourPct, 1, { part: n, whole: SECS_PER_HOUR })}%)`,
                  sub: `${n.toLocaleString()} of 3,600 seconds`,
                })
              }}
              onMouseLeave={() => setTip(null)}
              aria-label={`${hourLabel(h)} UTC, ${hourPct.toFixed(1)} percent covered`}
              aria-expanded={isOpen}
              style={{
                flex: 1,
                minWidth: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                background: isOpen ? 'rgb(var(--ink-rgb) / 0.07)' : 'transparent',
                border: 'none',
                borderRight: h < 23 ? '1px solid rgb(var(--ink-rgb) / 0.09)' : 'none',
                borderTop: isOpen ? `2px solid ${color}` : '2px solid transparent',
                cursor: hasDetail ? 'pointer' : 'default',
              }}
            >
              <div
                style={{
                  margin: '0 2px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  background: 'rgb(var(--ink-rgb) / 0.05)',
                  borderRadius: 2,
                }}
              >
                <div
                  style={{
                    height: `${hourPct}%`,
                    minHeight: n > 0 ? 1 : 0,
                    background: color,
                    opacity: isOpen ? 1 : 0.85,
                    borderRadius: 2,
                  }}
                />
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', marginTop: 5 }}>
        {coverage.byHour.map((_, h) => (
          <div
            key={h}
            style={{
              flex: 1, minWidth: 0, textAlign: 'center',
              fontSize: '0.5rem',
              fontVariantNumeric: 'tabular-nums',
              color:
                openHour === h
                  ? 'var(--ink-1)'
                  : h % 2 === 0
                    ? 'rgb(var(--ink-rgb) / 0.62)'
                    : 'rgb(var(--ink-rgb) / 0.42)',
              fontWeight: openHour === h ? 700 : 400,
            }}
          >
            {String(h).padStart(2, '0')}
          </div>
        ))}
      </div>

      {openHour !== null && (
        <HourGrid
          hour={openHour}
          covered={covered}
          color={color}
          onClose={() => setOpenHour(null)}
          onStep={(d) => setOpenHour((h) => (h === null ? null : (h + d + 24) % 24))}
          setTip={setTip}
        />
      )}
      </CoveragePanel>
    </>
  )
}

function HourGrid({
  hour,
  covered,
  color,
  onClose,
  onStep,
  setTip,
}: {
  hour: number
  covered: Set<number>
  color: string
  onClose: () => void
  onStep: (delta: number) => void
  setTip: (t: Tip) => void
}) {
  const base = hour * SECS_PER_HOUR

  const { rows, count } = useMemo(() => {
    const rows: boolean[][] = []
    let count = 0
    for (let m = 0; m < SECS_PER_MINUTE; m++) {
      const row: boolean[] = new Array(SECS_PER_MINUTE)
      for (let s = 0; s < SECS_PER_MINUTE; s++) {
        const hit = covered.has(base + m * SECS_PER_MINUTE + s)
        row[s] = hit
        if (hit) count++
      }
      rows.push(row)
    }
    return { rows, count }
  }, [covered, base])

  const pct = (count / SECS_PER_HOUR) * 100

  return (
    <div
      style={{
        marginTop: 16, padding: 14, borderRadius: 10,
        background: 'rgb(var(--ink-rgb) / 0.04)',
        border: '1px solid rgb(var(--ink-rgb) / 0.08)',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, marginBottom: 12, flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StepButton dir="prev" label="Previous hour" disabled={false} onClick={() => onStep(-1)} />
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-1)', fontVariantNumeric: 'tabular-nums' }}>
            {hourLabel(hour)}–{hourLabel((hour + 1) % 24)} UTC
          </div>
          <StepButton dir="next" label="Next hour" disabled={false} onClick={() => onStep(1)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: '0.7rem', color: 'rgb(var(--ink-rgb) / 0.45)', fontVariantNumeric: 'tabular-nums' }}>
            {count.toLocaleString()} / 3,600 · {truncatedPercent(pct, 2, { part: count, whole: SECS_PER_HOUR })}%
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close hour detail"
            style={{
              width: 24, height: 24, display: 'grid', placeItems: 'center',
              borderRadius: 6, border: '1px solid rgb(var(--ink-rgb) / 0.14)',
              background: 'transparent', color: 'rgb(var(--ink-rgb) / 0.6)',
              cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1, padding: 0,
            }}
          >
            ×
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'inline-block', minWidth: 'min-content' }}>
          {rows.map((row, m) => (
            <div key={m} style={{ display: 'flex', gap: 1, marginBottom: 1, alignItems: 'center' }}>
              <div
                style={{
                  width: 20, flexShrink: 0, textAlign: 'right', paddingRight: 4,
                  fontSize: '0.45rem', lineHeight: '5px',
                  color: 'rgb(var(--ink-rgb) / 0.52)', fontVariantNumeric: 'tabular-nums',
                }}
              >
                {m % 10 === 0 ? `:${String(m).padStart(2, '0')}` : ''}
              </div>
              {row.map((hit, s) => (
                <div
                  key={s}
                  onMouseEnter={(e) => {
                    const r = (e.target as HTMLElement).getBoundingClientRect()
                    setTip({
                      x: r.left + r.width / 2,
                      y: r.top,
                      title: `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} UTC`,
                      sub: hit ? 'Counted' : 'Not yet counted',
                    })
                  }}
                  onMouseLeave={() => setTip(null)}
                  style={{
                    width: 5, height: 5, borderRadius: 1, flexShrink: 0,
                    background: hit ? color : 'rgb(var(--ink-rgb) / 0.07)',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export type EndingsCoverage = {
  covered: number
  total: number
  pct: number
  blob: string | null
  byBlock: number[]
}

export function EndingsGraph({
  coverage,
  color,
}: {
  coverage: EndingsCoverage
  color: string
}) {
  const [block, setBlock] = useState<number | null>(null)
  const [tip, setTip] = useState<Tip>(null)

  const opened = block !== null
  const held = useMemo(
    () => (opened ? decodeSecondsBlob(coverage.blob) : null),
    [coverage.blob, opened],
  )

  const shade = (filled: number): string => {
    if (filled <= 0) return 'rgb(var(--ink-rgb) / 0.06)'
    if (filled >= 1000) return '#0F9D58'
    const r = filled / 1000
    const lv = r > 0.75 ? 0.9 : r > 0.5 ? 0.7 : r > 0.25 ? 0.5 : 0.3
    return `color-mix(in srgb, ${color} ${lv * 100}%, transparent)`
  }

  return (
    <>
      <Tooltip tip={tip} />
      <CoveragePanel
        title="100K SPREAD (NON-DOUBLE)"
        figure={`${coverage.covered.toLocaleString()} / ${coverage.total.toLocaleString()} · ${truncatedPercent(coverage.pct, 2, { part: coverage.covered, whole: coverage.total })}%`}
        pct={coverage.pct}
        color={color}
      >
      <div
        style={{
          display: 'grid', gridTemplateColumns: `repeat(10, 1fr)`, gap: BLOCK_GAP,
        }}
      >
        {coverage.byBlock.map((filled, b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBlock((cur) => (cur === b ? null : b))}
            onMouseEnter={(e) => {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
              setTip({
                x: r.left + r.width / 2,
                y: r.top,
                title: `${endingLabel(b * 1000)}–${endingLabel(b * 1000 + 999)}`,
                sub: `${filled}/1,000 counted`,
              })
            }}
            onMouseLeave={() => setTip(null)}
            aria-label={`Block ${endingLabel(b * 1000)}, ${filled} of 1000 counted`}
            aria-pressed={block === b}
            style={{
              height: BLOCK_H, padding: 0, cursor: 'pointer',
              borderRadius: 3, background: shade(filled),
              border: block === b ? '1px solid var(--ink-1)' : '1px solid transparent',
              display: 'grid', placeItems: 'center',
              fontSize: 8, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
              color: filled >= 1000 ? '#fff' : 'rgb(var(--ink-rgb) / 0.62)',
            }}
          >
            {filled >= 1000 ? '✓' : filled}
          </button>
        ))}
      </div>

      {block !== null && (
        <BlockGrid
          block={block}
          held={held}
          filled={coverage.byBlock[block] ?? 0}
          color={color}
          onClose={() => setBlock(null)}
          onStep={(d) => setBlock((b) => (b === null ? null : (b + d + 100) % 100))}
          setTip={setTip}
        />
      )}
      </CoveragePanel>
    </>
  )
}

const BLOCK_ROWS = 10
const BLOCK_GAP = 3
const BLOCK_H = 18
const BOARD_H = BLOCK_ROWS * BLOCK_H + (BLOCK_ROWS - 1) * BLOCK_GAP

function endingLabel(n: number, width = 5): string {
  return String(n).padStart(width, '0')
}

function BlockGrid({
  block,
  held,
  filled,
  color,
  onClose,
  onStep,
  setTip,
}: {
  block: number
  held: Set<number> | null
  filled: number
  color: string
  onClose: () => void
  onStep: (delta: number) => void
  setTip: (t: Tip) => void
}) {
  const pct = (filled / 1000) * 100

  return (
    <div
      style={{
        marginTop: 16, padding: 14, borderRadius: 10,
        background: 'rgb(var(--ink-rgb) / 0.04)',
        border: '1px solid rgb(var(--ink-rgb) / 0.08)',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, marginBottom: 12, flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StepButton dir="prev" label="Previous block" disabled={false} onClick={() => onStep(-1)} />
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--ink-1)', fontVariantNumeric: 'tabular-nums' }}>
            {endingLabel(block * 1000)}–{endingLabel(block * 1000 + 999)}
          </div>
          <StepButton dir="next" label="Next block" disabled={false} onClick={() => onStep(1)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: '0.7rem', color: 'rgb(var(--ink-rgb) / 0.45)', fontVariantNumeric: 'tabular-nums' }}>
            {filled.toLocaleString()} / 1,000 · {truncatedPercent(pct, 2, { part: filled, whole: 1000 })}%
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close block detail"
            style={{
              width: 24, height: 24, display: 'grid', placeItems: 'center',
              borderRadius: 6, border: '1px solid rgb(var(--ink-rgb) / 0.14)',
              background: 'transparent', color: 'rgb(var(--ink-rgb) / 0.6)',
              cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1, padding: 0,
            }}
          >
            ×
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(40, 1fr)', gap: 1 }}>
        {Array.from({ length: 1000 }).map((_, i) => {
          const value = block * 1000 + i
          const on = held?.has(value) ?? false
          return (
            <div
              key={i}
              onMouseEnter={(e) => {
                const r = (e.target as HTMLElement).getBoundingClientRect()
                setTip({
                  x: r.left + r.width / 2,
                  y: r.top,
                  title: endingLabel(value),
                  sub: on ? 'counted' : 'never counted',
                })
              }}
              onMouseLeave={() => setTip(null)}
              style={{
                aspectRatio: '1', borderRadius: 1,
                background: on ? color : 'rgb(var(--ink-rgb) / 0.07)',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

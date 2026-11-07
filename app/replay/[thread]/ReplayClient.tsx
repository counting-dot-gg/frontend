'use client'
import { scaleY, Y_TICKS, formatDuration } from '@/lib/paceScale'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReplayPost } from './page'
import { buildRowHTML, defaultRenderPrefs, setRowInteractive, setRowThreadName, type PostRow } from '@/components/thread/ThreadView'

const REPLAY_RENDER_PREFS = defaultRenderPrefs()

const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4] as const
type Speed = typeof PLAYBACK_SPEEDS[number]

type Props = {
  threadName: string
  threadTitle: string
  validationType?: string
  posts: ReplayPost[]
  startNum: number | null
  endNum: number | null
  error: string | null
  countsPerSplit: number
  splitsPerGet: number
  truncated?: boolean
  anchorTimestamp?: string | null
}

function formatClock(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '--'
  const total = ms / 1000
  const m = Math.floor(total / 60)
  const rest = total - m * 60
  return m > 0 ? `${m}:${rest.toFixed(3).padStart(6, '0')}` : rest.toFixed(3)
}


export type PaceStats = {
  replayType: 'get' | 'split' | 'range'
  getSize: number
  splitSize: number

  totalValidCounts: number
  totalMistakes: number
  mistakesPerSplit: number
  mistakesPerGet: number

  totalTimeMs: number
  medianPaceMs: number
  timeLostToMistakesMs: number
  cleanTimeMs: number

  counterCounts: Map<string, number>
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function gapsForCounts(counts: ReplayPost[], anchorTimestamp?: string | null): (number | null)[] {
  const out: (number | null)[] = new Array(counts.length).fill(null)
  const anchor = Number(anchorTimestamp)
  let prevValid: number | null = Number.isFinite(anchor) ? anchor : null

  for (let i = 0; i < counts.length; i++) {
    const p = counts[i]
    if (!p.isValidCount || p.stricken) continue
    const cur = Number(p.timestamp)
    if (!Number.isFinite(cur)) continue

    if (prevValid == null) {
      const t = Number(p.timeSinceLastCount)
      out[i] = Number.isFinite(t) && t > 0 ? t : null
    } else if (cur > prevValid) {
      out[i] = cur - prevValid
    }
    prevValid = cur
  }
  return out
}

function computePaceStats(posts: ReplayPost[], countsPerSplit: number, splitsPerGet: number, anchorTimestamp?: string | null): PaceStats {
  const getSize = countsPerSplit * splitsPerGet

  const counts = posts.filter(p => p.isCount)
  const gapByIndex = gapsForCounts(counts, anchorTimestamp)

  const validGaps: number[] = []
  const counterCounts = new Map<string, number>()
  let totalTimeMs = 0
  let totalMistakes = 0
  let totalValidCounts = 0

  counts.forEach((p, i) => {
    const gap = gapByIndex[i]
    if (gap != null) totalTimeMs += gap
    if (!p.isValidCount || p.stricken) {
      totalMistakes++
      return
    }
    totalValidCounts++
    counterCounts.set(p.authorUUID, (counterCounts.get(p.authorUUID) ?? 0) + 1)
    if (gap != null) validGaps.push(gap)
  })

  const medianPaceMs = median(validGaps)

  const THRESHOLD = 1.5
  const RECOVERY_STABLE = 3

  type CountEvent = { valid: boolean; gap: number | null }
  const events: CountEvent[] = counts.map((p, i) => ({
    valid: p.isValidCount && !p.stricken,
    gap: gapByIndex[i],
  }))

  let timeLostToMistakesMs = 0
  let i = 0
  while (i < events.length) {
    const ev = events[i]
    if (ev.valid) { i++; continue }

    if (ev.gap != null && ev.gap > medianPaceMs) {
      timeLostToMistakesMs += ev.gap - medianPaceMs
    }

    i++
    let stableStreak = 0
    while (i < events.length) {
      const rec = events[i]
      const gap = rec.gap ?? medianPaceMs

      if (!rec.valid) {
        stableStreak = 0
        timeLostToMistakesMs += Math.max(0, gap - medianPaceMs)
        i++
        continue
      }

      if (gap > medianPaceMs * THRESHOLD) {
        timeLostToMistakesMs += gap - medianPaceMs
        stableStreak = 0
      } else {
        stableStreak++
      }

      i++
      if (stableStreak >= RECOVERY_STABLE) break
    }
  }

  const cleanTimeMs = Math.max(0, totalTimeMs - timeLostToMistakesMs)

  const validPosts = posts.filter(p => p.isCount && p.isValidCount && !p.stricken)
  const firstVCN = validPosts[0]?.validCountNumber
  const lastVCN = validPosts[validPosts.length - 1]?.validCountNumber
  let replayType: 'get' | 'split' | 'range' = 'range'
  if (lastVCN != null && lastVCN % getSize === 0) replayType = 'get'
  else if (lastVCN != null && lastVCN % countsPerSplit === 0) replayType = 'split'
  else if (firstVCN != null && firstVCN % getSize === 0) replayType = 'get'
  else if (firstVCN != null && firstVCN % countsPerSplit === 0) replayType = 'split'

  const splitCount = totalValidCounts > 0 ? totalValidCounts / countsPerSplit : 1
  const getCount = totalValidCounts > 0 ? totalValidCounts / getSize : 1

  return {
    replayType,
    getSize,
    splitSize: countsPerSplit,
    totalValidCounts,
    totalMistakes,
    mistakesPerSplit: totalMistakes / Math.max(splitCount, 1),
    mistakesPerGet: totalMistakes / Math.max(getCount, 1),
    totalTimeMs,
    medianPaceMs,
    timeLostToMistakesMs,
    cleanTimeMs,
    counterCounts,
  }
}

type Annotation = { index: number; type: 'get' | 'split' | 'mistake'; label: string }

function buildAnnotations(posts: ReplayPost[], countsPerSplit: number, splitsPerGet: number): Annotation[] {
  const getSize = countsPerSplit * splitsPerGet
  const out: Annotation[] = []
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i]
    if (!p.isCount) continue
    if (!p.isValidCount || p.stricken) {
      out.push({ index: i, type: 'mistake', label: '✗' })
    } else if (p.validCountNumber != null) {
      if (p.validCountNumber % getSize === 0) {
        out.push({ index: i, type: 'get', label: `${p.validCountNumber.toLocaleString()} GET` })
      } else if (p.validCountNumber % countsPerSplit === 0) {
        out.push({ index: i, type: 'split', label: `${p.validCountNumber.toLocaleString()} split` })
      }
    }
  }
  return out
}

const DOT_LIMIT = 400

function PaceGraph({ posts, currentIndex, annotations, onSeek, onDragSeek, anchorTimestamp }: {
  posts: ReplayPost[]
  anchorTimestamp?: string | null
  currentIndex: number
  annotations: Annotation[]
  onSeek: (index: number) => void
  onDragSeek: (index: number) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const draggingRef = useRef(false)
  const rectRef = useRef<DOMRect | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const displayIdx = dragIdx ?? currentIndex

  const W = 800; const H = 308
  const LANE = { top: 26, h: 40 }
  const PAD = { top: 86, right: 10, bottom: 30, left: 48 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const gaps = useMemo(() => {
    const countIdx: number[] = []
    for (let i = 0; i < posts.length; i++) if (posts[i].isCount) countIdx.push(i)
    const g = gapsForCounts(countIdx.map(i => posts[i]), anchorTimestamp)
    const out = new Array<number | null>(posts.length).fill(null)
    countIdx.forEach((postI, k) => { out[postI] = g[k] })
    return out
  }, [posts, anchorTimestamp])

  const { yMax, capMs } = useMemo(() => {
    const vals = gaps.filter((t): t is number => t != null && t > 0).sort((a, b) => a - b)
    if (!vals.length) return { yMax: scaleY(400), capMs: 400 }
    const p98 = vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.98))]
    const cap = Math.max(400, Math.min(5000, p98))
    return { yMax: scaleY(cap), capMs: cap }
  }, [gaps])
  const visibleTicks = useMemo(() => {
    const MIN_GAP = 16
    const CEIL_GAP = 15
    const out: { ms: number; y: number }[] = []
    let lastY = Infinity
    for (const ms of Y_TICKS) {
      const sy = scaleY(ms)
      if (sy >= yMax) break
      const y = PAD.top + innerH - (sy / yMax) * innerH
      if (lastY - y < MIN_GAP) continue
      if (y - PAD.top < CEIL_GAP) continue
      out.push({ ms, y })
      lastY = y
    }
    return out
  }, [yMax, innerH])

  const yOf = useCallback((ms: number) =>
    PAD.top + innerH - (scaleY(Math.min(ms, capMs)) / yMax) * innerH,
    [yMax, capMs])

  const counterColors = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of posts) if (!map.has(p.authorUUID)) map.set(p.authorUUID, p.authorColor || '#888')
    return map
  }, [posts])

  const xOf = useCallback((postIdx: number) =>
    PAD.left + (posts.length <= 1 ? 0 : postIdx / (posts.length - 1)) * innerW,
    [posts.length])

  const seriesPaths = useMemo(() => {
    const map = new Map<string, { color: string; d: string }>()
    posts.forEach((p, i) => {
      if (!p.isCount || !p.isValidCount || p.stricken) return
      const t = gaps[i]
      if (t == null || t <= 0) return
      const pt = `${xOf(i).toFixed(1)},${yOf(t).toFixed(1)}`
      const existing = map.get(p.authorUUID)
      if (existing) existing.d += ` L${pt}`
      else map.set(p.authorUUID, { color: counterColors.get(p.authorUUID) || '#888', d: `M${pt}` })
    })
    return Array.from(map.values())
  }, [posts, gaps, xOf, yOf, counterColors])

  const seriesDots = useMemo(() => {
    if (posts.length > DOT_LIMIT) return []
    return posts.flatMap((p, i) => {
      if (!p.isCount || !p.isValidCount || p.stricken) return []
      const t = gaps[i]
      if (t == null || t <= 0) return []
      return [{ x: xOf(i), y: yOf(t), color: counterColors.get(p.authorUUID) || '#888' }]
    })
  }, [posts, gaps, xOf, yOf, counterColors])

  const splitSegments = useMemo(() => {
    const bounds = annotations
      .filter(a => a.type !== 'mistake')
      .map(a => ({ index: a.index, isGet: a.type === 'get' }))
      .sort((a, b) => a.index - b.index)
    if (!bounds.length) return []

    const segs: {
      k: number; startIdx: number; endIdx: number
      durationMs: number; counts: number; pace: number; isGet: boolean
    }[] = []

    let from = 0
    bounds.forEach((b, k) => {
      let durationMs = 0
      let n = 0
      for (let i = from; i <= b.index && i < posts.length; i++) {
        const g = gaps[i]
        if (g != null) durationMs += g
        const p = posts[i]
        if (p?.isCount && p.isValidCount && !p.stricken) n++
      }
      if (n > 0) {
        segs.push({ k, startIdx: from, endIdx: b.index, durationMs, counts: n, pace: durationMs / n, isGet: b.isGet })
      }
      from = b.index + 1
    })
    return segs
  }, [annotations, gaps, posts])

  const splitBaseline = useMemo(
    () => median(splitSegments.map(s => s.pace)),
    [splitSegments])

  const medianSplitMs = useMemo(
    () => median(splitSegments.map(s => s.durationMs)),
    [splitSegments])

  const paceColor = useCallback((pace: number): string => {
    if (splitBaseline <= 0) return '#ffd54f'
    const rel = pace / splitBaseline
    if (rel <= 0.94) return '#5ddc72'
    if (rel >= 1.06) return '#ff8a65'
    return '#ffd54f'
  }, [splitBaseline])

  const laneScale = useMemo(() => {
    const ps = splitSegments.map(s => s.pace).filter(p => p > 0)
    if (!ps.length) return null
    const lo = Math.min(...ps)
    const hi = Math.max(...ps)
    const spread = Math.max(hi - lo, lo * 0.08)
    const mid = (lo + hi) / 2
    return { lo: mid - spread * 0.72, hi: mid + spread * 0.72 }
  }, [splitSegments])

  const laneY = useCallback((pace: number): number => {
    if (!laneScale || laneScale.hi <= laneScale.lo) return LANE.top + LANE.h / 2
    const t = (pace - laneScale.lo) / (laneScale.hi - laneScale.lo)
    return LANE.top + LANE.h - Math.max(0, Math.min(1, t)) * LANE.h
  }, [laneScale])

  const mistakeTicks = useMemo(() =>
    posts.flatMap((p, i) => (!p.isCount || (p.isValidCount && !p.stricken)) ? [] : [xOf(i)]),
    [posts, xOf])

  const annMarks = useMemo(() =>
    annotations
      .filter(a => a.type !== 'mistake')
      .map(a => ({ x: xOf(a.index), type: a.type, label: a.label })),
    [annotations, xOf])

  const cursorPct = posts.length <= 1 ? 0 : displayIdx / (posts.length - 1)
  const cursorX = PAD.left + cursorPct * innerW

  const clientToPlotRatio = useCallback((clientX: number): number => {
    const rect = rectRef.current
    if (!rect || rect.width === 0) return 0
    const svgX = ((clientX - rect.left) / rect.width) * W
    return Math.max(0, Math.min(1, (svgX - PAD.left) / innerW))
  }, [])

  const pxToIdx = useCallback((clientX: number): number => {
    if (!rectRef.current) return displayIdx
    const ratio = clientToPlotRatio(clientX)
    return Math.max(0, Math.min(posts.length - 1, Math.round(ratio * (posts.length - 1))))
  }, [posts.length, displayIdx, clientToPlotRatio])

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    rectRef.current = e.currentTarget.getBoundingClientRect()
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = true
    setIsDragging(true)
    const idx = pxToIdx(e.clientX)
    setDragIdx(idx)
    onDragSeek(idx)
  }, [pxToIdx, onDragSeek])

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!rectRef.current) rectRef.current = e.currentTarget.getBoundingClientRect()
    const idx = pxToIdx(e.clientX)
    setHoverIdx(idx)
    if (draggingRef.current) {
      setDragIdx(idx)
      onDragSeek(idx)
    }
  }, [pxToIdx, onDragSeek])

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setIsDragging(false)
    const idx = pxToIdx(e.clientX)
    setDragIdx(null)
    onSeek(idx)
  }, [pxToIdx, onSeek])

  const handlePointerEnter = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    rectRef.current = e.currentTarget.getBoundingClientRect()
  }, [])

  const handlePointerLeave = useCallback(() => {
    if (draggingRef.current) return
    setHoverIdx(null)
  }, [])


  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', display: 'block', cursor: isDragging ? 'ew-resize' : 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        {visibleTicks.map(({ ms, y }) => {
          return (
            <g key={ms}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="rgb(var(--ink-rgb) / 0.05)" strokeWidth={1} />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={12} fill="rgb(var(--ink-rgb) / 0.4)">
                {ms >= 1000 ? `${ms / 1000}s` : `${ms}`}
              </text>
            </g>
          )
        })}

        {splitSegments.map(s => s.k % 2 === 1 ? (
          <rect key={`band-${s.k}`}
                x={xOf(s.startIdx)} y={LANE.top}
                width={Math.max(0, xOf(s.endIdx) - xOf(s.startIdx))}
                height={(H - PAD.bottom) - LANE.top}
                fill="rgb(var(--ink-rgb) / 0.03)" />
        ) : null)}

        {splitSegments.length > 0 && (
          <>
            <line x1={PAD.left} x2={W - PAD.right} y1={laneY(splitBaseline)} y2={laneY(splitBaseline)}
                  stroke="rgb(var(--ink-rgb) / 0.22)" strokeWidth={1} strokeDasharray="4,4" />
            <text x={PAD.left - 6} y={laneY(splitBaseline) + 4} textAnchor="end"
                  fontSize={11} fill="rgb(var(--ink-rgb) / 0.4)">
              {formatClock(medianSplitMs)}
            </text>

            {splitSegments.map(s => {
              const x1 = xOf(s.startIdx)
              const x2 = xOf(s.endIdx)
              const y = laneY(s.pace)
              const base = laneY(splitBaseline)
              const color = paceColor(s.pace)
              return (
                <g key={`rung-${s.k}`}>
                  <rect x={x1} y={Math.min(y, base)} width={Math.max(0, x2 - x1)}
                        height={Math.abs(y - base)} fill={color} opacity={0.22} />
                  <line x1={x1} x2={x2} y1={y} y2={y} stroke={color} strokeWidth={2.6} />
                </g>
              )
            })}

            {splitSegments.map(s => {
              const x1 = xOf(s.startIdx)
              const x2 = xOf(s.endIdx)
              if (x2 - x1 < 56) return null
              const y = laneY(s.pace)
              const above = y > LANE.top + 13
              return (
                <text key={`rung-label-${s.k}`} x={(x1 + x2) / 2} y={above ? y - 5 : y + 12}
                      textAnchor="middle" fontSize={11} fontWeight={700} fill={paceColor(s.pace)}
                      stroke="rgb(var(--shadow-rgb) / 0.8)" strokeWidth={2.6} paintOrder="stroke">
                  {formatClock(s.durationMs)}
                </text>
              )
            })}
          </>
        )}

        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top} y2={PAD.top}
              stroke="rgb(var(--ink-rgb) / 0.14)" strokeWidth={1} strokeDasharray="2,3" />
        <text x={PAD.left - 6} y={PAD.top + 4} textAnchor="end" fontSize={12} fill="rgb(var(--ink-rgb) / 0.4)">
          {capMs >= 1000 ? `${(capMs / 1000).toFixed(1)}s+` : `${Math.round(capMs)}+`}
        </text>

        {mistakeTicks.map((x, i) => (
          <line key={i} x1={x} x2={x} y1={H - PAD.bottom - 6} y2={H - PAD.bottom}
                stroke="var(--danger)" strokeWidth={1} opacity={0.6} />
        ))}

        {annMarks.map(({ x, type, label }) => {
          const color = type === 'get' ? 'var(--gold)' : 'var(--primary)'
          return (
            <g key={`${x}-${type}-${label}`}>
              <line x1={x} x2={x} y1={PAD.top} y2={H - PAD.bottom}
                    stroke={color} strokeWidth={1} strokeDasharray="3,3" opacity={0.3} />
            </g>
          )
        })}

        <rect x={PAD.left} y={PAD.top} width={cursorPct * innerW} height={innerH} fill="rgba(76,175,80,0.06)" />

        {seriesPaths.map(({ color, d }, i) => (
          <path key={i} d={d} fill="none" stroke={color} strokeWidth={1.2}
                strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
        ))}

        {seriesDots.map((pt, i) => (
          <circle key={i} cx={pt.x.toFixed(1)} cy={pt.y.toFixed(1)} r={1.6} fill={pt.color} opacity={0.85} />
        ))}

        <line x1={cursorX} x2={cursorX} y1={PAD.top} y2={H - PAD.bottom} stroke="rgb(var(--ink-rgb) / 0.55)" strokeWidth={1.5} />
        <circle cx={cursorX} cy={H - PAD.bottom} r={5} fill="#fff" stroke="rgb(var(--shadow-rgb) / 0.4)" strokeWidth={1} />

        {([
          { id: 'start', pct: 0, p: posts[0], anchor: 'start' as const },
          { id: 'cursor', pct: cursorPct, p: posts[displayIdx], anchor: 'middle' as const },
          { id: 'end', pct: 1, p: posts[posts.length - 1], anchor: 'end' as const },
        ]).map(({ id, pct, p, anchor }) => {
          const label = p?.validCountNumber?.toLocaleString()
          if (!label) return null
          const x = PAD.left + pct * innerW
          return <text key={id} x={x} y={H - 8} textAnchor={anchor} fontSize={13} fill="rgb(var(--ink-rgb) / 0.45)">#{label}</text>
        })}

        {hoverIdx != null && (
          <text x={xOf(hoverIdx)} y={16} textAnchor="middle" fontSize={13} fontWeight={600} fill="rgb(var(--ink-rgb) / 0.75)">
            #{posts[hoverIdx]?.validCountNumber?.toLocaleString()}
          </text>
        )}
      </svg>
    </div>
  )
}

function PacePanel({ pace }: { pace: PaceStats }) {
  const isSplit = pace.replayType === 'split'
  const isGet = pace.replayType === 'get'
  const mistakeRate = isGet
    ? pace.mistakesPerGet
    : isSplit
    ? pace.mistakesPerSplit
    : pace.totalMistakes > 0 ? pace.totalMistakes : 0
  const mistakeRateLabel = isGet ? `/ get` : isSplit ? `/ split` : `total`
  const lostPct = pace.totalTimeMs > 0
    ? ((pace.timeLostToMistakesMs / pace.totalTimeMs) * 100).toFixed(1)
    : '0.0'

  const statCell = (label: string, value: string, sub?: string, accent?: string) => (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 3,
      padding: '10px 14px',
      background: 'rgb(var(--ink-rgb) / 0.03)',
      border: '1px solid rgb(var(--ink-rgb) / 0.06)',
    }}>
      <span style={{ fontSize: '0.6rem', letterSpacing: '0.25em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: accent ?? 'var(--ink-1)', fontFamily: 'monospace', lineHeight: 1 }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: '0.65rem', color: 'var(--ink-3)' }}>{sub}</span>}
    </div>
  )

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: '0.65rem', letterSpacing: '0.25em', color: 'var(--ink-3)', marginBottom: 8, textTransform: 'uppercase' }}>
        Pace Analysis
        {pace.replayType !== 'range' && (
          <span style={{ marginLeft: 8, color: pace.replayType === 'get' ? 'var(--gold)' : 'var(--primary)', letterSpacing: '0.15em' }}>
            · {pace.replayType.toUpperCase()} ({pace.replayType === 'get' ? pace.getSize : pace.splitSize} counts)
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 3 }}>
        {statCell('Median pace', pace.medianPaceMs > 0 ? formatDuration(pace.medianPaceMs) : '-', 'per count')}
        {statCell('Actual time', pace.totalTimeMs > 0 ? formatDuration(pace.totalTimeMs) : '-')}
        {statCell('Pace', pace.cleanTimeMs > 0 ? formatDuration(pace.cleanTimeMs) : '-', 'without mistakes', 'var(--success-ink)')}
        {statCell('Time lost', pace.timeLostToMistakesMs > 0 ? formatDuration(pace.timeLostToMistakesMs) : '-', `${lostPct}% of run`, 'var(--brand-ink)')}
        {statCell('Mistakes', String(pace.totalMistakes), mistakeRateLabel === 'total' ? undefined : `${mistakeRate.toFixed(2)} ${mistakeRateLabel}`, pace.totalMistakes > 0 ? 'var(--danger)' : undefined)}
      </div>
    </div>
  )
}

export default function ReplayClient({ threadName, threadTitle, validationType, posts, startNum, endNum, error, countsPerSplit, splitsPerGet, truncated, anchorTimestamp }: Props) {
  setRowThreadName(threadName, false, validationType)
  setRowInteractive(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  const rafRef = useRef<number | null>(null)
  const lastTickRef = useRef<number>(0)
  const accumulatedRef = useRef<number>(0)

  const annotations = useMemo(
    () => buildAnnotations(posts, countsPerSplit, splitsPerGet),
    [posts, countsPerSplit, splitsPerGet]
  )

  const pace = useMemo(
    () => computePaceStats(posts, countsPerSplit, splitsPerGet, anchorTimestamp),
    [posts, countsPerSplit, splitsPerGet]
  )

  const playheadRef = useRef(0)

  const resumeAfterDragRef = useRef(false)
  const isDraggingRef = useRef(false)

  const stop = useCallback(() => {
    setPlaying(false)
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
  }, [])

  const applySeek = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(posts.length - 1, idx))
    playheadRef.current = clamped
    setCurrentIndex(clamped)
    accumulatedRef.current = 0
  }, [posts.length])

  const seek = applySeek

  const dragSeek = useCallback((idx: number) => {
    if (!isDraggingRef.current) {
      isDraggingRef.current = true
      resumeAfterDragRef.current = playing
    }
    if (playing) stop()
    applySeek(idx)
  }, [applySeek, playing, stop])

  const commitSeek = useCallback((idx: number) => {
    isDraggingRef.current = false
    applySeek(idx)
    if (resumeAfterDragRef.current) {
      resumeAfterDragRef.current = false
      setPlaying(true)
    }
  }, [applySeek])


  useEffect(() => {
    if (!playing || posts.length === 0) return
    playheadRef.current = currentIndex
    const tick = (now: number) => {
      if (lastTickRef.current === 0) lastTickRef.current = now
      const elapsed = (now - lastTickRef.current) * speed
      lastTickRef.current = now
      accumulatedRef.current += elapsed

      const nextPost = posts[playheadRef.current + 1]
      const interval = nextPost?.timeSinceLastCount ?? nextPost?.timeSinceLastPost ?? 500
      const clampedInterval = Math.min(Math.max(interval, 100), 10000)

      if (accumulatedRef.current >= clampedInterval) {
        accumulatedRef.current -= clampedInterval
        playheadRef.current += 1
        setCurrentIndex(playheadRef.current)
        if (playheadRef.current >= posts.length - 1) { stop(); return }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    lastTickRef.current = 0
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); lastTickRef.current = 0 }
  }, [playing, speed, posts, stop]) // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = () => {
    if (playing) { stop() }
    else { if (currentIndex >= posts.length - 1) setCurrentIndex(0); setPlaying(true) }
  }

  const recentPosts: PostRow[] = useMemo(() => {
    const slice = posts.slice(Math.max(0, currentIndex - 9), currentIndex + 1)
    return slice.map(p => ({
      uuid: p.uuid,
      countContent: p.countContent,
      rawCount: p.rawCount != null ? String(p.rawCount) : undefined,
      rawText: p.rawText,
      comment: p.comment,
      isValidCount: p.isValidCount && !p.stricken,
      stricken: p.stricken,
      timestamp: p.timestamp,
      timeSinceLastPost: p.timeSinceLastCount ?? p.timeSinceLastPost,
      authorUUID: p.authorUUID,
      authorUsername: p.authorUsername,
      authorName: p.authorName,
      authorColor: p.authorColor,
      authorAvatarUrl: p.authorAvatarUrl,
    })).reverse()
  }, [posts, currentIndex])

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px', color: 'var(--ink-1)' }}>
      <style>{`
        @keyframes rl-blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .replay-playing { animation: rl-blink 1s ease infinite }
        .replay-post-list > li:not(:last-child) { border-bottom: 1px solid rgb(var(--ink-rgb) / 0.04) }
        .replay-post-list > li:not(:first-child) { opacity: 0.6 }
      `}</style>

      <div style={{ marginBottom: 20 }}>
        <a href={`/thread/${threadName}`} style={{ fontSize: '0.8rem', color: 'var(--ink-3)', textDecoration: 'none' }}>
          ← {threadTitle}
        </a>
        <h1 style={{ margin: '4px 0 2px', fontSize: '1.4rem', fontWeight: 700 }}>Replay</h1>
        <div style={{ fontSize: '0.8rem', color: 'var(--ink-3)' }}>
          {startNum != null && <>Counts #{startNum.toLocaleString()}{endNum != null ? ` – #${endNum.toLocaleString()}` : '+'}</>}
          {' · '}{posts.length.toLocaleString()} posts loaded
        </div>
      </div>

      {error && (
        <div style={{ padding: 16, background: 'rgba(244,67,54,0.15)', borderRadius: 8, color: 'var(--danger)', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {truncated && (
        <div style={{
          padding: '12px 16px', marginBottom: 20, borderRadius: 8,
          background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.45)',
          color: 'var(--warn)', fontSize: 14, lineHeight: 1.5,
        }}>
          <strong>Partial replay.</strong> This range is longer than we can load at once, so
          playback stops early and the timings below cover only the counts shown: not the
          full range you asked for. Try a smaller range for accurate stats.
        </div>
      )}

      {posts.length === 0 && !error && (
        <div style={{ padding: 16, color: 'var(--ink-3)' }}>
          No posts to replay.{' '}
          <a href={`/replay/${threadName}?start=1`} style={{ color: 'var(--success-ink)' }}>Start from count #1</a>
        </div>
      )}

      {posts.length > 0 && (
        <>
          {pace.totalValidCounts > 0 && <PacePanel pace={pace} />}

          <div style={{
            background: 'rgb(var(--ink-rgb) / 0.04)',
            border: '1px solid rgb(var(--ink-rgb) / 0.08)',
            borderRadius: 8, padding: '8px 14px', marginBottom: 12,
          }}>
            <PaceGraph posts={posts} currentIndex={currentIndex} annotations={annotations} onSeek={commitSeek} onDragSeek={dragSeek} anchorTimestamp={anchorTimestamp} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <button onClick={() => seek(0)} title="Go to start" style={btnStyle}>⏮</button>
            <button onClick={() => seek(currentIndex - 1)} disabled={currentIndex === 0}
              style={{ ...btnStyle, opacity: currentIndex === 0 ? 0.4 : 1 }}>◀</button>
            <button onClick={togglePlay}
              style={{ ...btnStyle, minWidth: 64, background: playing ? 'rgba(76,175,80,0.2)' : 'rgb(var(--ink-rgb) / 0.08)' }}>
              {playing ? <span className="replay-playing">⏸</span> : currentIndex >= posts.length - 1 ? '↺' : '▶'}
            </button>
            <button onClick={() => seek(currentIndex + 1)} disabled={currentIndex >= posts.length - 1}
              style={{ ...btnStyle, opacity: currentIndex >= posts.length - 1 ? 0.4 : 1 }}>▶</button>
            <button onClick={() => seek(posts.length - 1)} title="Go to end" style={btnStyle}>⏭</button>
            <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
              {PLAYBACK_SPEEDS.map((s) => (
                <button key={s} onClick={() => setSpeed(s)} style={{
                  ...btnStyle, padding: '4px 8px', fontSize: '0.75rem',
                  background: speed === s ? 'rgba(76,175,80,0.3)' : 'rgb(var(--ink-rgb) / 0.06)',
                  color: speed === s ? 'var(--success-ink)' : 'var(--ink-3)',
                  border: speed === s ? '1px solid rgba(76,175,80,0.4)' : '1px solid rgb(var(--ink-rgb) / 0.1)',
                }}>
                  {s}×
                </button>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--ink-3)' }}>
              {currentIndex + 1} / {posts.length}
            </div>
          </div>

          {annotations.length > 0 && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: '0.7rem', color: 'var(--ink-3)' }}>
              <span><span style={{ color: 'var(--gold)' }}>●</span> GET</span>
              <span><span style={{ color: 'var(--primary)' }}>●</span> split</span>
              <span><span style={{ color: 'var(--danger)' }}>●</span> mistake</span>
            </div>
          )}

          <ul
            className="replay-post-list"
            style={{ listStyle: 'none', margin: 0, padding: 0, border: '1px solid rgb(var(--ink-rgb) / 0.08)', borderRadius: 8, overflow: 'hidden' }}
            dangerouslySetInnerHTML={{
              __html: recentPosts.map(post => buildRowHTML(post, REPLAY_RENDER_PREFS)).join(''),
            }}
          />
        </>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  background: 'rgb(var(--ink-rgb) / 0.08)',
  border: '1px solid rgb(var(--ink-rgb) / 0.12)',
  borderRadius: 6, color: 'var(--ink-2)', cursor: 'pointer',
  fontSize: '0.9rem', padding: '6px 12px', lineHeight: 1,
}

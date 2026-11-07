'use client'

import { getSocket } from './socket'

export type PaceTarget = 'split' | 'get' | 'counts'

export interface PaceState {
  delta: number | null
  refMsPerCount: number | null
  nextTarget: number | null
  nextTargetDisplay: number | null
  etaMs: number | null
  splitSize: number
  gaps: number[]
  targetSplitMs: number | null
  countdownMs: number | null
  running: boolean
  segmentStartSeen: boolean
}

let countsPerSplit = 100
let splitsPerGet = 10
let splitOffset = 0

let customCounts = 100

export function setPaceCounts(n: number) {
  customCounts = Number.isFinite(n) && n > 0 ? Math.floor(n) : 100
  emit()
}
export function getPaceCounts() { return customCounts }

export function setSplitConfig(counts: number, perGet: number, offset = 0) {
  countsPerSplit = Number.isFinite(counts) && counts > 0 ? counts : 100
  splitsPerGet = Number.isFinite(perGet) && perGet > 0 ? perGet : 10
  splitOffset = Number.isFinite(offset) ? offset : 0
  emit()
}

function segSizeOf(): number {
  if (target === 'get') return countsPerSplit * splitsPerGet
  if (target === 'counts') return customCounts
  return countsPerSplit
}

function boundaryAtOrBelow(n: number, size: number): number {
  return Math.floor((n - splitOffset) / size) * size + splitOffset
}

let splits: { number: string; split: number }[] = []
let live: { count: number; at: number } | null = null
let recent: { count: number; at: number; sinceLast?: number }[] = []
const RECENT_MAX = 4000
let target: PaceTarget = 'split'

let running = false
let targetSplitMs: number | null = null

let listeners: ((s: PaceState) => void)[] = []
let attached = false
let ticker: ReturnType<typeof setInterval> | null = null

function gapsOf(): number[] {
  const out: number[] = []
  for (let i = 1; i < recent.length; i++) {
    const server = recent[i].sinceLast
    const d = Number.isFinite(server) && (server as number) > 0
      ? (server as number)
      : recent[i].at - recent[i - 1].at
    if (Number.isFinite(d) && d > 0) out.push(d)
  }
  return out
}

export function readPace(): PaceState {
  const splitSize = countsPerSplit
  const gaps = gapsOf()

  const idle: PaceState = {
    delta: null, refMsPerCount: null, nextTarget: null, etaMs: null,
    splitSize, gaps, countdownMs: null, targetSplitMs, running,
    segmentStartSeen: false, nextTargetDisplay: null,
  }

  if (!running || !live || targetSplitMs == null || targetSplitMs <= 0) return idle
  const refMsPerCount = targetSplitMs / segSizeOf()

  const segSize = segSizeOf()
  const segmentStart = boundaryAtOrBelow(live.count, segSize)
  const nextTarget = segmentStart + segSize

  const startRow = countAt(segmentStart)
  if (!startRow) return { ...idle, refMsPerCount, nextTarget, nextTargetDisplay: displayedFor(nextTarget) }

  const elapsed = Date.now() - startRow
  const done = live.count - segmentStart
  const delta = done - elapsed / refMsPerCount

  const deadlineAt = startRow + segSize * refMsPerCount

  return {
    delta,
    refMsPerCount,
    nextTarget,
    etaMs: (nextTarget - live.count) * refMsPerCount,
    splitSize,
    gaps,
    countdownMs: deadlineAt - Date.now(),
    targetSplitMs,
    running,
    segmentStartSeen: true,
    nextTargetDisplay: displayedFor(nextTarget),
  }
}

let displayPoints: { n: number; d: number }[] = []

function noteDisplayed(n: number, text: string | undefined) {
  const d = Number(String(text ?? '').replace(/[^0-9-]/g, ''))
  if (!Number.isFinite(d)) return
  if (displayPoints.length && displayPoints[displayPoints.length - 1].n === n) return
  displayPoints = [...displayPoints, { n, d }].slice(-2)
}

function displayedFor(n: number): number | null {
  if (displayPoints.length < 2) return null
  const [a, b] = displayPoints
  const span = b.n - a.n
  if (!span) return null
  const step = (b.d - a.d) / span
  if (!Number.isFinite(step) || step <= 0) return null
  return b.d + (n - b.n) * step
}

function countAt(count: number): number | null {
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].count === count) return recent[i].at
  }
  return null
}

function emit() {
  const state = readPace()
  listeners.forEach(l => l(state))
}

function attach() {
  if (attached) return
  attached = true
  const socket = getSocket()

  socket.on('post', (data: { post?: { isValidCount?: boolean; stricken?: boolean; validCountNumber?: number | string; timestamp?: string; rawCount?: string; countContent?: string; rawText?: string; timeSinceLastCount?: number | string } }) => {
    const p = data?.post
    if (!p?.isValidCount || p.stricken) return
    const n = Number(p.validCountNumber)
    if (!Number.isFinite(n)) return
    const at = Number(p.timestamp) || Date.now()
    noteDisplayed(n, p.rawCount ?? p.countContent ?? p.rawText)
    live = { count: n, at }
    const sinceLast = Number(p.timeSinceLastCount)
    recent.push({ count: n, at, sinceLast: Number.isFinite(sinceLast) && sinceLast > 0 ? sinceLast : undefined })
    if (recent.length > RECENT_MAX) recent = recent.slice(-RECENT_MAX)
    emit()
  })

  socket.on('split', (data: { number?: string; split?: number }) => {
    if (data?.number != null && data?.split != null) {
      splits = [{ number: String(data.number), split: data.split }, ...splits].slice(0, 55)
    }
    emit()
  })

  socket.on('recent_splits', (rows: { number: string; split: number }[]) => {
    if (!Array.isArray(rows) || !rows.length) return
    const seen = new Set(splits.map(s => `${s.number}|${s.split}`))
    splits = [...splits, ...rows.filter(s => !seen.has(`${s.number}|${s.split}`))].slice(0, 55)
    emit()
  })

  ticker = setInterval(emit, 250)
}

export function paceDeltaAt(count: number, at: number): number | null {
  if (!running || targetSplitMs == null || targetSplitMs <= 0) return null

  const refMsPerCount = targetSplitMs / segSizeOf()
  if (!refMsPerCount) return null

  const segSize = segSizeOf()
  const segmentStart = boundaryAtOrBelow(count, segSize)

  if (count === segmentStart) {
    const prevStart = segmentStart - segSize
    const prevStartAt = countAt(prevStart)
    if (prevStartAt == null) return null
    return segSize - (at - prevStartAt) / refMsPerCount
  }
  if (count < segmentStart) return null

  const startAt = countAt(segmentStart)
  if (startAt == null) return null

  return (count - segmentStart) - (at - startAt) / refMsPerCount
}

export function ensurePaceClock(): void {
  attach()
}

export function subscribePace(cb: (s: PaceState) => void): () => void {
  attach()
  listeners.push(cb)
  cb(readPace())
  return () => {
    listeners = listeners.filter(l => l !== cb)
    if (listeners.length === 0 && ticker) {
      clearInterval(ticker)
      ticker = null
      attached = false
    }
  }
}

export function seedPaceCounts(
  rows: {
    validCountNumber?: number | string
    timestamp?: string
    timeSinceLastCount?: number | string
    rawCount?: string
    countContent?: string
    rawText?: string
  }[],
) {
  if (!rows?.length) return
  const seen = new Set(recent.map(r => r.count))
  let added = false
  for (const r of rows) {
    const n = Number(r.validCountNumber)
    const at = Number(r.timestamp)
    if (!Number.isFinite(n) || !Number.isFinite(at) || seen.has(n)) continue
    const sinceLast = Number(r.timeSinceLastCount)
    recent.push({ count: n, at, sinceLast: Number.isFinite(sinceLast) && sinceLast > 0 ? sinceLast : undefined })
    seen.add(n)
    noteDisplayed(n, r.rawCount ?? r.countContent ?? r.rawText)
    added = true
  }
  if (!added) return
  recent.sort((a, b) => a.count - b.count)
  if (recent.length > RECENT_MAX) recent = recent.slice(-RECENT_MAX)
  if (!live || recent[recent.length - 1].count > live.count) {
    const last = recent[recent.length - 1]
    live = { count: last.count, at: last.at }
  }
  emit()
}

export function seedPaceSplits(rows: { number: string; split: number }[]) {
  if (!rows?.length) return
  const seen = new Set(splits.map(s => `${s.number}|${s.split}`))
  splits = [...splits, ...rows.filter(s => !seen.has(`${s.number}|${s.split}`))].slice(0, 55)
  emit()
}

export function setTargetSplitMs(v: number | null) {
  targetSplitMs = v != null && v > 0 ? v : null
  emit()
}
export function getTargetSplitMs() { return targetSplitMs }
export function setPaceTarget(v: PaceTarget) { target = v; emit() }
export function getPaceTarget() { return target }

export function setPaceRunning(v: boolean) { running = v; emit() }
export function getPaceRunning() { return running }

export function formatDelta(delta: number | null): string | null {
  if (delta == null || !Number.isFinite(delta)) return null
  const v = Number(delta.toFixed(1))
  if (v === 0) return '±0'
  return v > 0 ? `+${v.toFixed(1)}` : `−${Math.abs(v).toFixed(1)}`
}

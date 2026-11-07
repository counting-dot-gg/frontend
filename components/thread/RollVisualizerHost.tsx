'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'

type RollSample = {
  id: string
  roll: number
  chance: number
  authorColor?: string
}

const ROLL_THREADS = new Set(['1inx', 'russian_roulette', 'incremental_odds'])

const RENDER_WINDOW = 120

type LuckStats = {
  prob: number
  count: number
  lastProb: number | null
  lastCount: number
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const safeProbability = (v: number) => (!Number.isFinite(v) || v <= 0 ? 0 : v)

function formatProbability(value: number) {
  const p = safeProbability(value)
  if (p <= 0) return '0'
  if (p >= 0.9999) return p.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
  if (p >= 0.99)   return p.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
  if (p >= 0.1)    return p.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  if (p >= 0.001)  return p.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
  return p.toExponential(3)
}

function formatOdds(probability: number): string {
  const p = safeProbability(probability)
  if (p <= 0) return '?'
  if (p >= 1) return '1 in 1'
  if (p > 0.5) {
    const num = Math.max(1, Math.round(p / (1 - p)))
    return `${num.toLocaleString()} in ${(num + 1).toLocaleString()}`
  }
  const oneIn = 1 / p
  if (!Number.isFinite(oneIn)) return '?'
  return `1 in ${Math.max(1, Math.round(oneIn)).toLocaleString()}`
}

function formatThreshold(v: number) {
  if (v >= 1) return '1'
  if (v >= 0.1) return v.toFixed(1)
  if (v >= 0.01) return v.toFixed(2)
  if (v >= 0.001) return v.toFixed(3)
  return v.toExponential(0)
}

function positionByLogProbability(probability: number, minDecade: number) {
  const p = safeProbability(probability)
  if (p >= 1) return 1
  if (p <= 0) return 0
  const min = Math.min(-1, minDecade)
  return clamp01((Math.log10(p) - min) / (0 - min))
}

function getStableBand(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return (hash % 9) - 4
}

interface VisualizerProps {
  rolls: RollSample[]
  luck: LuckStats
  maxRenderedRolls?: number
}

const RollVisualizer = memo(function RollVisualizer({ rolls, luck, maxRenderedRolls = 100 }: VisualizerProps) {
  const plotRef     = useRef<HTMLDivElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)

  const recentScope = useMemo(() => rolls.slice(-maxRenderedRolls), [rolls, maxRenderedRolls])

  const latestChance = useMemo(() => {
    for (let i = recentScope.length - 1; i >= 0; i--) {
      const c = Number(recentScope[i]?.chance)
      if (Number.isFinite(c) && c > 0) return c
    }
    return 1
  }, [recentScope])

  const rollProbabilities = useMemo(
    () => recentScope.map(s => safeProbability(s.roll)).filter(v => v > 0),
    [recentScope],
  )

  const minDecade = useMemo(() => {
    const chanceDecade = latestChance > 0 ? Math.floor(Math.log10(latestChance)) : -4
    if (!rollProbabilities.length) return Math.max(-12, Math.min(-1, chanceDecade))
    const rollDecade = Math.floor(Math.log10(Math.min(...rollProbabilities)))
    return Math.max(-8, Math.min(-1, Math.min(rollDecade, chanceDecade)))
  }, [rollProbabilities, latestChance])

  const thresholdValues = useMemo(() => {
    const vals: number[] = []
    for (let e = minDecade; e <= 0; e++) vals.push(10 ** e)
    return vals
  }, [minDecade])

  const targetChancePlotX = useMemo(() => {
    return 0.04 + positionByLogProbability(latestChance, minDecade) * 0.92
  }, [latestChance, minDecade])

  const highestRoll = useMemo(() => recentScope.length ? recentScope.reduce((best, s) => s.roll > best.roll ? s : best, recentScope[0]) : undefined, [recentScope])
  const lowestRoll  = useMemo(() => recentScope.length ? recentScope.reduce((best, s) => s.roll < best.roll ? s : best, recentScope[0]) : undefined, [recentScope])

  const luckStats = useMemo(() => ({
    currentProb: luck.prob,
    currentPercent: luck.prob * 100,
    currentCount: luck.count,
    lastCompletedProb: luck.lastProb,
    lastCompletedCount: luck.lastCount,
  }), [luck])

  const recentRolls     = useMemo(() => [...recentScope].reverse(), [recentScope])
  const recentHighRolls = useMemo(() => [...recentScope].reverse().filter(s => s.roll > 0.99).slice(0, 5), [recentScope])
  const recentLowRolls  = useMemo(() => [...recentScope].reverse().filter(s => s.roll < 0.01).slice(0, 5), [recentScope])

  const latestId = recentScope.length > 0 ? recentScope[recentScope.length - 1].id : ''

  useEffect(() => {
    const canvas = canvasRef.current
    const container = plotRef.current
    if (!canvas || !container) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.max(1, container.clientWidth)
    const h = Math.max(1, container.clientHeight)
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    for (let idx = 0; idx < recentScope.length; idx++) {
      const s = recentScope[idx]
      const x = positionByLogProbability(s.roll, minDecade)
      const plotX = (0.04 + x * 0.92) * w
      const plotY = h * 0.58 + getStableBand(s.id) * 8
      const age = Math.max(0, recentScope.length - 1 - idx)
      const dotAlpha = Math.max(0.08, 1 - age / 28)
      const borderFadeProgress = Math.max(0, Math.min(1, (age - Math.max(0, maxRenderedRolls - 11)) / 10))
      const radius = s.id === latestId ? 4.5 : 4
      ctx.globalAlpha = dotAlpha
      ctx.fillStyle = s.authorColor || '#42a5f5'
      ctx.beginPath(); ctx.arc(plotX, plotY, radius, 0, Math.PI * 2); ctx.fill()
      if (borderFadeProgress < 1) {
        ctx.globalAlpha = 1 - borderFadeProgress
        ctx.strokeStyle = '#666'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(plotX, plotY, radius, 0, Math.PI * 2); ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
  }, [recentScope, minDecade, latestId, maxRenderedRolls])

  useEffect(() => {
    const onResize = () => {
      const canvas = canvasRef.current; const container = plotRef.current
      if (!canvas || !container) return
      const dpr = window.devicePixelRatio || 1
      const w = Math.max(1, container.clientWidth); const h = Math.max(1, container.clientHeight)
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (!recentScope.length) {
    return <div style={{ fontSize: 12, color: '#555', marginTop: 8 }}>No roll samples yet.</div>
  }

  const rollLine = (s: RollSample, key: string) => (
    <div key={key} style={{
      display: 'grid', gridTemplateColumns: '40% 60%', columnGap: 4,
      lineHeight: 1.25, borderLeft: `4px solid ${s.authorColor || '#888'}`, paddingLeft: 6,
    }}>
      <span style={{ fontFamily: 'monospace', fontSize: 11, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {formatProbability(s.roll)}
      </span>
      <span style={{ fontFamily: 'monospace', fontSize: 11, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {formatOdds(s.roll)}
      </span>
    </div>
  )

  return (
    <div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
        {formatOdds(latestChance)} ({formatProbability(latestChance)})
      </div>

      <div style={{ marginBottom: 8 }}>
        {highestRoll && <div style={{ fontSize: 11, color: '#aaa' }}>Highest: {formatProbability(highestRoll.roll)} {formatOdds(highestRoll.roll)}</div>}
        {lowestRoll  && <div style={{ fontSize: 11, color: '#aaa' }}>Lowest: {formatProbability(lowestRoll.roll)} {formatOdds(lowestRoll.roll)}</div>}
      </div>

      <div style={{
        marginBottom: 10, border: '1px solid rgb(var(--ink-rgb) / 0.1)', borderRadius: 6, padding: '8px 10px',
        display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 8,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>Luck-o-meter</div>
          <div style={{ fontSize: 13 }}>{formatOdds(luckStats.currentProb)}</div>
          <div style={{ fontSize: 11, color: '#666' }}>Streak length: {luckStats.currentCount}</div>
          <div style={{ fontSize: 11, color: '#666' }}>
            Last win:{' '}
            {luckStats.lastCompletedProb === null
              ? 'n/a'
              : `${formatOdds(luckStats.lastCompletedProb)} (${(luckStats.lastCompletedProb * 100).toPrecision(3)}%, ${luckStats.lastCompletedCount} posts)`}
          </div>
        </div>
        <div style={{ borderLeft: '1px solid rgb(var(--ink-rgb) / 0.1)', paddingLeft: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 'clamp(1rem, 3vw, 1.6rem)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {luckStats.currentPercent.toPrecision(3)}%
          </span>
        </div>
      </div>

      <div ref={plotRef} style={{
        position: 'relative', width: '100%', height: 138,
        borderRadius: 8, border: '1px solid rgb(var(--ink-rgb) / 0.1)',
        background: 'var(--surface-raised)', padding: '20px 16px 8px', overflow: 'hidden', boxSizing: 'border-box',
      }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} />
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, background: 'rgb(var(--ink-rgb) / 0.08)', transform: 'translateY(-50%)' }} />
        {thresholdValues.map(t => {
          const px = 0.04 + positionByLogProbability(t, minDecade) * 0.92
          return (
            <div key={`th-${t}`}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${px * 100}%`, borderLeft: '1px dashed rgb(var(--ink-rgb) / 0.2)', zIndex: 2 }} />
              <span style={{ position: 'absolute', top: 2, left: `${px * 100}%`, transform: 'translateX(-50%)', fontSize: 9, background: 'var(--surface-raised)', padding: '0 2px', color: '#555', zIndex: 2 }}>
                {formatThreshold(t)}
              </span>
            </div>
          )
        })}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${targetChancePlotX * 100}%`, borderLeft: '2px dotted rgba(251,146,60,0.8)', zIndex: 3 }} />
        <span style={{ position: 'absolute', bottom: 2, left: `${targetChancePlotX * 100}%`, transform: 'translateX(-50%)', fontSize: 9, background: 'rgba(251,146,60,0.15)', padding: '0 3px', color: '#fb923c', fontWeight: 700, borderRadius: 3, zIndex: 3 }}>
          {formatOdds(latestChance)}
        </span>
      </div>

      <div style={{ marginTop: 8, border: '1px solid rgb(var(--ink-rgb) / 0.08)', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3, color: '#aaa' }}>Recent</div>
          <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {recentRolls.map(s => rollLine(s, `recent-${s.id}`))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3, color: '#aaa' }}>Recent High (&gt;0.99)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {recentHighRolls.length === 0
              ? <span style={{ fontSize: 11, color: '#555' }}>None</span>
              : recentHighRolls.map(s => rollLine(s, `high-${s.id}`))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3, color: '#aaa' }}>Recent Low (&lt;0.01)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {recentLowRolls.length === 0
              ? <span style={{ fontSize: 11, color: '#555' }}>None</span>
              : recentLowRolls.map(s => rollLine(s, `low-${s.id}`))}
          </div>
        </div>
      </div>
    </div>
  )
})

interface RollVisualizerHostProps {
  threadName: string
  socket: Socket | null
}

export default function RollVisualizerHost({ threadName, socket }: RollVisualizerHostProps) {
  const [rolls, setRolls] = useState<RollSample[]>([])
  const rollsRef = useRef<RollSample[]>([])
  const streakRef = useRef<LuckStats>({ prob: 1, count: 0, lastProb: null, lastCount: 0 })
  const [luck, setLuck] = useState<LuckStats>({ prob: 1, count: 0, lastProb: null, lastCount: 0 })

  const addRoll = useCallback((post: any, counter: any) => {
    if (post.roll == null) return
    const sample: RollSample = {
      id: post.uuid,
      roll: Number(post.roll),
      chance: Number(post.chance ?? 1),
      authorColor: counter?.color,
    }

    const s = streakRef.current
    const chance = sample.chance
    const roll = sample.roll
    if (Number.isFinite(chance) && Number.isFinite(roll) && chance >= 0 && chance <= 1) {
      if (roll > chance) {
        s.count += 1
        s.prob *= Math.max(0, 1 - chance)
      } else {
        if (s.count > 0) { s.lastProb = s.prob; s.lastCount = s.count }
        s.prob = 1
        s.count = 0
      }
      setLuck({ ...s })
    }

    const next = rollsRef.current
    next.push(sample)
    if (next.length > RENDER_WINDOW) next.splice(0, next.length - RENDER_WINDOW)
    setRolls(next.slice())
  }, [])

  useEffect(() => {
    if (!socket) return
    const onPost = (data: { post: any; counter: any }) => addRoll(data.post, data.counter)
    socket.on('post', onPost)
    return () => { socket.off('post', onPost) }
  }, [socket, addRoll])

  if (!ROLL_THREADS.has(threadName)) return null

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Roll Visualizer</div>
      <RollVisualizer rolls={rolls} luck={luck} />
    </div>
  )
}

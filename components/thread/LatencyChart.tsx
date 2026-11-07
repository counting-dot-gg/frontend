'use client'

import { memo, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

export interface LatencySample {
  schedulingMs: number
  dbReadMs:     number
  dbWriteMs:    number
  preBroadcastMs: number
  otherMs:      number
}

const WARN_MS = 1000
const CRIT_MS = 5000

const COLORS = {
  scheduling: '#ab47bc',
  dbRead:     '#42a5f5',
  dbWrite:    '#ef5350',
  preBroadcast: '#ffa726',
  other:      '#66bb6a',
}

function totalMs(s: LatencySample) {
  return s.schedulingMs + s.dbReadMs + s.dbWriteMs + s.preBroadcastMs + s.otherMs
}

function p95(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1]
}

function healthLabel(p95total: number): { label: string; color: string } | null {
  if (p95total >= CRIT_MS) return { label: 'Degraded', color: 'var(--danger)' }
  if (p95total >= WARN_MS) return { label: 'Slow', color: '#f97316' }
  return null
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const total = (payload as any[]).reduce((s: number, p: any) => s + (p.value ?? 0), 0)
  return (
    <div style={{
      background: 'var(--surface-0)',
      border: '1px solid rgb(var(--ink-rgb) / 0.15)',
      boxShadow: '0 2px 10px rgb(0 0 0 / 0.15)',
      padding: '6px 8px', borderRadius: 6, fontSize: 11,
    }}>
      {(payload as any[]).map((p: any) => (
        <div key={p.dataKey} style={{ color: p.stroke ?? p.color, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <span>{p.name}</span><strong>{p.value}ms</strong>
        </div>
      ))}
      <div style={{ borderTop: '1px solid rgb(var(--ink-rgb) / 0.1)', marginTop: 4, paddingTop: 4, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--ink-3)' }}>total</span><strong style={{ color: 'var(--ink-2)' }}>{total}ms</strong>
      </div>
    </div>
  )
}

const LatencyChart = memo(function LatencyChart({ samples }: { samples: LatencySample[] }) {
  const { chartData, p95total, avgTotal, avgScheduling, avgRead, avgWrite, avgPreBroadcast, avgOther } = useMemo(() => {
    if (samples.length === 0) return { chartData: [], p95total: 0, avgTotal: 0, avgScheduling: 0, avgRead: 0, avgWrite: 0, avgPreBroadcast: 0, avgOther: 0 }
    const totals = samples.map(totalMs)
    const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
    return {
      chartData: samples.map((s, i) => ({ i, scheduling: s.schedulingMs, dbRead: s.dbReadMs, dbWrite: s.dbWriteMs, preBroadcast: s.preBroadcastMs, other: s.otherMs })),
      p95total: p95(totals),
      avgTotal: avg(totals),
      avgScheduling: avg(samples.map(s => s.schedulingMs)),
      avgRead: avg(samples.map(s => s.dbReadMs)),
      avgWrite: avg(samples.map(s => s.dbWriteMs)),
      avgPreBroadcast: avg(samples.map(s => s.preBroadcastMs)),
      avgOther: avg(samples.map(s => s.otherMs)),
    }
  }, [samples])

  const health = healthLabel(p95total)

  return (
    <div>
      {samples.length > 0 && health && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
            background: health.color + '22', color: health.color,
            border: `1px solid ${health.color}55`,
          }}>{health.label}</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, marginBottom: 6, flexWrap: 'wrap', fontSize: 11, color: 'var(--ink-3)' }}>
        {samples.length > 0 && <>
          <span>avg total <strong style={{ color: 'var(--ink-2)' }}>{avgTotal}ms</strong></span>
          <span>p95 <strong style={{ color: 'var(--ink-2)' }}>{p95total}ms</strong></span>
          <span style={{ color: COLORS.scheduling }}>queue wait <strong>{avgScheduling}ms</strong></span>
          <span style={{ color: COLORS.dbRead }}>reads <strong>{avgRead}ms</strong></span>
          <span style={{ color: COLORS.dbWrite }}>writes <strong>{avgWrite}ms</strong></span>
          <span style={{ color: COLORS.preBroadcast }}>pre-broadcast <strong>{avgPreBroadcast}ms</strong></span>
          <span style={{ color: COLORS.other }}>other <strong>{avgOther}ms</strong></span>
          <span>last {samples.length} posts</span>
        </>}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            {(['scheduling', 'dbRead', 'dbWrite', 'preBroadcast', 'other'] as const).map(key => (
              <linearGradient key={key} id={`lc_grad_${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={COLORS[key]} stopOpacity={0.5} />
                <stop offset="95%" stopColor={COLORS[key]} stopOpacity={0.1} />
              </linearGradient>
            ))}
          </defs>
          <XAxis dataKey="i" hide />
          <YAxis tickFormatter={v => `${v}ms`} width={55} tick={{ fontSize: 10 }} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={WARN_MS} stroke="#ff9800" strokeDasharray="3 3" />
          <ReferenceLine y={CRIT_MS} stroke="var(--danger)" strokeDasharray="3 3" />
          <Area type="monotone" dataKey="scheduling" name="Scheduling" stackId="1" stroke={COLORS.scheduling} fill={`url(#lc_grad_scheduling)`} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="dbWrite"    name="DB write"   stackId="1" stroke={COLORS.dbWrite}    fill={`url(#lc_grad_dbWrite)`}    strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="dbRead"     name="DB read"    stackId="1" stroke={COLORS.dbRead}     fill={`url(#lc_grad_dbRead)`}     strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="preBroadcast" name="Pre-broadcast" stackId="1" stroke={COLORS.preBroadcast} fill={`url(#lc_grad_preBroadcast)`} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="other"      name="Other"      stackId="1" stroke={COLORS.other}      fill={`url(#lc_grad_other)`}      strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', fontSize: 10, color: 'var(--ink-3)' }}>
        {(['scheduling', 'dbRead', 'dbWrite', 'preBroadcast', 'other'] as const).map(key => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[key], display: 'inline-block' }} />
            {{ scheduling: 'Queue wait', dbRead: 'DB read', dbWrite: 'DB write', preBroadcast: 'Pre-broadcast', other: 'Other' }[key]}
          </span>
        ))}
      </div>
    </div>
  )
})

export default LatencyChart

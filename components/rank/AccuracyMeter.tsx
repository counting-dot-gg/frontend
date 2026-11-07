'use client'

import { useMemo, useState } from 'react'
import {
  getAccuracyWindowStats, getAccuracyBuckets, getBatchColorSignal,
  drillAccuracyBucket, minValidForThreshold, type AccuracyBucket,
} from '@/lib/rankUtils'
import { useAnimatedNumber } from './useAnimatedNumber'

type Props = {
  window: string | null
  windowSize: number
  minAccuracyPercent: number
  height?: number
}

const MAX_BATCHES = 25

export function AccuracyMeter({ window: rleWindow, windowSize, minAccuracyPercent, height = 20 }: Props) {
  const stats = getAccuracyWindowStats(rleWindow, windowSize)
  const needValid = minValidForThreshold(windowSize, minAccuracyPercent)
  const isPassing = stats.pct != null && stats.pct >= minAccuracyPercent

  const animatedPct = useAnimatedNumber(stats.pct ?? 0)
  const animatedValidCount = useAnimatedNumber(stats.validCount)
  const animatedEffective = useAnimatedNumber(stats.effective)

  const buckets = useMemo(() => getAccuracyBuckets(rleWindow, windowSize, MAX_BATCHES), [rleWindow, windowSize])

  const pctColor = stats.pct == null ? '#888' : isPassing ? 'var(--success)' : 'var(--danger)'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1, color: pctColor }}>
          {stats.pct != null ? `${animatedPct}%` : '-'}
        </span>
        <span style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1, color: '#888' }}>
          accuracy
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2, marginBottom: 6 }}>
        <span style={{ fontSize: '0.7rem', color: '#888' }}>
          {animatedValidCount}/{animatedEffective} Attempts
        </span>
        <span style={{ fontSize: '0.7rem', color: '#888' }}>
          need {needValid}/{windowSize} · {minAccuracyPercent}%
        </span>
      </div>
      {buckets.length === 0 ? (
        <div style={{ width: '100%', height, borderRadius: 4, backgroundColor: 'rgb(var(--ink-rgb) / 0.1)' }} title="No attempts recorded yet" />
      ) : (
        <BatchStrip
          window={rleWindow} buckets={buckets}
          overallStats={stats} minAccuracyPercent={minAccuracyPercent} height={height}
        />
      )}
    </div>
  )
}

type BatchStripProps = {
  window: string | null
  buckets: AccuracyBucket[]
  overallStats: { validCount: number; effective: number; pct: number | null }
  minAccuracyPercent: number
  height: number
}

function BatchStrip({ window: rleWindow, buckets, overallStats, minAccuracyPercent, height }: BatchStripProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const toggle = (i: number) => setExpandedIndex((prev) => (prev === i ? null : i))

  const expandedBucket = expandedIndex != null ? buckets[expandedIndex] : null
  const subBuckets = expandedBucket
    ? drillAccuracyBucket(rleWindow, expandedBucket.rangeStart, expandedBucket.rangeEnd, MAX_BATCHES)
    : []

  return (
    <div>
      <div style={{ display: 'flex', width: '100%', height, gap: buckets.length > 60 ? 0 : 2 }}>
        {buckets.map((bucket, i) => {
          const canDrill = bucket.total > 1
          const isExpanded = expandedIndex === i
          const batchPct = bucket.total > 0 ? Math.round((bucket.valid / bucket.total) * 1000) / 10 : 0
          const { side } = getBatchColorSignal(bucket.valid, bucket.total, minAccuracyPercent)
          const color = bucket.total === 0 ? 'rgb(var(--ink-rgb) / 0.1)' : side === 'good' ? 'var(--success)' : 'var(--danger)'
          const title = [
            `Batch: ${bucket.valid}/${bucket.total} (${batchPct}%)`,
            `Overall: ${overallStats.validCount}/${overallStats.effective} (${overallStats.pct}%)`,
            canDrill ? (isExpanded ? 'Click to collapse' : 'Click to view sub-batches') : '',
          ].filter(Boolean).join('\n')
          return (
            <div
              key={i}
              title={title}
              onClick={canDrill ? () => toggle(i) : undefined}
              style={{
                flex: `${bucket.total} 0 0`, height: '100%',
                backgroundColor: color,
                borderRadius: buckets.length <= 60 ? 2 : 0,
                cursor: canDrill ? 'pointer' : 'default',
                boxShadow: isExpanded ? '0 0 0 2px var(--card), 0 0 0 4px #1976d2' : 'none',
                transition: 'box-shadow 120ms ease',
              }}
            />
          )
        })}
      </div>
      {expandedBucket && subBuckets.length > 0 && (
        <>
          <BraceConnector
            position={(() => {
              const totalWidth = buckets.reduce((sum, b) => sum + b.total, 0)
              const before = buckets.slice(0, expandedIndex!).reduce((sum, b) => sum + b.total, 0)
              return totalWidth > 0 ? (before + buckets[expandedIndex!].total / 2) / totalWidth : 0.5
            })()}
          />
          <BatchStrip
            window={rleWindow} buckets={subBuckets}
            overallStats={overallStats} minAccuracyPercent={minAccuracyPercent} height={height}
          />
        </>
      )}
    </div>
  )
}

function BraceConnector({ position }: { position: number }) {
  const width = 400
  const height = 20
  const midY = height / 2
  const tickX = Math.max(0, Math.min(width, position * width))
  return (
    <div style={{ width: '100%', height, marginTop: 2 }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <path
          d={
            `M 0 ${midY} L 0 ${height} M 0 ${midY} L ${tickX} ${midY} ` +
            `M ${width} ${midY} L ${width} ${height} M ${width} ${midY} L ${tickX} ${midY} ` +
            `M ${tickX} ${midY} L ${tickX} 0`
          }
          fill="none" stroke="#1976d2" strokeWidth={1.5} strokeLinecap="round" vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

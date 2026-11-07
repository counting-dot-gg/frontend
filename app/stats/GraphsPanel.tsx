'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { CounterInfo } from '@/lib/counterUtils'
import { avatarUrl, displayName } from '@/lib/counterUtils'
import { Empty } from '@/components/stats/StatsUI'

export type GraphPoint = Record<string, any>
export const OTHER_COLOR = '#6b7280'

export type GraphMode =
  | 'cumulative-total' | 'cumulative-stacked' | 'cumulative-compare'
  | 'daily-total' | 'daily-compare'

const GRAPH_MODES: { value: GraphMode; label: string }[] = [
  { value: 'cumulative-total', label: 'Cumulative Total' },
  { value: 'cumulative-stacked', label: 'Cumulative: Stacked' },
  { value: 'daily-total', label: 'Daily Total' },
  { value: 'cumulative-compare', label: 'Cumulative: Compare' },
  { value: 'daily-compare', label: 'Daily: Compare' },
]

function buildSortedLb(allLb: Record<string, number>, counters: Map<string, CounterInfo>): CounterInfo[] {
  return Object.entries(allLb)
    .sort((a, b) => b[1] - a[1])
    .map(([uuid]) => counters.get(uuid))
    .filter((c): c is CounterInfo => !!c)
}

function CounterAutocomplete({
  allLb,
  counters,
  selectedUUIDs,
  onAdd,
}: {
  allLb: Record<string, number>
  counters: Map<string, CounterInfo>
  selectedUUIDs: string[]
  onAdd: (uuid: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const sorted = useMemo(() => buildSortedLb(allLb, counters), [allLb, counters])

  const suggestions = useMemo(() => {
    const q = query.toLowerCase().trim()
    return sorted
      .filter(c => !selectedUUIDs.includes(c.uuid))
      .filter(c => !q || displayName(c).toLowerCase().includes(q) || c.username.toLowerCase().includes(q))
      .slice(0, 8)
  }, [sorted, query, selectedUUIDs])

  const pick = (c: CounterInfo) => {
    onAdd(c.uuid)
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!listRef.current?.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div style={{ position: 'relative', width: 240 }}>
      <input
        ref={inputRef}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Add counter…"
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '6px 10px', fontSize: 13, borderRadius: 6,
          background: 'rgb(var(--ink-rgb) / 0.06)', border: '1px solid rgb(var(--ink-rgb) / 0.15)',
          color: 'var(--ink-1)', outline: 'none',
        }}
      />
      {open && suggestions.length > 0 && (
        <div ref={listRef} style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 2,
          background: 'var(--surface-raised)', border: '1px solid rgb(var(--ink-rgb) / 0.12)', borderRadius: 6,
          overflow: 'hidden',
        }}>
          {suggestions.map(c => (
            <button key={c.uuid} onMouseDown={() => pick(c)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '7px 10px', border: 'none', background: 'transparent',
              cursor: 'pointer', textAlign: 'left', color: c.color || '#ddd', fontSize: 13,
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.07)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {avatarUrl(c) && (
                <img src={avatarUrl(c)!} alt="" width={18} height={18} style={{ borderRadius: '50%', flexShrink: 0 }} />
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(c)}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#555', fontFamily: 'monospace', flexShrink: 0 }}>
                {(allLb[c.uuid] ?? 0).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function GraphsPanel({
  points,
  allLb,
  counters,
  topUUIDs,
  mode,
  onModeChange,
  selectedUUIDs,
  onSelectedUUIDsChange,
}: {
  points: GraphPoint[]
  allLb: Record<string, number>
  counters: Map<string, CounterInfo>
  topUUIDs: string[]
  mode: GraphMode
  onModeChange: (m: GraphMode) => void
  selectedUUIDs: string[]
  onSelectedUUIDsChange: (uuids: string[]) => void
}) {
  const isCompare = mode === 'cumulative-compare' || mode === 'daily-compare'
  const isStacked = mode === 'cumulative-stacked'
  const isCumulative = mode.startsWith('cumulative')

  const stackKeys = useMemo(
    () => (isStacked ? ['other', ...[...topUUIDs].reverse()] : []),
    [isStacked, topUUIDs],
  )
  const keyColor = useCallback(
    (key: string) => (key === 'other' ? OTHER_COLOR : counters.get(key)?.color || '#888'),
    [counters],
  )
  const keyLabel = useCallback(
    (key: string) => {
      if (key === 'other') return 'Other'
      const c = counters.get(key)
      return c ? displayName(c) : key.slice(0, 8)
    },
    [counters],
  )

  const addUUID = (uuid: string) => {
    if (!selectedUUIDs.includes(uuid)) onSelectedUUIDsChange([...selectedUUIDs, uuid])
  }
  const removeUUID = (uuid: string) => onSelectedUUIDsChange(selectedUUIDs.filter(u => u !== uuid))

  const chartData = useMemo(() => {
    if (!points.length) return []
    return points.map(pt => {
      const row: Record<string, any> = { date: pt.date }
      if (isStacked) {
        for (const key of stackKeys) {
          row[key] = Number(pt[`${key}_cum`]) || 0
        }
      } else if (isCompare) {
        for (const uuid of selectedUUIDs) {
          row[uuid] = isCumulative ? (pt[`${uuid}_cum`] ?? null) : (pt[uuid] ?? null)
        }
      } else {
        row['total'] = isCumulative ? pt.cumulative : pt.daily
      }
      return row
    })
  }, [points, isCompare, isStacked, isCumulative, selectedUUIDs, stackKeys])

  const formatYAxis = (v: number) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {GRAPH_MODES.map(m => (
          <button key={m.value} onClick={() => onModeChange(m.value)} style={{
            padding: '4px 12px', borderRadius: 12, fontSize: 12, cursor: 'pointer',
            border: `1px solid ${mode === m.value ? '#f97316' : 'rgb(var(--ink-rgb) / 0.15)'}`,
            background: mode === m.value ? 'rgba(249,115,22,0.15)' : 'transparent',
            color: mode === m.value ? '#f97316' : '#888',
          }}>{m.label}</button>
        ))}
      </div>

      {isCompare && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CounterAutocomplete allLb={allLb} counters={counters} selectedUUIDs={selectedUUIDs} onAdd={addUUID} />
          {selectedUUIDs.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {selectedUUIDs.map((uuid) => {
                const c = counters.get(uuid)
                const color = c?.color || '#888'
                return (
                  <span key={uuid} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '2px 8px 2px 6px', borderRadius: 20, fontSize: 12,
                    border: `1px solid ${color}55`, background: color + '18', color,
                  }}>
                    {c && avatarUrl(c) && <img src={avatarUrl(c)!} alt="" width={14} height={14} style={{ borderRadius: '50%' }} />}
                    {c ? displayName(c) : uuid.slice(0, 8)}
                    <button onClick={() => removeUUID(uuid)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'inherit', padding: 0, fontSize: 13, lineHeight: 1, opacity: 0.6,
                    }}>×</button>
                  </span>
                )
              })}
            </div>
          )}
          {selectedUUIDs.length === 0 && <Empty>Search for counters above to compare their counts over time.</Empty>}
        </div>
      )}

      {isStacked && topUUIDs.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[...topUUIDs, 'other'].map(key => {
            const c = key === 'other' ? undefined : counters.get(key)
            const color = keyColor(key)
            return (
              <span key={key} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '2px 8px 2px 6px', borderRadius: 20, fontSize: 12,
                border: `1px solid ${color}55`, background: color + '18', color,
              }}>
                {c && avatarUrl(c)
                  ? <img src={avatarUrl(c)!} alt="" width={14} height={14} style={{ borderRadius: '50%' }} />
                  : <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                }
                {keyLabel(key)}
              </span>
            )
          })}
        </div>
      )}

      {points.length === 0
        ? <Empty>No graph data for this range.</Empty>
        : isStacked ? (
          stackKeys.length <= 1
            ? <Empty>No counter data for this range.</Empty>
            : <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--ink-rgb) / 0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#555' }}
                    tickFormatter={d => d?.slice(5) ?? ''}
                    interval="preserveStartEnd"
                  />
                  <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 10, fill: '#555' }} width={48} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface-raised)', border: '1px solid rgb(var(--ink-rgb) / 0.12)', borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: '#888', marginBottom: 4 }}
                    itemSorter={item => -stackKeys.indexOf(String(item.dataKey))}
                    formatter={(value, name) => [Number(value).toLocaleString(), keyLabel(String(name))]}
                  />
                  {stackKeys.map(key => (
                    <Area
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stackId="counts"
                      stroke={keyColor(key)}
                      fill={keyColor(key)}
                      fillOpacity={0.65}
                      strokeWidth={1}
                      isAnimationActive={false}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
        )
        : (!isCompare || selectedUUIDs.length > 0) && (
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--ink-rgb) / 0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#555' }}
                tickFormatter={d => d?.slice(5) ?? ''}
                interval="preserveStartEnd"
              />
              <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 10, fill: '#555' }} width={48} />
              <Tooltip
                contentStyle={{ background: 'var(--surface-raised)', border: '1px solid rgb(var(--ink-rgb) / 0.12)', borderRadius: 6, fontSize: 12 }}
                labelStyle={{ color: '#888', marginBottom: 4 }}
                formatter={(value, rawName) => {
                  const name = String(rawName)
                  const c = counters.get(name)
                  const label = c ? displayName(c) : name === 'total' ? 'Total' : name.slice(0, 8)
                  return [value == null ? '-' : Number(value).toLocaleString(), label]
                }}
              />
              {isCompare
                ? selectedUUIDs.map((uuid) => (
                    <Line key={uuid} type="monotone" dataKey={uuid}
                      stroke={counters.get(uuid)?.color || '#888'}
                      dot={false} strokeWidth={2} connectNulls />
                  ))
                : <Line type="monotone" dataKey="total" stroke="#f97316" dot={false} strokeWidth={2} connectNulls />
              }
            </LineChart>
          </ResponsiveContainer>
        )
      }
    </div>
  )
}

export default GraphsPanel

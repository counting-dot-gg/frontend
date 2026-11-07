'use client'

import { useCallback, useEffect, useState } from 'react'
import { Line, LineChart, Tooltip, XAxis, YAxis, Legend } from 'recharts'
import { API } from '@/lib/apiBase'
import { axis, card, ChartCard, Grid, grid, margin, Stat, tooltipStyle } from './StatusClient'
import ConnectionReport from './ConnectionReport'

type Split = { server: number; network: number; rest: number } | null
interface Summary {
  reports: number; counts: number
  rtP50: number | null; rtP95: number | null; procP50: number | null
  pingP50: number | null; pingP95: number | null
  lagP50: number | null; lagP95: number | null; lagMax: number | null
  longTaskMs: number | null; longTaskMsP95: number | null
  jank: number | null; msgs: number | null; kb: number | null
  polling: number; split: Split
  blockMs: number | null; blockMsP95: number | null; styleMs: number | null; renderMs: number | null
  heapMb: number | null; heapMbMax: number | null; dom: number | null; domMax: number | null; ageMax: number | null
}
interface Script { script: string; msPerTabMinute: number; count: number; forcedLayoutMs: number }
interface CounterRow extends Summary {
  uuid: string; username: string; name: string; color: string
  lastSeen: number; device: string; route: string | null
}
interface Minute {
  t: number; route: string; tr: string | null; vis: number | null; device: string
  rtP50: number | null; rtP95: number | null; procP50: number | null; counts: number
  pingP50: number | null; lagP50: number | null; lagP95: number | null; lagMax: number | null
  longTaskMs: number | null; jank: number | null; msgs: number | null; kb: number
  top: [string, number, number, number?][]
  blockMs: number | null; styleMs: number | null; renderMs: number | null
  scripts: [string, number, number, number][]
  heapMb: number | null; dom: number | null; age: number | null
}
interface Payload {
  minutes: number; now: number
  overall: Summary & { counters: number }
  counters: CounterRow[]
  pages: (Summary & { key: string })[]
  devices: (Summary & { key: string })[]
  messages: { event: string; perTabMinute: number; kbPerTabMinute: number; msPerTabMinute: number }[]
  scripts: Script[]
  detail: (Summary & { username: string; found: boolean; scripts: Script[]; minutes: Minute[] }) | null
}

const ms = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v)}`)
const WINDOWS = [15, 60, 360, 1440]
const winLabel = (m: number) => (m < 60 ? `${m}m` : `${m / 60}h`)
const ago = (t: number, now: number) => {
  const s = Math.max(0, Math.round((now - t) / 1000))
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : `${Math.round(s / 3600)}h`
}
const tone = (v: number | null | undefined) =>
  v == null ? 'var(--ink-3)' : v < 100 ? 'var(--success)' : v < 300 ? '#f59e0b' : 'var(--danger)'

const th: React.CSSProperties = { textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--ink-3)', padding: '6px 8px', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.4 }
const td: React.CSSProperties = { padding: '6px 8px', fontSize: 12.5, borderTop: '1px solid rgb(var(--ink-rgb) / 0.06)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }

function SplitBar({ split, rt }: { split: Split; rt: number | null }) {
  if (!split || !rt) return null
  const parts = [
    { k: 'server', v: split.server, c: '#7e57c2' },
    { k: 'network', v: split.network, c: '#42a5f5' },
    { k: 'browser + rest', v: split.rest, c: '#ffa726' },
  ]
  const total = Math.max(1, parts.reduce((a, p) => a + p.v, 0))
  return (
    <div style={{ ...card, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>
        <span>Count round trip</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{rt}ms</span>
      </div>
      <div style={{ display: 'flex', height: 14, borderRadius: 4, overflow: 'hidden', marginTop: 8 }}>
        {parts.map(p => <div key={p.k} title={`${p.k} ${p.v}ms`} style={{ width: `${(p.v / total) * 100}%`, background: p.c }} />)}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: 11.5, color: 'var(--ink-2)' }}>
        {parts.map(p => (
          <span key={p.k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.c }} />{p.k} <b style={{ fontVariantNumeric: 'tabular-nums' }}>{p.v}ms</b>
          </span>
        ))}
      </div>
    </div>
  )
}

function Table({ title, head, rows }: { title: string; head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ ...card, marginTop: 12, padding: '10px 6px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', padding: '0 8px 4px' }}>{title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr>{head.map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={td}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}

function Scripts({ rows }: { rows: Script[] }) {
  if (!rows?.length) return null
  return (
    <Table
      title="Slow scripts"
      head={['Script', 'ms / tab-min', 'Calls', 'Forced layout ms']}
      rows={rows.map(r => [
        <span key="s" title={r.script} style={{ display: 'inline-block', maxWidth: 560, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }}>{r.script}</span>,
        <span key="m" style={{ color: tone(r.msPerTabMinute) }}>{r.msPerTabMinute}</span>,
        r.count,
        r.forcedLayoutMs,
      ])}
    />
  )
}

function Overview({ s }: { s: Summary & { counters?: number } }) {
  return (
    <Grid>
      <Stat label="Round trip" value={ms(s.rtP50)} unit="ms" sub={`p95 ${ms(s.rtP95)}ms`} color={tone(s.rtP50)} />
      <Stat label="Server" value={ms(s.procP50)} unit="ms" />
      <Stat label="Ping" value={ms(s.pingP50)} unit="ms" sub={`p95 ${ms(s.pingP95)}ms`} />
      <Stat label="Browser lateness" value={ms(s.lagP95)} unit="ms" sub={`p95 · max ${ms(s.lagMax)}ms`} color={tone(s.lagP95)} />
      <Stat label="Freezes" value={ms(s.longTaskMs)} unit="ms/min" sub={`p95 ${ms(s.longTaskMsP95)}ms`} />
      <Stat label="Messages" value={ms(s.msgs)} unit="/min" sub={`${ms(s.kb)} KB/min`} />
      <Stat label="Slow frames" value={ms(s.blockMs)} unit="ms/min" sub={`style ${ms(s.styleMs)} · render ${ms(s.renderMs)}`} color={tone(s.blockMs)} />
      <Stat label="Memory" value={ms(s.heapMb)} unit="MB" sub={`max ${ms(s.heapMbMax)}MB`} />
      <Stat label="Page size" value={s.dom == null ? '—' : s.dom.toLocaleString()} unit=" els" sub={`max ${s.domMax == null ? '—' : s.domMax.toLocaleString()}`} />
      {s.ageMax != null && <Stat label="Tab age" value={s.ageMax < 60 ? String(s.ageMax) : (s.ageMax / 60).toFixed(1)} unit={s.ageMax < 60 ? 'm' : 'h'} />}
      {s.counters != null && <Stat label="Counters" value={String(s.counters)} sub={`${s.reports} reports${s.polling ? ` · ${s.polling} polling` : ''}`} />}
    </Grid>
  )
}

export default function ClientHealthPanel() {
  const [minutes, setMinutes] = useState(60)
  const [counter, setCounter] = useState('')
  const [query, setQuery] = useState('')
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ minutes: String(minutes) })
      if (counter) qs.set('counter', counter)
      const res = await fetch(`${API}/api/metrics/client-health?${qs}`, { credentials: 'include', cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      setData(await res.json())
      setError(null)
    } catch (e: unknown) {
      setError(`Couldn’t load (${(e as Error).message})`)
    }
  }, [minutes, counter])

  useEffect(() => {
    void load()
    const t = window.setInterval(load, 30_000)
    return () => window.clearInterval(t)
  }, [load])

  const now = data?.now ?? Date.now()
  const d = data?.detail

  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Clients</h2>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, background: 'rgb(var(--ink-rgb) / 0.08)', color: 'var(--ink-3)' }}>staff</span>
        <span style={{ flex: 1 }} />
        <form onSubmit={e => { e.preventDefault(); setCounter(query.trim()) }} style={{ display: 'flex', gap: 6 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="username"
            style={{ padding: '5px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 13, width: 150 }}
          />
        </form>
        {WINDOWS.map(w => (
          <button key={w} type="button" onClick={() => setMinutes(w)} style={{
            padding: '4px 9px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: w === minutes ? 'none' : '1px solid var(--border)',
            background: w === minutes ? 'var(--primary)' : 'transparent',
            color: w === minutes ? 'var(--primary-foreground)' : 'var(--ink-2)',
          }}>{winLabel(w)}</button>
        ))}
      </div>
      {error && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)' }}>{error}</div>}

      {d ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 14 }}>
            <button type="button" onClick={() => { setCounter(''); setQuery('') }} style={{ border: 'none', background: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 13 }}>← All</button>
            <span style={{ fontSize: 16, fontWeight: 800 }}>{d.username}</span>
            {!d.found && <span style={{ fontSize: 12, color: 'var(--danger)' }}>no such counter</span>}
            {d.found && d.reports === 0 && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>no reports</span>}
          </div>
          {d.found && <ConnectionReport username={d.username} />}
          {d.reports > 0 && (
            <>
              <Overview s={d} />
              <SplitBar split={d.split} rt={d.rtP50} />
              <ChartCard title="Per minute (ms)" height={220}>
                <LineChart data={d.minutes.map(m => ({ ...m, time: new Date(m.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }))} margin={margin}>
                  {grid}
                  <XAxis dataKey="time" {...axis} minTickGap={30} />
                  <YAxis {...axis} width={52} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="rtP95" name="round trip p95" stroke="#ef5350" dot={false} connectNulls />
                  <Line type="monotone" dataKey="rtP50" name="round trip p50" stroke="#ffa726" dot={false} connectNulls />
                  <Line type="monotone" dataKey="pingP50" name="ping" stroke="#42a5f5" dot={false} connectNulls />
                  <Line type="monotone" dataKey="lagP95" name="lateness p95" stroke="#66bb6a" dot={false} connectNulls />
                  <Line type="monotone" dataKey="longTaskMs" name="freezes" stroke="#7e57c2" dot={false} connectNulls />
                </LineChart>
              </ChartCard>
              <Scripts rows={d.scripts} />
              <Table
                title="Minutes"
                head={['Time', 'Page', 'Counts', 'Round trip', 'Ping', 'Lateness', 'Freezes', 'Slow frames', 'Messages', 'Top', 'Slowest script', 'Memory', 'Elements', 'Tab', 'Device']}
                rows={[...d.minutes].reverse().map(m => [
                  new Date(m.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
                  <span key="r">{m.route}{m.tr && m.tr !== 'websocket' ? <b style={{ color: 'var(--danger)' }}> · {m.tr}</b> : ''}{m.vis != null && m.vis < 0.9 ? <span style={{ color: 'var(--ink-3)' }}> · {Math.round(m.vis * 100)}% visible</span> : ''}</span>,
                  m.counts || '',
                  <span key="rt" style={{ color: tone(m.rtP95) }}>{m.rtP50 == null ? '—' : `${m.rtP50} / ${m.rtP95}`}</span>,
                  ms(m.pingP50),
                  <span key="l" style={{ color: tone(m.lagP95) }}>{ms(m.lagP95)} / {ms(m.lagMax)}</span>,
                  ms(m.longTaskMs),
                  <span key="b" style={{ color: tone(m.blockMs) }}>{ms(m.blockMs)}</span>,
                  `${ms(m.msgs)} · ${m.kb} KB`,
                  <span key="t" style={{ color: 'var(--ink-3)' }}>{m.top.slice(0, 3).map(([e, n, , t]) => `${e} ${n}${t ? ` (${t}ms)` : ''}`).join(', ')}</span>,
                  <span key="s" style={{ color: 'var(--ink-3)' }} title={m.scripts[0]?.[0]}>{m.scripts[0] ? `${m.scripts[0][1]}ms ${m.scripts[0][0].slice(0, 48)}` : '—'}</span>,
                  m.heapMb == null ? '—' : `${m.heapMb}MB`,
                  m.dom == null ? '—' : m.dom.toLocaleString(),
                  m.age == null ? '—' : `${m.age}m`,
                  <span key="d" style={{ color: 'var(--ink-3)' }}>{m.device}</span>,
                ])}
              />
            </>
          )}
        </>
      ) : data && (
        <>
          <Overview s={data.overall} />
          <SplitBar split={data.overall.split} rt={data.overall.rtP50} />
          <Table
            title="Counters"
            head={['Counter', 'Round trip', 'Ping', 'Lateness', 'Freezes', 'Slow frames', 'Messages', 'Memory', 'Page', 'Device', 'Seen']}
            rows={data.counters.map(c => [
              <button key="c" type="button" onClick={() => { setCounter(c.username); setQuery(c.username) }}
                style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontWeight: 700, color: c.color || 'var(--ink-1)', fontSize: 12.5 }}>
                {c.username}
              </button>,
              <span key="rt" style={{ color: tone(c.rtP95) }}>{c.rtP50 == null ? '—' : `${c.rtP50} / ${c.rtP95}`}</span>,
              ms(c.pingP50),
              <span key="l" style={{ color: tone(c.lagP95) }}>{ms(c.lagP95)} / {ms(c.lagMax)}</span>,
              ms(c.longTaskMs),
              <span key="b" style={{ color: tone(c.blockMs) }}>{ms(c.blockMs)}</span>,
              ms(c.msgs),
              c.heapMbMax == null ? '—' : `${c.heapMbMax}MB`,
              <span key="p" style={{ color: 'var(--ink-3)' }}>{c.route}</span>,
              <span key="d" style={{ color: 'var(--ink-3)' }}>{c.device}{c.polling ? <b style={{ color: 'var(--danger)' }}> · polling</b> : ''}</span>,
              <span key="s" style={{ color: 'var(--ink-3)' }}>{ago(c.lastSeen, now)}</span>,
            ])}
          />
          <Table
            title="Pages"
            head={['Page', 'Reports', 'Round trip', 'Lateness', 'Freezes', 'Messages']}
            rows={data.pages.map(p => [p.key, p.reports, p.rtP50 == null ? '—' : `${p.rtP50} / ${p.rtP95}`,
              <span key="l" style={{ color: tone(p.lagP95) }}>{ms(p.lagP95)}</span>, ms(p.longTaskMs), ms(p.msgs)])}
          />
          <Table
            title="Devices"
            head={['Device', 'Reports', 'Round trip', 'Ping', 'Lateness', 'Freezes']}
            rows={data.devices.map(p => [p.key, p.reports, p.rtP50 == null ? '—' : `${p.rtP50} / ${p.rtP95}`, ms(p.pingP50),
              <span key="l" style={{ color: tone(p.lagP95) }}>{ms(p.lagP95)}</span>, ms(p.longTaskMs)])}
          />
          <Scripts rows={data.scripts} />
          <Table
            title="Messages per tab-minute"
            head={['Event', 'Count', 'KB', 'Handling ms']}
            rows={data.messages.map(m => [m.event, m.perTabMinute, m.kbPerTabMinute, m.msPerTabMinute])}
          />
        </>
      )}
    </section>
  )
}

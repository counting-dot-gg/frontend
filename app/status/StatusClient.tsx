'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { API } from '@/lib/apiBase'
import ClientHealthPanel from './ClientHealthPanel'
import ConnectionReport from './ConnectionReport'

interface Row {
  t: number
  counts: number
  roundTripMs: number | null
  processingMs: number | null
  unaccountedMs: number | null
  onPolling: number
}

interface Payload {
  current: {
    roundTripMs: number | null
    processingMs: number | null
    unaccountedMs: number | null
    countsPerMinute: number
  }
  timeline: Row[]
}

type Key =
  | 'rtMs' | 'procMs' | 'unaccMs' | 'countsPerMin' | 'pollingReports'
  | 'postsPerSec' | 'p50' | 'p99' | 'p999' | 'maxMs' | 'fsyncP99' | 'sockets' | 'persistLag'
  | 'rejectedPerSec' | 'limitedPerSec' | 'dbRowsPerSec' | 'walMB'
  | 'cpuPct' | 'memPct' | 'load1' | 'netInMBs' | 'netOutMBs' | 'diskReadMBs' | 'diskWriteMBs'
  | 'rootUsedPct' | 'dbUsedPct'

type CurrentKey =
  | Key | 'rootFreeGB' | 'rootSizeGB' | 'dbFreeGB' | 'dbSizeGB' | 'memTotalGB' | 'cpus'
  | 'bootAt' | 'backupAt' | 'backupMB' | 'backupSec' | 'rootDaysLeft' | 'dbDaysLeft'
  | 'siteUptime' | 'socketUptime' | 'certDays'

interface ServerPayload {
  socketUp: boolean | null
  current: Partial<Record<CurrentKey, number | null>>
  cities: { name: string; ms: number | null; series: (number | null)[] }[]
  t: number[]
  series: Record<Key, (number | null)[]>
  stale?: boolean
}

interface Incident {
  title: string
  summary: string | null
  where: string | null
  start: number
  end: number | null
}

const CITY_COLORS = ['#42a5f5', '#66bb6a', '#ffa726', '#ab47bc', '#ef5350', '#26a69a']

const cityName = (n: string) => n.replace(/([a-z])([A-Z])/g, '$1 $2')

function fmtUptime(v: number | null | undefined): string {
  if (v == null) return '–'
  return v >= 99.995 ? '100' : v.toFixed(2)
}

const REFRESH_MS = 20_000
const WINDOWS = [30, 60, 180, 1440, 10080]

export const card: React.CSSProperties = {
  background: 'var(--surface-1)',
  border: '1px solid rgb(var(--ink-rgb) / 0.10)',
  borderRadius: 10,
  padding: '12px 14px',
}

export const tooltipStyle: React.CSSProperties = {
  background: 'var(--surface-0)', border: '1px solid rgb(var(--ink-rgb) / 0.15)',
  borderRadius: 8, fontSize: 12,
}

function verdict(ms: number | null): { label: string; color: string } {
  if (ms == null) return { label: 'No data', color: 'var(--ink-3)' }
  if (ms < 150) return { label: 'Good', color: 'var(--success)' }
  if (ms < 400) return { label: 'Sluggish', color: 'var(--warning, #d98324)' }
  return { label: 'Laggy', color: 'var(--danger)' }
}

function fmtMs(v: number | null | undefined): string {
  if (v == null) return '–'
  if (v < 1) return v.toFixed(2)
  if (v < 10) return v.toFixed(1)
  return String(Math.round(v))
}

function fmtNum(v: number | null | undefined, digits = 0): string {
  return v == null ? '–' : v.toFixed(digits)
}

function ago(sec: number | null | undefined): string {
  if (sec == null) return '–'
  const s = Math.max(0, Date.now() / 1000 - sec)
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400 * 2) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

function span(sec: number | null | undefined): string {
  if (sec == null) return '–'
  const s = Math.max(0, Date.now() / 1000 - sec)
  return s < 86400 * 2 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 86400)}d`
}

function diskSub(size: number | null | undefined, days: number | null | undefined): string | undefined {
  if (!size) return undefined
  const left = days != null && days < 3650 ? ` · ~${days < 2 ? days.toFixed(1) : Math.round(days)}d left` : ''
  return `of ${fmtNum(size)} GB${left}`
}

function duration(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60_000))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return h < 48 ? `${h}h ${m % 60}m` : `${Math.round(h / 24)}d`
}

function windowLabel(m: number): string {
  return m < 60 ? `${m}m` : m < 1440 ? `${m / 60}h` : `${m / 1440}d`
}

function timeLabel(t: number, minutes: number): string {
  const d = new Date(t)
  if (minutes > 1440) return d.toLocaleString([], { weekday: 'short', hour: '2-digit' })
  if (minutes > 180) return d.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function Stat({ label, value, unit, sub, color }: {
  label: string; value: string; unit?: string; sub?: string; color?: string
}) {
  return (
    <div style={card}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--ink-3)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color ?? 'var(--ink-1)', lineHeight: 1.25 }}>
        {value}<span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{sub}</div>}
    </div>
  )
}

export function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 12 }}>
      {children}
    </div>
  )
}

export function ChartCard({ title, height = 180, children }: { title: string; height?: number; children: React.ReactElement }) {
  return (
    <div style={{ ...card, padding: '12px 8px 4px', marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', padding: '0 8px' }}>{title}</div>
      <div style={{ width: '100%', height, marginTop: 8 }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  )
}

export const axis = { tick: { fontSize: 10, fill: 'var(--ink-3)' } }
export const grid = <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--ink-rgb) / 0.08)" />
export const margin = { top: 4, right: 12, bottom: 0, left: -12 }
const legend = <Legend wrapperStyle={{ fontSize: 11 }} />

export default function StatusClient({ staff = false, signedIn = false }: { staff?: boolean; signedIn?: boolean }) {
  const [data, setData] = useState<Payload | null>(null)
  const [server, setServer] = useState<ServerPayload | null>(null)
  const [incidents, setIncidents] = useState<{ incidents: Incident[]; days: number } | null>(null)
  const [minutes, setMinutes] = useState(60)

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.allSettled([
      fetch(`${API}/api/metrics/public?minutes=${Math.min(minutes, 180)}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/api/server-metrics?minutes=${minutes}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/api/status-incidents`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
    ])
    if (a.status === 'fulfilled' && a.value) setData(a.value)
    if (b.status === 'fulfilled' && b.value) setServer(b.value)
    if (c.status === 'fulfilled' && c.value) setIncidents(c.value)
  }, [minutes])

  useEffect(() => {
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  const s = server?.series
  const now = server?.current ?? {}
  const has = (k: Key) => !!s && s[k].some(x => x != null)
  const fromGrafana = has('rtMs')

  const cur = fromGrafana
    ? { roundTripMs: now.rtMs ?? null, processingMs: now.procMs ?? null, unaccountedMs: now.unaccMs ?? null, countsPerMinute: Math.round(now.countsPerMin ?? 0) }
    : data?.current
  const v = verdict(cur?.roundTripMs ?? null)

  const browserRows = fromGrafana && s
    ? (server?.t ?? []).map((t, i) => ({ label: timeLabel(t, minutes), processing: s.procMs[i], unaccounted: s.unaccMs[i] }))
    : (data?.timeline ?? []).map(r => ({ label: timeLabel(r.t, minutes), processing: r.processingMs, unaccounted: r.unaccountedMs }))
  const polling = fromGrafana && s
    ? Math.round(s.pollingReports.reduce<number>((a, x) => a + (x ?? 0), 0))
    : (data?.timeline ?? []).reduce((a, r) => a + r.onPolling, 0)

  const rows = (server?.t ?? []).map((t, i) => {
    const row: Record<string, number | string | null> = { label: timeLabel(t, minutes) }
    if (s) for (const k of Object.keys(s) as Key[]) row[k] = s[k][i]
    return row
  })
  const cities = server?.cities ?? []
  for (const c of cities) rows.forEach((row, i) => { row[`ping:${c.name}`] = c.series[i] })
  const hasSocket = has('postsPerSec') || has('sockets')

  const latencies = s ? (['p50', 'p99', 'p999', 'maxMs'] as Key[]).flatMap(k => s[k]).filter((x): x is number => x != null && x > 0) : []
  const lo = latencies.length ? 10 ** Math.floor(Math.log10(Math.min(...latencies))) : 0.1
  const hi = latencies.length ? 10 ** Math.ceil(Math.log10(Math.max(...latencies))) : 100
  const decades: number[] = []
  for (let d = lo; d <= hi * 1.001; d *= 10) decades.push(d)
  const socket = server?.socketUp
    ? { value: 'Online', color: 'var(--success)' }
    : hasSocket ? { value: 'Down', color: 'var(--danger)' } : null

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--ink-1)', flex: 1 }}>Status</h1>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {WINDOWS.map(m => (
            <button key={m} onClick={() => setMinutes(m)} style={{
              padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 999, cursor: 'pointer',
              border: '1px solid rgb(var(--ink-rgb) / 0.15)',
              background: minutes === m ? 'var(--accent, #1976d2)' : 'transparent',
              color: minutes === m ? '#fff' : 'var(--ink-2)',
            }}>
              {windowLabel(m)}
            </button>
          ))}
        </div>
      </div>

      <Grid>
        <Stat label="Right now" value={v.label} color={v.color} />
        <Stat label="Round trip" value={fmtNum(cur?.roundTripMs)} unit="ms" />
        <Stat label="Server" value={fmtNum(cur?.processingMs)} unit="ms" />
        <Stat label="Network etc." value={fmtNum(cur?.unaccountedMs)} unit="ms" />
        <Stat label="Counts / min" value={String(cur?.countsPerMinute ?? 0)} />
      </Grid>

      <ChartCard title="Round trip" height={240}>
        <AreaChart data={browserRows} margin={margin}>
          {grid}
          <XAxis dataKey="label" {...axis} minTickGap={40} />
          <YAxis {...axis} unit="ms" width={52} />
          <Tooltip contentStyle={tooltipStyle} />
          {legend}
          <Area type="monotone" dataKey="processing" name="Server" stackId="1"
            stroke="#42a5f5" fill="#42a5f5" fillOpacity={0.5} connectNulls={false} />
          <Area type="monotone" dataKey="unaccounted" name="Network etc." stackId="1"
            stroke="#ab47bc" fill="#ab47bc" fillOpacity={0.5} connectNulls={false} />
        </AreaChart>
      </ChartCard>

      {polling > 0 && (
        <div style={{ ...card, marginTop: 12, fontSize: 12, color: 'var(--ink-2)' }}>
          {polling} report{polling === 1 ? '' : 's'} from connections on HTTP long-polling instead of a websocket (~200ms slower per count).
        </div>
      )}

      {server && (now.siteUptime != null || cities.length > 0) && (
        <>
          <Grid>
            <Stat label="Site uptime (30d)" value={fmtUptime(now.siteUptime)} unit="%" />
            <Stat label="Socket uptime (30d)" value={fmtUptime(now.socketUptime)} unit="%" />
            {cities.map(c => (
              <Stat key={c.name} label={`Ping · ${cityName(c.name)}`} value={fmtNum(c.ms)} unit="ms" />
            ))}
            <Stat label="Cert expires in" value={now.certDays != null ? `${Math.floor(now.certDays)}d` : '–'} />
          </Grid>

          {cities.length > 0 && (
            <ChartCard title="Ping by city (ms)">
              <LineChart data={rows} margin={margin}>
                {grid}
                <XAxis dataKey="label" {...axis} minTickGap={40} />
                <YAxis {...axis} width={52} />
                <Tooltip contentStyle={tooltipStyle} />
                {legend}
                {cities.map((c, i) => (
                  <Line key={c.name} type="monotone" dataKey={`ping:${c.name}`} name={cityName(c.name)}
                    stroke={CITY_COLORS[i % CITY_COLORS.length]} dot={false} connectNulls />
                ))}
              </LineChart>
            </ChartCard>
          )}
        </>
      )}

      {hasSocket && s && (
        <>
          <Grid>
            {socket && <Stat label="Socket" value={socket.value} color={socket.color} />}
            <Stat label="Connected" value={fmtNum(now.sockets)} />
            <Stat label="Posts / sec" value={fmtNum(now.postsPerSec, 1)} />
            <Stat label="Post p50" value={fmtMs(now.p50)} unit="ms" />
            <Stat label="Post p99" value={fmtMs(now.p99)} unit="ms" />
          </Grid>

          <ChartCard title="Post latency (server, log scale)" height={220}>
            <LineChart data={rows} margin={margin}>
              {grid}
              <XAxis dataKey="label" {...axis} minTickGap={40} />
              <YAxis {...axis} unit="ms" width={58} scale="log" domain={[lo, hi]} ticks={decades} allowDataOverflow />
              <Tooltip contentStyle={tooltipStyle} formatter={(x) => `${fmtMs(Number(x))} ms`} />
              {legend}
              <Line type="monotone" dataKey="p50" name="p50" stroke="#42a5f5" dot={false} />
              <Line type="monotone" dataKey="p99" name="p99" stroke="#ab47bc" dot={false} />
              <Line type="monotone" dataKey="p999" name="p99.9" stroke="#ffa726" dot={false} />
              <Line type="monotone" dataKey="maxMs" name="max" stroke="#ef5350" dot={false} strokeDasharray="4 3" />
            </LineChart>
          </ChartCard>

          <ChartCard title="Traffic">
            <LineChart data={rows} margin={margin}>
              {grid}
              <XAxis dataKey="label" {...axis} minTickGap={40} />
              <YAxis yAxisId="l" {...axis} width={52} />
              <YAxis yAxisId="r" orientation="right" {...axis} width={44} />
              <Tooltip contentStyle={tooltipStyle} />
              {legend}
              <Line yAxisId="l" type="monotone" dataKey="postsPerSec" name="posts/s" stroke="#66bb6a" dot={false} />
              <Line yAxisId="l" type="monotone" dataKey="rejectedPerSec" name="rejected/s" stroke="#ef5350" dot={false} />
              <Line yAxisId="l" type="monotone" dataKey="limitedPerSec" name="rate limited/s" stroke="#ffa726" dot={false} />
              <Line yAxisId="r" type="stepAfter" dataKey="sockets" name="connected" stroke="#78909c" dot={false} />
            </LineChart>
          </ChartCard>

          <ChartCard title="Writes">
            <LineChart data={rows} margin={margin}>
              {grid}
              <XAxis dataKey="label" {...axis} minTickGap={40} />
              <YAxis yAxisId="l" {...axis} unit="ms" width={52} />
              <YAxis yAxisId="r" orientation="right" {...axis} width={44} />
              <Tooltip contentStyle={tooltipStyle} />
              {legend}
              <Line yAxisId="l" type="monotone" dataKey="fsyncP99" name="fsync p99 (ms)" stroke="#26a69a" dot={false} />
              <Line yAxisId="r" type="monotone" dataKey="dbRowsPerSec" name="MySQL rows/s" stroke="#42a5f5" dot={false} />
              <Line yAxisId="r" type="stepAfter" dataKey="persistLag" name="MySQL behind (posts)" stroke="#8d6e63" dot={false} />
            </LineChart>
          </ChartCard>
        </>
      )}

      {server && (
        <>
          <Grid>
            <Stat label="CPU" value={fmtNum(now.cpuPct)} unit="%" sub={now.cpus ? `${now.cpus} cores` : undefined} />
            <Stat label="Memory" value={fmtNum(now.memPct)} unit="%" sub={now.memTotalGB ? `of ${fmtNum(now.memTotalGB)} GB` : undefined} />
            <Stat label="Disk free" value={fmtNum(now.rootFreeGB)} unit=" GB" sub={diskSub(now.rootSizeGB, now.rootDaysLeft)} />
            <Stat label="DB disk free" value={fmtNum(now.dbFreeGB)} unit=" GB" sub={diskSub(now.dbSizeGB, now.dbDaysLeft)} />
            <Stat label="Last backup" value={ago(now.backupAt)}
              sub={now.backupMB ? `${fmtNum(now.backupMB / 1000, 1)} GB${now.backupSec != null ? ` in ${Math.max(1, Math.round(now.backupSec / 60))}m` : ''}` : undefined} />
            <Stat label="Uptime" value={span(now.bootAt)} />
          </Grid>

          <ChartCard title="Machine">
            <LineChart data={rows} margin={margin}>
              {grid}
              <XAxis dataKey="label" {...axis} minTickGap={40} />
              <YAxis yAxisId="l" {...axis} unit="%" width={52} domain={[0, 100]} />
              <YAxis yAxisId="r" orientation="right" {...axis} width={44} />
              <Tooltip contentStyle={tooltipStyle} />
              {legend}
              <Line yAxisId="l" type="monotone" dataKey="cpuPct" name="CPU %" stroke="#66bb6a" dot={false} />
              <Line yAxisId="l" type="monotone" dataKey="memPct" name="memory %" stroke="#42a5f5" dot={false} />
              <Line yAxisId="r" type="monotone" dataKey="load1" name="load" stroke="#ffa726" dot={false} />
            </LineChart>
          </ChartCard>

          <ChartCard title="Disk space used">
            <LineChart data={rows} margin={margin}>
              {grid}
              <XAxis dataKey="label" {...axis} minTickGap={40} />
              <YAxis {...axis} unit="%" width={52} domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} />
              {legend}
              <Line type="monotone" dataKey="rootUsedPct" name="system" stroke="#ab47bc" dot={false} />
              <Line type="monotone" dataKey="dbUsedPct" name="database" stroke="#26a69a" dot={false} />
            </LineChart>
          </ChartCard>

          <ChartCard title="I/O (MB/s)">
            <LineChart data={rows} margin={margin}>
              {grid}
              <XAxis dataKey="label" {...axis} minTickGap={40} />
              <YAxis {...axis} width={52} />
              <Tooltip contentStyle={tooltipStyle} />
              {legend}
              <Line type="monotone" dataKey="netInMBs" name="net in" stroke="#42a5f5" dot={false} />
              <Line type="monotone" dataKey="netOutMBs" name="net out" stroke="#66bb6a" dot={false} />
              <Line type="monotone" dataKey="diskReadMBs" name="disk read" stroke="#ffa726" dot={false} />
              <Line type="monotone" dataKey="diskWriteMBs" name="disk write" stroke="#ef5350" dot={false} />
            </LineChart>
          </ChartCard>
        </>
      )}
      {signedIn && <ConnectionReport />}
      {staff && <ClientHealthPanel />}
      {incidents && (
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}>
            Incidents ({incidents.days}d)
          </div>
          {incidents.incidents.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>None.</div>
          )}
          {incidents.incidents.map(inc => (
            <div key={`${inc.title}-${inc.where}-${inc.start}`} title={inc.summary ?? undefined}
              style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '6px 0', borderTop: '1px solid rgb(var(--ink-rgb) / 0.06)', fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, flex: 'none', alignSelf: 'center',
                background: inc.end == null ? 'var(--danger)' : 'var(--ink-3)' }} />
              <span style={{ flex: 1, color: 'var(--ink-1)', fontWeight: 600 }}>
                {inc.title}{inc.where && <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}> · {inc.where}</span>}
              </span>
              <span style={{ color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                {new Date(inc.start).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ width: 64, textAlign: 'right', whiteSpace: 'nowrap', color: inc.end == null ? 'var(--danger)' : 'var(--ink-2)' }}>
                {inc.end == null ? 'ongoing' : duration(inc.end - inc.start)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

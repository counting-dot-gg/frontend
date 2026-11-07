'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSocket } from '@/lib/socket'
import { card } from './StatusClient'

type Cause =
  | 'ok' | 'background' | 'server' | 'everyone' | 'dropped' | 'device' | 'internet'
  | 'route' | 'upload' | 'download' | 'connection' | 'polling' | 'unknown'

type EvidenceRow = [key: string, you: number | null, others: number | null]

interface DropRow { at: number; reason: string; side: 'client' | 'server'; downMs: number | null }

interface MinuteRow {
  t: number; cause: Cause
  rt: number | null; ping: number | null; up: number | null; down: number | null
  server: number | null; edge: number | null; counts: number
  loss?: number; vis?: number; drops?: DropRow[]; evidence?: EvidenceRow[]
}

interface Report {
  target: { uuid: string; username: string; self: boolean }
  from: number; to: number; window: number
  verdict: Cause; ours: boolean; measured: number; laggy: number
  causes: Partial<Record<Cause, number>>
  proof: MinuteRow | null
  usualEdge: number | null; colo: string | null; net: string | null
  minutes: MinuteRow[]
}

type Reply = Report | { error: 'signed_out' | 'forbidden' | 'not_found'; username?: string }

const CAUSES: Record<Cause, { label: string; color: string }> = {
  ok: { label: 'No lag', color: 'var(--success)' },
  background: { label: 'Background tab', color: '#8d6e63' },
  server: { label: 'Our server', color: '#e53935' },
  everyone: { label: 'Site-wide', color: '#d81b60' },
  route: { label: 'Cloudflare → us', color: '#8e24aa' },
  dropped: { label: 'Connection dropped', color: '#f4511e' },
  device: { label: 'Your device', color: '#fb8c00' },
  internet: { label: 'Your internet', color: '#f9a825' },
  upload: { label: 'Your upload', color: '#1e88e5' },
  download: { label: 'Your download', color: '#00897b' },
  connection: { label: 'Your connection', color: '#3949ab' },
  polling: { label: 'Fallback transport', color: '#6d4c41' },
  unknown: { label: 'Unclear', color: '#757575' },
}

const METRICS: Record<string, { label: string; unit: string }> = {
  roundTrip: { label: 'Count round trip', unit: 'ms' },
  server: { label: 'Server', unit: 'ms' },
  ping: { label: 'Ping', unit: 'ms' },
  upload: { label: 'You → server', unit: 'ms' },
  download: { label: 'Server → you', unit: 'ms' },
  edge: { label: 'You → Cloudflare', unit: 'ms' },
  pingLoss: { label: 'Pings lost', unit: '%' },
  mainThread: { label: 'Main thread lag', unit: 'ms' },
  blocked: { label: 'Page blocked', unit: 'ms' },
  visible: { label: 'Tab visible', unit: '%' },
  offline: { label: 'Offline', unit: 'ms' },
}

const REASONS: Record<string, string> = {
  ping_timeout: 'ping timeout',
  transport_close: 'connection closed',
  transport_error: 'connection error',
  heartbeat_timeout: 'heartbeat timeout',
  io_server_disconnect: 'server closed it',
  io_client_disconnect: 'closed',
  closing_server: 'server restart',
  client_disconnect: 'closed',
  server_disconnect: 'server closed it',
}

const WINDOWS = [60, 180, 360, 1440]
const REFRESH_MS = 30_000

const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const ms = (v: number | null | undefined, unit = 'ms') =>
  v == null ? '—' : unit === 'ms' && v >= 1000 ? `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}s` : `${Math.round(v)}${unit}`
const winLabel = (m: number) => (m < 60 ? `${m}m` : `${m / 60}h`)

function Chip({ cause, n }: { cause: Cause; n?: number }) {
  const c = CAUSES[cause]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)' }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color }} />
      {c.label}{n != null && <b style={{ color: 'var(--ink-1)' }}>{n}</b>}
    </span>
  )
}

function Strip({ minutes, from, to, selected, onPick }: {
  minutes: MinuteRow[]; from: number; to: number; selected: number | null; onPick: (t: number) => void
}) {
  const total = Math.max(1, to - from)
  return (
    <div style={{ position: 'relative', height: 22, borderRadius: 4, background: 'rgb(var(--ink-rgb) / 0.06)', marginTop: 10, overflow: 'hidden' }}>
      {minutes.map(m => (
        <button
          key={m.t}
          type="button"
          onClick={() => onPick(m.t)}
          title={`${clock(m.t)} · ${CAUSES[m.cause].label} · ${ms(m.rt ?? m.ping)}`}
          style={{
            position: 'absolute', top: 0, bottom: 0, padding: 0, border: 'none', cursor: 'pointer',
            left: `${((m.t - from) / total) * 100}%`, width: `max(2px, ${(60_000 / total) * 100}%)`,
            background: m.cause === 'ok' ? 'rgb(var(--ink-rgb) / 0.18)' : CAUSES[m.cause].color,
            outline: selected === m.t ? '2px solid var(--ink-1)' : 'none', outlineOffset: -2,
          }}
        />
      ))}
    </div>
  )
}

function Proof({ m }: { m: MinuteRow }) {
  const rows = m.evidence ?? []
  const worst = Math.max(1, ...rows.flatMap(([, y, o]) => [y ?? 0, o ?? 0]))
  return (
    <div style={{ ...card, marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Chip cause={m.cause} />
        <span style={{ fontSize: 12, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{clock(m.t)}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, auto) 1fr auto auto', gap: '6px 10px', marginTop: 10, alignItems: 'center', fontSize: 12.5 }}>
        <span />
        <span />
        <span style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'right' }}>you</span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'right' }}>others</span>
        {rows.map(([key, you, others]) => {
          const meta = METRICS[key] ?? { label: key, unit: 'ms' }
          const bad = you != null && others != null && you > Math.max(2 * others, others + 150)
          const scale = meta.unit === '%' ? 100 : worst
          return [
            <span key={`${key}l`} style={{ color: 'var(--ink-2)' }}>{meta.label}</span>,
            <span key={`${key}b`} style={{ display: 'grid', gap: 2 }}>
              <span style={{ height: 6, borderRadius: 3, width: `${Math.min(100, ((you ?? 0) / scale) * 100)}%`, background: bad ? 'var(--danger)' : 'var(--ink-2)' }} />
              {others != null && <span style={{ height: 6, borderRadius: 3, width: `${Math.min(100, (others / scale) * 100)}%`, background: 'rgb(var(--ink-rgb) / 0.25)' }} />}
            </span>,
            <b key={`${key}y`} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: bad ? 'var(--danger)' : 'var(--ink-1)' }}>{ms(you, meta.unit)}</b>,
            <span key={`${key}o`} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--ink-3)' }}>{ms(others, meta.unit)}</span>,
          ]
        })}
      </div>
      {m.drops && m.drops.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {m.drops.map(d => (
            <span key={`${d.side}${d.at}`} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'rgb(var(--ink-rgb) / 0.08)', color: 'var(--ink-2)' }}>
              {clock(d.at)} · {d.side === 'server' ? 'server saw' : 'you saw'} {REASONS[d.reason] ?? d.reason}{d.downMs != null && ` · ${ms(d.downMs)}`}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ConnectionReport({ username }: { username?: string }) {
  const [minutes, setMinutes] = useState(username ? 360 : 60)
  const [reply, setReply] = useState<Reply | null>(null)
  const [picked, setPicked] = useState<number | null>(null)

  useEffect(() => {
    const socket = getSocket()
    const want = username?.toLowerCase()
    const onReport = (r: Reply) => {
      if ('error' in r) {
        if (!want || r.username?.toLowerCase() === want || r.error !== 'not_found') setReply(r)
        return
      }
      if (want ? r.target.username.toLowerCase() === want : r.target.self) setReply(r)
    }
    const ask = () => socket.emit('connection_check', { minutes, ...(username ? { username } : {}) })
    socket.on('connection_report', onReport)
    socket.on('connect', ask)
    if (!socket.connected) socket.connect()
    ask()
    const timer = window.setInterval(ask, REFRESH_MS)
    return () => {
      window.clearInterval(timer)
      socket.off('connection_report', onReport)
      socket.off('connect', ask)
    }
  }, [minutes, username])

  const report = reply && !('error' in reply) ? reply : null
  const shown = useMemo(() => {
    if (!report) return null
    return report.minutes.find(m => m.t === picked) ?? report.proof
  }, [report, picked])

  if (reply && 'error' in reply) {
    if (reply.error === 'signed_out') return null
    return <div style={{ ...card, marginTop: 12, fontSize: 13, color: 'var(--danger)' }}>{reply.error === 'not_found' ? 'No such counter' : 'Forbidden'}</div>
  }

  const verdict = report ? CAUSES[report.verdict] : null
  const causes = report ? (Object.entries(report.causes) as [Cause, number][]).sort((a, b) => b[1] - a[1]) : []

  return (
    <div style={{ ...card, marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>{username ?? 'Your connection'}</span>
          {verdict && (
            <span style={{ fontSize: 20, fontWeight: 800, color: report?.verdict === 'ok' ? 'var(--success)' : verdict.color }}>{verdict.label}</span>
          )}
          {report && report.measured > 0 && (
            <span style={{ fontSize: 12, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{report.laggy} / {report.measured} min</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {WINDOWS.filter(w => username || w <= 360).map(w => (
            <button key={w} type="button" onClick={() => { setMinutes(w); setPicked(null) }} style={{
              border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: w === minutes ? 'var(--primary)' : 'rgb(var(--ink-rgb) / 0.06)',
              color: w === minutes ? 'var(--primary-foreground)' : 'var(--ink-2)',
            }}>{winLabel(w)}</button>
          ))}
        </div>
      </div>

      {!report && <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 8 }}>…</div>}
      {report && report.measured === 0 && <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 8 }}>No data</div>}

      {report && report.measured > 0 && (
        <>
          <Strip minutes={report.minutes} from={report.from} to={report.to} selected={shown?.t ?? null} onPick={setPicked} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            <span>{clock(report.from)}</span>
            <span style={{ display: 'flex', gap: 10 }}>
              {report.colo && <span>{report.colo}</span>}
              {report.net && <span>{report.net}</span>}
              {report.usualEdge != null && <span>→ Cloudflare {ms(report.usualEdge)}</span>}
            </span>
            <span>{clock(report.to)}</span>
          </div>
          {causes.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 10 }}>
              {causes.map(([c, n]) => <Chip key={c} cause={c} n={n} />)}
            </div>
          )}
          {shown && shown.cause !== 'ok' && <Proof m={shown} />}
        </>
      )}
    </div>
  )
}

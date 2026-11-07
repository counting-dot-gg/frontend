'use client'

import { avatarUrl, medal, displayName, type CounterInfo } from '@/lib/counterUtils'

export function CounterCell({ counter }: { counter: CounterInfo }) {
  const av = avatarUrl(counter)
  const name = displayName(counter)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
        {av
          ? <img src={av} alt="" width={20} height={20} style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: 20, height: 20, borderRadius: '50%', background: (counter.color || '#888') + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: counter.color || '#888' }}>
              {counter.username.slice(0, 2).toUpperCase()}
            </div>
        }
      </div>
      <a
        href={`/counter/${counter.username}`}
        style={{ color: counter.color || 'var(--ink-1)', textDecoration: 'none', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
      >
        {name}
      </a>
    </div>
  )
}

interface LeaderboardTableProps {
  lb: Record<string, number>
  counters: Map<string, CounterInfo>
  label: string
}

export function LeaderboardTable({ lb, counters, label }: LeaderboardTableProps) {
  const rows = Object.entries(lb)
    .map(([uuid, n]) => ({ counter: counters.get(uuid), n }))
    .filter((r): r is { counter: CounterInfo; n: number } => !!r.counter)
    .sort((a, b) => b.n - a.n)

  if (rows.length === 0) return <Empty>No {label} data.</Empty>

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
      <table style={{ width: '100%', minWidth: 280, borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 36 }} />
          <col />
          <col style={{ width: 90 }} />
        </colgroup>
        <thead>
          <tr style={{ borderBottom: '1px solid rgb(var(--ink-rgb) / 0.08)' }}>
            <th style={th}>#</th>
            <th style={{ ...th, textAlign: 'left' }}>Counter</th>
            <th style={{ ...th, textAlign: 'right' }}>{label}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const m = medal(i + 1)
            return (
              <tr key={row.counter.uuid} style={{ borderBottom: '1px solid rgb(var(--ink-rgb) / 0.04)' }}>
                <td style={{
                  padding: '5px 8px', textAlign: 'center',
                  background: m?.bg ?? 'transparent', color: m?.color ?? 'var(--ink-3)',
                  fontWeight: m ? 700 : 400, fontSize: 12,
                }}>{i + 1}</td>
                <td style={{ padding: '5px 8px', overflow: 'hidden' }}><CounterCell counter={row.counter} /></td>
                <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', color: 'var(--ink-2)' }}>
                  {row.n.toLocaleString()}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--ink-3)' }}>
      {label}
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        max={new Date(Date.now() - 86400000).toISOString().slice(0, 10)}
        style={{
          padding: '5px 8px', fontSize: 12, borderRadius: 6,
          background: 'rgb(var(--ink-rgb) / 0.06)', border: '1px solid rgb(var(--ink-rgb) / 0.15)',
          color: 'var(--ink-1)', outline: 'none', cursor: 'pointer',
        }}
      />
    </label>
  )
}

export function NumInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--ink-3)' }}>
      {label}
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: 100, padding: '5px 8px', fontSize: 12, borderRadius: 6,
          background: 'rgb(var(--ink-rgb) / 0.06)', border: '1px solid rgb(var(--ink-rgb) / 0.15)',
          color: 'var(--ink-1)', outline: 'none',
        }}
      />
    </label>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: '12px 0' }}>{children}</div>
}

export function Spinner() {
  return <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: '12px 0' }}>Loading…</div>
}

export const th: React.CSSProperties = {
  padding: '5px 8px', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center',
}

export interface AccuracyRow {
  counter: string
  counts: number
  mistakes: number
  accuracy: number
  score: number
}

export function AccuracyTable({
  rows,
  counters,
}: {
  rows: AccuracyRow[]
  counters: Map<string, CounterInfo>
}) {
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`
  return (
    <div>
      <div style={{ fontSize: 12, color: 'rgb(var(--ink-rgb) / 0.55)', marginBottom: 12, lineHeight: 1.5 }}>
        Sorted by <strong style={{ color: 'var(--ink-2)', fontWeight: 600 }}>Score</strong>: the
        accuracy we are <strong style={{ color: 'var(--ink-2)', fontWeight: 600 }}>95% confident
        you are at least at</strong>. It is the 5th percentile of a Bayesian (Beta) posterior,
        starting from how accuracy is actually spread on this thread and updating it with your
        record — so a short perfect run scores below a long near-perfect one, because less of it
        is proven.
      </div>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
        <table style={{ width: '100%', minWidth: 580, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgb(var(--ink-rgb) / 0.08)' }}>
              <th style={th}>#</th>
              <th style={{ ...th, textAlign: 'left' }}>Counter</th>
              <th style={{ ...th, textAlign: 'right' }}>Accuracy</th>
              <th
                style={{ ...th, textAlign: 'right' }}
                title="95% Bayesian lower bound: the 5th percentile of a Beta posterior, using a prior fitted to this thread's own accuracy distribution."
              >
                Score
                <div style={{ fontSize: 9, fontWeight: 400, letterSpacing: '0.04em', opacity: 0.65, textTransform: 'none' }}>
                  95% lower bound
                </div>
              </th>
              <th style={{ ...th, textAlign: 'right' }}>Counts</th>
              <th style={{ ...th, textAlign: 'right' }}>Mistakes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const counter = counters.get(r.counter)
              const m = medal(i + 1)
              return (
                <tr key={r.counter} style={{ borderBottom: '1px solid rgb(var(--ink-rgb) / 0.04)' }}>
                  <td style={{
                    padding: '5px 8px', textAlign: 'center', width: 36,
                    background: m?.bg ?? 'transparent', color: m?.color ?? '#666',
                    fontWeight: m ? 700 : 400, fontSize: 12,
                  }}>{i + 1}</td>
                  <td style={{ padding: '5px 8px' }}>
                    {counter
                      ? <CounterCell counter={counter} />
                      : <span style={{ color: '#555', fontSize: 12 }}>{r.counter.slice(0, 8)}</span>}
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--ink-3)' }}>
                    {pct(r.accuracy)}
                  </td>
                  <td
                    title={`95% confident of at least ${pct(r.score)}, from ${(r.counts + r.mistakes).toLocaleString()} attempts`}
                    style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--ink-1)' }}
                  >
                    {pct(r.score)}
                  </td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', color: '#666', fontSize: 12 }}>{r.counts.toLocaleString()}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', color: '#666', fontSize: 12 }}>{r.mistakes.toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start',
        padding: '14px 16px', borderRadius: 8,
        background: 'rgb(220 38 38 / 0.08)',
        border: '1px solid rgb(220 38 38 / 0.35)',
        color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.5,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span aria-hidden style={{ color: 'var(--danger)', fontWeight: 700 }}>!</span>
        <span>{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            background: 'rgb(var(--ink-rgb) / 0.06)',
            border: '1px solid rgb(var(--ink-rgb) / 0.18)',
            color: 'var(--ink-2)',
          }}
        >
          Try again
        </button>
      )}
    </div>
  )
}

export async function describeHttpFailure(res: Response, what: string): Promise<string> {
  if (res.status === 404) return `No ${what} exist for this thread yet (404).`
  if (res.status === 401 || res.status === 403) return `You do not have access to this ${what} (${res.status}).`
  if (res.status === 429) return `Too many requests; wait a moment and try again (429).`
  if (res.status >= 500) return `The stats service failed while loading ${what} (${res.status}).`
  return `Could not load ${what}; the server said ${res.status}.`
}

export function describeNetworkFailure(err: unknown, what: string): string {
  const detail = err instanceof Error && err.message ? ` (${err.message})` : ''
  return `Could not reach the stats service to load ${what}. It may be restarting... try again in a moment.${detail}`
}

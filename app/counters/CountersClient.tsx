'use client'

import { useRouter } from 'next/navigation'
import { avatarUrl } from '@/lib/counterUtils'
import { calculateLevel, MAX_LEVEL } from '@/lib/levels'

interface Counter {
  uuid: string
  discordId: string
  name: string
  username: string
  color: string
  roles: string[]
  avatar: string
  emoji?: string
  title?: string
  xp: number
  pronouns?: [string, string, string, string]
}

interface Props {
  counters: Counter[]
  page: number
  totalPages: number
  totalCount: number
}


const MAX = Number(MAX_LEVEL.level)

function levelColor(level: number): string {
  if (level >= MAX) return '#f59e0b'
  if (level > MAX * 0.8) return 'var(--success)'
  if (level > MAX * 0.4) return '#a855f7'
  return '#3b82f6'
}

function roleBadge(roles: string[]): { label: string; color: string; bg: string } | null {
  if (roles.includes('admin')) return { label: 'Admin', color: '#000', bg: 'gold' }
  if (roles.includes('mod'))   return { label: 'Mod', color: '#000', bg: '#86efac' }
  return null
}

function CounterRow({ counter }: { counter: Counter }) {
  const avatar = avatarUrl(counter)
  const level = Number(calculateLevel(counter.xp).level)
  const lvlColor = levelColor(level)
  const badge = roleBadge(counter.roles)
  const displayName = counter.emoji
    ? `${counter.emoji} ${counter.name} ${counter.emoji}`
    : counter.name
  const pronounsLabel = Array.isArray(counter.pronouns) && counter.pronouns.length >= 2
    ? `${counter.pronouns[0]}/${counter.pronouns[1]}`
    : null

  return (
    <a
      href={`/counter/${counter.username}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
        borderBottom: '1px solid rgb(var(--ink-rgb) / 0.05)',
        textDecoration: 'none', color: 'inherit',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.04)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: (counter.color || '#888') + '33', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {avatar
          ? <img src={avatar} alt="" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
          : <span style={{ fontSize: 10, fontWeight: 700, color: counter.color || '#888' }}>{counter.username.slice(0, 2).toUpperCase()}</span>
        }
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: counter.color || '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </span>
          <span style={{ fontSize: 12, color: '#555' }}>@{counter.username}</span>
          {pronounsLabel && (
            <span style={{ fontSize: 10, color: '#555', border: '1px solid rgb(var(--ink-rgb) / 0.12)', borderRadius: 4, padding: '1px 4px' }}>
              {pronounsLabel}
            </span>
          )}
        </div>
        {counter.title && (
          <div style={{ fontSize: 11, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {counter.title}
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        {badge && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: badge.bg, color: badge.color }}>
            {badge.label}
          </span>
        )}
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
          background: lvlColor + '22', color: lvlColor, border: `1px solid ${lvlColor}44`,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {level}
        </span>
      </div>
    </a>
  )
}

function Paginator({ page, totalPages }: { page: number; totalPages: number }) {
  const router = useRouter()

  const go = (p: number) => router.push(`/counters?page=${p}`)

  const pages = buildPageList(page, totalPages)

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
      <PageBtn label="«" disabled={page <= 1}       onClick={() => go(1)} />
      <PageBtn label="‹" disabled={page <= 1}       onClick={() => go(page - 1)} />
      {pages.map((p, i) =>
        p === null
          ? <span key={`ellipsis-${i}`} style={{ padding: '4px 6px', color: '#555', fontSize: 13 }}>…</span>
          : <PageBtn key={p} label={String(p)} active={p === page} onClick={() => go(p)} />
      )}
      <PageBtn label="›" disabled={page >= totalPages} onClick={() => go(page + 1)} />
      <PageBtn label="»" disabled={page >= totalPages} onClick={() => go(totalPages)} />
    </div>
  )
}

function PageBtn({ label, active, disabled, onClick }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 32, padding: '4px 8px', borderRadius: 6, fontSize: 13, fontWeight: active ? 700 : 400,
        border: active ? '1px solid #f97316' : '1px solid rgb(var(--ink-rgb) / 0.12)',
        background: active ? 'rgba(249,115,22,0.15)' : 'transparent',
        color: active ? '#f97316' : disabled ? '#444' : '#aaa',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function buildPageList(current: number, total: number): (number | null)[] {
  if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1)
  const set = new Set<number>()
  ;[1, 2, current - 1, current, current + 1, total - 1, total].forEach(p => {
    if (p >= 1 && p <= total) set.add(p)
  })
  const sorted = Array.from(set).sort((a, b) => a - b)
  const result: (number | null)[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push(null)
    result.push(sorted[i])
  }
  return result
}

export default function CountersClient({ counters, page, totalPages, totalCount }: Props) {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Counters</h1>
        <span style={{ fontSize: 13, color: '#555' }}>{totalCount.toLocaleString()} total</span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Paginator page={page} totalPages={totalPages} />
      </div>

      <div style={{ border: '1px solid rgb(var(--ink-rgb) / 0.08)', borderRadius: 8, overflow: 'hidden' }}>
        {counters.length === 0
          ? <div style={{ padding: 24, fontSize: 13, color: '#555', textAlign: 'center' }}>No counters found.</div>
          : counters.map(c => <CounterRow key={c.uuid} counter={c} />)
        }
      </div>

      <div style={{ marginTop: 16 }}>
        <Paginator page={page} totalPages={totalPages} />
      </div>
    </div>
  )
}

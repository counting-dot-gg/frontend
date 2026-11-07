'use client'

import { useSyncExternalStore } from 'react'
import { readFeats, readFeatsServer, subscribeFeats, type Feat, type FeatPerson } from '@/lib/feats'
import { avatarUrl } from '@/lib/counterUtils'
import { RankIconBadge } from '@/components/rank/RankIconBadge'

export default function FeatsPanel({ height }: { height: number }) {
  const feats = useSyncExternalStore(subscribeFeats, readFeats, readFeatsServer)

  return (
    <div style={{ height, overflowY: 'auto', padding: '4px 0' }}>
      {feats.length === 0 ? (
        <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-3)', textAlign: 'center' }}>Nothing yet</div>
      ) : (
        feats.map((f, i) => {
          const day = dayLabel(f.at)
          const showDay = i === 0 || dayLabel(feats[i - 1].at) !== day
          return (
            <div key={f.key + f.at}>
              {showDay && (
                <div style={{
                  padding: '8px 12px 2px', fontSize: 10, fontWeight: 700,
                  color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.4,
                }}>
                  {day}
                </div>
              )}
              <FeatRow feat={f} />
            </div>
          )
        })
      )}
    </div>
  )
}

const people = (feat: Feat): FeatPerson[] =>
  Array.isArray(feat.who) ? feat.who : feat.who ? [feat.who] : []

function FeatRow({ feat }: { feat: Feat }) {
  const who = people(feat)
  const time = (
    <time
      dateTime={new Date(feat.at).toISOString()}
      title={new Date(feat.at).toLocaleString()}
      style={{ fontSize: 11, color: 'var(--ink-3)', flexShrink: 0, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}
    >
      {new Date(feat.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
    </time>
  )
  const body = (
    <>
      <Avatars who={who} size={28} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
          <Names who={who} wrap />
          {time}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 5, minWidth: 0 }}>
          <Mark feat={feat} />
          <span style={{ fontWeight: 600 }}>{feat.text}</span>
          <Where feat={feat} wrap />
        </span>
      </span>
    </>
  )
  const style = {
    display: 'flex', alignItems: 'flex-start', gap: 9, padding: '6px 12px',
    fontSize: 12.5, color: 'var(--ink-1)', textDecoration: 'none',
  } as const
  return feat.href
    ? <a href={feat.href} style={style}>{body}</a>
    : <div style={style}>{body}</div>
}

export function FeatLine({ feat }: { feat: Feat }) {
  const who = people(feat)
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      {who.length > 0 && <Avatars who={who} size={20} />}
      <Names who={who} max={who.length > 1 ? 220 : 150} />
      <Mark feat={feat} />
      <span style={{ fontWeight: 600, flexShrink: 0 }}>{feat.text}</span>
      <Where feat={feat} />
    </span>
  )
}

function Avatar({ who, size }: { who: FeatPerson; size: number }) {
  const src = who.discordId && who.avatar ? avatarUrl({ discordId: who.discordId, avatar: who.avatar }, size > 16 ? 64 : 32) : undefined
  return src
    ? <img src={src} alt="" width={size} height={size} style={{ borderRadius: '50%', flexShrink: 0 }} />
    : <span style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: who.color || 'rgb(var(--ink-rgb) / 0.2)' }} />
}

function Avatars({ who, size }: { who: FeatPerson[]; size: number }) {
  if (who.length === 0) return <span style={{ width: size, flexShrink: 0 }} />
  const shown = who.slice(0, 3)
  return (
    <span style={{ display: 'flex', flexShrink: 0 }}>
      {shown.map((p, i) => (
        <span key={p.uuid} style={{
          marginLeft: i ? -size * 0.35 : 0, borderRadius: '50%', display: 'flex',
          boxShadow: i ? '0 0 0 2px var(--surface-raised)' : undefined,
        }}>
          <Avatar who={p} size={size} />
        </span>
      ))}
    </span>
  )
}

function Names({ who, max, wrap = false }: { who: FeatPerson[]; max?: number; wrap?: boolean }) {
  if (who.length === 0) return null
  return (
    <b style={wrap ? { minWidth: 0, flex: 1, overflowWrap: 'anywhere' } : {
      minWidth: 0, maxWidth: max, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      flexShrink: 1,
    }}>
      {who.map((p, i) => (
        <span key={p.uuid}>
          {i > 0 && <span style={{ color: 'var(--ink-3)' }}>, </span>}
          <span style={{ color: p.color || 'var(--ink-1)' }}>{p.name}</span>
        </span>
      ))}
    </b>
  )
}

function Mark({ feat }: { feat: Feat }) {
  if (!feat.rank) return null
  return (
    <span style={{ flexShrink: 0, display: 'flex' }}>
      <RankIconBadge rank={feat.rank.rank} division={feat.rank.division as 1 | 2 | 3} size="mini" />
    </span>
  )
}

function Where({ feat, wrap = false }: { feat: Feat; wrap?: boolean }) {
  if (!feat.where) return null
  return (
    <span style={wrap
      ? { color: 'var(--ink-3)', minWidth: 0, overflowWrap: 'anywhere' }
      : { color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
      {feat.where}
    </span>
  )
}

function dayLabel(ms: number): string {
  const d = new Date(ms)
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

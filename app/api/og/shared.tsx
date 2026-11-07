import { LOGO_DATA_URI } from './logo'

export const CARD_SKY =
  'linear-gradient(180deg, #141d38 0%, #232c52 32%, #3d4470 58%, #6b5570 76%, #3c5636 84%, #223727 100%)'

export const PANEL_BG = 'rgba(8,10,18,0.82)'
export const PANEL_BORDER = '2px solid rgba(255,255,255,0.14)'

export const ACCENT = '#f97316'

export function Eyebrow({ children }: { children: string }) {
  return (
    <div style={{
      display: 'flex', fontSize: 28, fontWeight: 800, letterSpacing: '0.2em',
      color: 'rgba(249,115,22,0.95)', marginBottom: 10,
      textShadow: '0 2px 12px rgba(0,0,0,0.6)',
    }}>
      {children}
    </div>
  )
}
export const GOOD = '#5ddc72'
export const BAD = '#ff5f52'

export function SunGlow() {
  return (
    <div style={{
      position: 'absolute', bottom: 40, right: 120,
      width: 620, height: 620, borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(246,183,116,0.20) 0%, rgba(239,154,92,0.06) 45%, transparent 68%)',
      display: 'flex',
    }} />
  )
}

export function Scrim() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(100deg, rgba(6,8,16,0.88) 0%, rgba(6,8,16,0.72) 42%, rgba(6,8,16,0.34) 78%, rgba(6,8,16,0.22) 100%)',
      display: 'flex',
    }} />
  )
}

export function CardHeader({ subject, right }: { subject: string; right?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '30px 52px 0', position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, minWidth: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_DATA_URI} width={150} height={84} />
        <div style={{ width: 2, height: 58, background: 'rgba(255,255,255,0.24)', display: 'flex' }} />
        <div style={{
          fontSize: 54, fontWeight: 900, color: '#fff',
          letterSpacing: '-0.02em', textShadow: '0 3px 16px rgba(0,0,0,0.55)',
          overflow: 'hidden', whiteSpace: 'nowrap',
        }}>
          {subject}
        </div>
      </div>
      {right && (
        <div style={{
          fontSize: 30, fontWeight: 800, color: 'rgba(255,255,255,0.92)',
          letterSpacing: '0.03em', textShadow: '0 3px 14px rgba(0,0,0,0.65)',
          flexShrink: 0, marginLeft: 24,
        }}>
          {right}
        </div>
      )}
    </div>
  )
}

function estimateWidth(text: string): number {
  let w = 0
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') w += 56
    else if (ch === ' ') w += 26
    else if (ch === '.' || ch === ',' || ch === ':' || ch === ';') w += 26
    else if ('/|!il'.includes(ch)) w += 30
    else if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) w += 64
    else w += 54
  }
  return Math.max(1, w)
}

export function Headline({ children, max = 208, maxWidth = 660 }: {
  children: string
  max?: number
  maxWidth?: number
}) {
  const text = children ?? ''
  const w100 = estimateWidth(text)

  const oneLine = Math.floor((maxWidth * 100) / w100)
  const wraps = oneLine < 72
  const size = Math.max(
    28,
    Math.min(max, wraps ? Math.floor((maxWidth * 1.75 * 100) / w100) : oneLine),
  )

  return (
    <div style={{
      display: 'flex', maxWidth,
      fontSize: size, fontWeight: 900, color: '#fff',
      letterSpacing: size > 90 ? '-0.05em' : '-0.02em',
      lineHeight: wraps ? 1.05 : 0.95,
      textShadow: '0 6px 34px rgba(0,0,0,0.5)',
    }}>
      {text}
    </div>
  )
}

export function StatPanel({ items }: {
  items: { label: string; value: string; accent?: string }[]
}) {
  if (!items.length) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', gap: 34,
      alignSelf: 'flex-start',
      padding: '16px 26px', borderRadius: 16,
      background: PANEL_BG, border: PANEL_BORDER,
    }}>
      {items.map(({ label, value, accent }) => (
        <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.72)' }}>
            {label}
          </div>
          <div style={{ fontSize: 46, fontWeight: 900, color: accent || '#fff' }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  )
}

export function PersonChip({ name, color, avatar, size = 64 }: {
  name: string
  color?: string
  avatar?: string
  size?: number
}) {
  const c = color || '#e6e9f0'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: `8px 22px 8px 8px`, borderRadius: 999,
      background: PANEL_BG, border: PANEL_BORDER, borderLeft: `6px solid ${c}`,
    }}>
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} width={size} height={size} style={{ borderRadius: '50%', flexShrink: 0 }} />
      ) : (
        <div style={{
          width: size, height: size, borderRadius: '50%', flexShrink: 0,
          background: c + '44',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.4, fontWeight: 900, color: '#fff',
        }}>
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <span style={{
        fontSize: 38, fontWeight: 900, color: '#fff',
        whiteSpace: 'nowrap', letterSpacing: '-0.01em',
      }}>
        {name}
      </span>
    </div>
  )
}

export function avatarUrl(c: { discordId?: string; avatar?: string }): string | undefined {
  return c.discordId && c.avatar && c.avatar.length > 5
    ? `https://cdn.discordapp.com/avatars/${c.discordId}/${c.avatar}`
    : undefined
}

export function cardShellStyle(): React.CSSProperties {
  return {
    width: '1200px', height: '630px',
    background: CARD_SKY,
    display: 'flex', flexDirection: 'column',
    fontFamily: 'monospace',
    position: 'relative', overflow: 'hidden',
  }
}

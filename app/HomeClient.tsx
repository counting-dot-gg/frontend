'use client'

import { memo, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MsCoverageExplorer } from './MsCoverageExplorer'
import { getSocket } from '@/lib/socket'
import { isDecimalValidationType } from '@/lib/validationTypes'
import { standardizeCountFormat } from '@/lib/postHelpers'
import { formatDurationShort, formatDurationFull } from '@/lib/duration'
import { avatarUrl, medal } from '@/lib/counterUtils'
import { easternHourFraction, skyAt } from '@/lib/daylight'
import SkyBodies from '@/components/home/SkyBodies'
import Campground, { type Camper, countsToScale, treeGrowth, MAX_CAMPERS } from '@/components/home/Campground'
import SkyWisdom from '@/components/home/SkyWisdom'

const PHASE_POLL_MS = 60_000

const STACK_BELOW = 1024

const PARK_PEEK_PX = 460
import type { LatestCount, BlogSummary } from './page'
import { blogPath, parseBlogTimestamp } from '@/lib/blogUrl'
import { truncatedPercent } from '@/lib/pct'

const BLOG_DATE_FMT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/New_York',
})

function blogDate(timestamp: string): string {
  const d = parseBlogTimestamp(timestamp)
  return d ? BLOG_DATE_FMT.format(d) : ''
}

const LATEST_FLUSH_MS = 100

const MAX_RAW_COUNT_CHARS = 14

function displayCount(latest: LatestCount | undefined, validationType?: string, format?: string): string | null {
  if (!latest) return null
  const decimal = isDecimalValidationType(validationType)
  const raw = latest.rawCount?.trim()

  if (raw && raw.length <= MAX_RAW_COUNT_CHARS) {
    const mode = format && format !== 'Disabled' ? format : 'Commas'
    return decimal ? standardizeCountFormat(raw, mode, validationType) : raw
  }
  if (latest.validCountNumber != null) return latest.validCountNumber.toLocaleString()
  return raw ?? null
}

import { API } from '@/lib/apiBase'

const SLANT = 'polygon(20px 0, 100% 0, calc(100% - 20px) 100%, 0 100%)'

const PRIMARY = [
  {
    href: '/thread/main',
    label: 'COUNT',
    stroke: '5px',
    color: '#f97316',
    glow: 'rgba(249,115,22,0.8)',
    clip: SLANT,
    fontSize: 'clamp(44px, 6.8vw, 84px)',
    height: 104,
    padX: 56,
    weight: 2,
  },
  {
    href: '/threads',
    label: 'THREADS',
    stroke: '3.5px',
    color: '#a78bfa',
    glow: 'rgba(167,139,250,0.7)',
    clip: SLANT,
    fontSize: 'clamp(18px, 3.4vw, 42px)',
    height: 56,
    padX: 40,
    weight: 1,
  },
  {
    href: '/stats',
    label: 'STATS',
    stroke: '3.5px',
    color: '#38bdf8',
    glow: 'rgba(56,189,248,0.7)',
    clip: SLANT,
    fontSize: 'clamp(24px, 3.6vw, 44px)',
    height: 56,
    padX: 44,
    weight: 1,
  },
]

const SECONDARY = [
  {
    href: '/rank',
    label: 'RANK',
    stroke: '3.5px',
    color: '#a78bfa',
    glow: 'rgba(167,139,250,0.7)',
    clip: SLANT,
    fontSize: 'clamp(24px, 3.6vw, 44px)',
    height: 56,
    padX: 44,
    weight: 1,
  },
  {
    href: '/shop',
    label: 'SHOP',
    stroke: '3.5px',
    color: '#34d399',
    glow: 'rgba(52,211,153,0.7)',
    clip: SLANT,
    fontSize: 'clamp(24px, 3.6vw, 44px)',
    height: 56,
    padX: 40,
    weight: 1,
  },
  {
    href: '/achievements',
    label: 'ACHIEVEMENTS',
    stroke: '3px',
    color: 'var(--warn)',
    glow: 'rgba(251,191,36,0.7)',
    clip: SLANT,
    fontSize: 'clamp(15px, 2.7vw, 38px)',
    height: 56,
    padX: 52,
    weight: 2,
  },
  {
    href: '/counters',
    label: 'COUNTERS',
    stroke: '3px',
    color: '#f472b6',
    glow: 'rgba(244,114,182,0.7)',
    clip: SLANT,
    fontSize: 'clamp(16px, 2.9vw, 40px)',
    height: 56,
    padX: 44,
    weight: 2,
  },
  {
    href: '/rules',
    label: 'RULES',
    stroke: '2.75px',
    color: '#fb7185',
    glow: 'rgba(251,113,133,0.7)',
    clip: SLANT,
    fontSize: 'clamp(20px, 3.2vw, 42px)',
    height: 56,
    padX: 38,
    weight: 1,
  },
  {
    href: '/about',
    label: 'ABOUT',
    stroke: '2.75px',
    color: '#94a3b8',
    glow: 'rgba(148,163,184,0.6)',
    clip: SLANT,
    fontSize: 'clamp(20px, 3.2vw, 42px)',
    height: 56,
    padX: 40,
    weight: 1,
  },
  {
    href: '/macros',
    label: 'MACROS',
    stroke: '2.75px',
    color: '#c084fc',
    glow: 'rgba(192,132,252,0.7)',
    clip: SLANT,
    fontSize: 'clamp(20px, 3.1vw, 41px)',
    height: 56,
    padX: 40,
    weight: 1,
  },
  {
    href: '/blogs',
    label: 'BLOG',
    stroke: '2.75px',
    color: '#fb923c',
    glow: 'rgba(251,146,60,0.7)',
    clip: SLANT,
    fontSize: 'clamp(20px, 3.2vw, 42px)',
    height: 56,
    padX: 40,
    weight: 1,
  },
  {
    href: '/feedback',
    label: 'FEEDBACK',
    stroke: '2.75px',
    color: '#34d399',
    glow: 'rgba(52,211,153,0.7)',
    clip: SLANT,
    fontSize: 'clamp(15px, 2.6vw, 36px)',
    height: 56,
    padX: 40,
    weight: 2,
  },
  {
    href: '/rewards',
    label: 'XP REWARDS',
    stroke: '2.75px',
    color: '#facc15',
    glow: 'rgba(250,204,21,0.7)',
    clip: SLANT,
    fontSize: 'clamp(15px, 2.6vw, 36px)',
    height: 56,
    padX: 40,
    weight: 2,
  },
]

const GAMES = [
  {
    href: '/shuffle',
    label: 'NUMBER SHUFFLE',
    stroke: '3px',
    color: '#2dd4bf',
    glow: 'rgba(45,212,191,0.7)',
    clip: SLANT,
    fontSize: 'clamp(15px, 3.4vw, 36px)',
    height: 56,
    padX: 40,
    weight: 2,
  },
  {
    href: '/lrwoed',
    label: 'LRWOED',
    stroke: '3.5px',
    color: 'var(--success-ink)',
    glow: 'rgba(74,222,128,0.7)',
    clip: SLANT,
    fontSize: 'clamp(18px, 3.2vw, 43px)',
    height: 56,
    padX: 40,
    weight: 1,
  },
  {
    href: '/bingo',
    label: 'BINGO',
    stroke: '3.5px',
    color: '#f472b6',
    glow: 'rgba(244,114,182,0.7)',
    clip: SLANT,
    fontSize: 'clamp(18px, 3.2vw, 43px)',
    height: 56,
    padX: 40,
    weight: 1,
  },
]

type TileItem = typeof PRIMARY[0]

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.round(c * (1 - amount))
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`
}

const TILE_DEPTH = 9

const TILE_BORDER = 3

const MENU_TILE_HEIGHT = 56

function Extrusion({ clip, color, lift }: { clip: string; color: string; lift: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        clipPath: clip,
        background: color,
        transform: `translateY(${TILE_DEPTH}px)`,
        filter: `drop-shadow(0 ${Math.round(lift * 0.6)}px ${lift + 5}px rgba(20,16,10,0.5))`,
        transition: 'filter 0.09s ease-out',
      }}
    />
  )
}

const PREFETCH_TILES = new Set(PRIMARY.map(t => t.href))

function TileBase({ item }: { item: TileItem }) {
  const [hov, setHov] = useState(false)
  const [down, setDown] = useState(false)
  const router = useRouter()

  const side = shade(item.color, 0.45)
  const lift = down ? 0 : hov ? TILE_DEPTH + 4 : TILE_DEPTH

  return (
    <div style={{
      gridColumn: `span ${item.weight}`,
      minWidth: 0,
      paddingBottom: TILE_DEPTH + 4,
    }}>
      <div style={{ position: 'relative' }}>
        <Extrusion clip={item.clip} color={side} lift={lift} />
        <Link
          href={item.href}
          prefetch={PREFETCH_TILES.has(item.href) ? undefined : false}
          onMouseEnter={() => { setHov(true); router.prefetch(item.href) }}
          onMouseLeave={() => { setHov(false); setDown(false) }}
          onMouseDown={() => setDown(true)}
          onMouseUp={() => setDown(false)}
          onTouchStart={() => setDown(true)}
          onTouchEnd={() => setDown(false)}
          style={{
            position: 'relative',
            display: 'block',
            textDecoration: 'none',
            clipPath: item.clip,
            background: '#000',
            padding: TILE_BORDER,
            transform: `translateY(${TILE_DEPTH - lift}px)`,
            transition: 'transform 0.09s ease-out, filter 0.16s',
            filter: hov && !down ? 'brightness(1.08)' : 'none',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div style={{
            clipPath: item.clip,
            background: item.color,
            height: item.height,
            padding: `0 min(${item.padX}px, 11%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
          <span style={{
            display: 'block',
            textAlign: 'center',
            fontWeight: 900,
            fontSize: item.fontSize,
            letterSpacing: '0.06em',
            color: '#fff',
            WebkitTextStroke: `${item.stroke} #000`,
            paintOrder: 'stroke fill',
            lineHeight: 1,
          }}>
            {item.label}
          </span>
          </div>
        </Link>
      </div>
    </div>
  )
}

const Tile = memo(TileBase)

const DISCORD_INVITE = 'https://discord.gg/bfS9RQht6M'

function DiscordTileBase({ memberCount }: { memberCount: number | null }) {
  const [hov, setHov] = useState(false)
  const [down, setDown] = useState(false)
  const lift = down ? 0 : hov ? TILE_DEPTH + 4 : TILE_DEPTH
  const face = '#5865F2'

  return (
    <div style={{ paddingBottom: TILE_DEPTH + 4, pointerEvents: 'auto' }}>
      <div style={{ position: 'relative' }}>
        <Extrusion clip={SLANT} color={shade(face, 0.45)} lift={lift} />
        <a
          href={DISCORD_INVITE}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => { setHov(false); setDown(false) }}
          onMouseDown={() => setDown(true)}
          onMouseUp={() => setDown(false)}
          onTouchStart={() => setDown(true)}
          onTouchEnd={() => setDown(false)}
          style={{
            position: 'relative',
            display: 'block',
            width: '100%',
            textAlign: 'center',
            textDecoration: 'none',
            background: '#000',
            clipPath: SLANT,
            padding: TILE_BORDER,
            transform: `translateY(${TILE_DEPTH - lift}px)`,
            transition: 'transform 0.09s ease-out, filter 0.16s',
            filter: hov && !down ? 'brightness(1.1)' : 'none',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div style={{
            clipPath: SLANT,
            background: face,
            height: MENU_TILE_HEIGHT,
            padding: '0 min(30px, 8%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <span style={{
              fontWeight: 900,
              fontSize: 'clamp(15px, 3vw, 33px)',
              letterSpacing: '0.06em',
              color: '#fff',
              WebkitTextStroke: '3px #000',
              paintOrder: 'stroke fill',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}>
              {memberCount === null
                ? 'JOIN DISCORD'
                : `JOIN DISCORD (${memberCount.toLocaleString()})`}
            </span>
          </div>
        </a>
      </div>
    </div>
  )
}

const DiscordTile = memo(DiscordTileBase)

function MenuTile({ label, active, onToggle }: {
  label: string
  active: boolean
  onToggle: () => void
}) {
  const [hov, setHov] = useState(false)
  const [down, setDown] = useState(false)
  const lift = down ? 0 : hov ? TILE_DEPTH + 4 : TILE_DEPTH
  const face = active ? '#64748b' : '#475569'

  return (
    <div style={{
      gridColumn: 'span 2',
      paddingBottom: TILE_DEPTH + 4,
    }}>
      <div style={{ position: 'relative' }}>
        <Extrusion clip={SLANT} color={shade(face, 0.45)} lift={lift} />
        <button
          onClick={onToggle}
          aria-pressed={active}
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => { setHov(false); setDown(false) }}
          onMouseDown={() => setDown(true)}
          onMouseUp={() => setDown(false)}
          style={{
            position: 'relative',
            display: 'block',
            width: '100%',
            textAlign: 'center',
            background: '#000',
            clipPath: SLANT,
            padding: TILE_BORDER,
            transform: `translateY(${TILE_DEPTH - lift}px)`,
            transition: 'transform 0.09s ease-out, filter 0.16s',
            filter: hov && !down ? 'brightness(1.1)' : 'none',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontWeight: 900,
            fontSize: 'clamp(21px, 2.8vw, 36px)',
            letterSpacing: '0.06em',
            color: '#fff',
            WebkitTextStroke: '2px #000',
            paintOrder: 'stroke fill',
          }}
        >
          <div style={{
            clipPath: SLANT, background: face,
            height: MENU_TILE_HEIGHT, padding: '0 30px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {label}
          </div>
        </button>
      </div>
    </div>
  )
}

function BlogAvatar({ author, size }: {
  author: BlogSummary['author']
  size: number
}) {
  const src = author?.discordId && author?.avatar
    ? avatarUrl({ discordId: author.discordId, avatar: author.avatar })
    : undefined
  const initial = (author?.username ?? '?').slice(0, 1).toUpperCase()

  return (
    <div style={{
      flexShrink: 0,
      width: size, height: size, borderRadius: '50%',
      overflow: 'hidden',
      background: author?.color || CARD_INK,
      border: '2px solid rgb(var(--shadow-rgb) / 0.35)',
      display: 'grid', placeItems: 'center',
      fontSize: size * 0.42, fontWeight: 800, color: '#fff',
    }}>
      {src
        ? <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : initial}
    </div>
  )
}

function BlogRailBase({
  featured,
  recent,
  canPost,
}: {
  featured: LatestBlog
  recent: BlogSummary[]
  canPost: boolean
}) {
  if (!featured && recent.length === 0) return null

  return (
    <section
      aria-labelledby="home-blogs"
      style={{
        marginTop: 22, paddingTop: 16, minWidth: 0, pointerEvents: 'auto',
        borderTop: '1px solid rgb(var(--ink-rgb) / 0.28)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <Link
          href="/blogs"
          style={{ textDecoration: 'none' }}
          aria-label="All blog posts"
        >
          <h2 id="home-blogs" style={{
            margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.62)',
          }}>
            Blogs
          </h2>
        </Link>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          {canPost && (
            <Link
              href="/blog/create"
              style={{
                fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
                color: '#241C12', background: '#F9A03F',
                border: '2px solid #241C12', borderRadius: 6,
                padding: '3px 9px', textDecoration: 'none',
                boxShadow: '0 2px 0 #241C12',
              }}
            >
              + New post
            </Link>
          )}
          <Link href="/blogs" style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.78)', textDecoration: 'none' }}>
            All posts →
          </Link>
        </div>
      </div>

      {featured && (
        <Link href={blogPath(featured)} prefetch={false} style={{ textDecoration: 'none', display: 'block' }}>
          <article style={{
            padding: '13px 15px', borderRadius: 12, marginBottom: 7,
            background: CARD,
            border: `2px solid ${CARD_INK}`,
            boxShadow: `0 4px 0 ${CARD_INK}`,
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <BlogAvatar author={featured.author} size={34} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 16, fontWeight: 800, color: CARD_INK, lineHeight: 1.3,
                  textWrap: 'balance', overflowWrap: 'anywhere',
                }}>
                  {featured.title}
                </div>
                <div style={{ marginTop: 2, fontSize: 11, color: 'rgba(36,28,18,0.55)' }}>
                  {featured.author?.username}
                  {blogDate(featured.timestamp) && ` · ${blogDate(featured.timestamp)}`}
                </div>
              </div>
            </div>
            <p style={{
              margin: '8px 0 0', fontSize: 13, lineHeight: 1.55,
              color: 'rgba(36,28,18,0.72)', overflowWrap: 'anywhere',
              display: '-webkit-box', WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {featured.preview}
            </p>
          </article>
        </Link>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {recent.map(blog => (
          <Link key={blog.uuid} href={blogPath(blog)} prefetch={false} style={{ textDecoration: 'none', display: 'block' }}>
            <article style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '6px 10px', borderRadius: 8,
              background: CARD,
              border: `2px solid ${CARD_INK}`,
            }}>
              <BlogAvatar author={blog.author} size={26} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: 'block',
                  fontSize: 12.5, fontWeight: 700, color: CARD_INK, lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {blog.title}
                </span>
                <span style={{
                  display: 'block', marginTop: 1,
                  fontSize: 10.5, lineHeight: 1.35, color: 'rgba(36,28,18,0.55)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  <span style={{ color: 'rgba(36,28,18,0.75)', fontWeight: 600 }}>
                    {blog.author?.username}
                  </span>
                  {blog.preview && `: ${blog.preview}`}
                </span>
              </span>
              <span style={{
                flexShrink: 0, alignSelf: 'flex-start', marginTop: 2,
                fontSize: 10, color: 'rgba(36,28,18,0.45)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {blogDate(blog.timestamp)}
              </span>
            </article>
          </Link>
        ))}
      </div>
    </section>
  )
}

export type StatPeriod = 'today' | 'month' | 'year' | 'all'

const BlogRail = memo(BlogRailBase)

const PERIOD_LABELS: Record<StatPeriod, string> = {
  today: 'Today',
  month: 'This month',
  year: 'This year',
  all: 'All time',
}

function easternDateParts(at: number = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(at)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '01'
  return { y: get('year'), m: get('month'), d: get('day') }
}

function easternDay(at: number = Date.now()): string {
  const { y, m, d } = easternDateParts(at)
  return `${y}-${m}-${d}`
}

function periodRange(period: StatPeriod): { start: string; end: string } | null {
  if (period === 'today' || period === 'all') return null
  const { y, m } = easternDateParts()
  const yesterday = easternDateParts(Date.now() - 86_400_000)
  const end = `${yesterday.y}-${yesterday.m}-${yesterday.d}`
  return { start: period === 'month' ? `${y}-${m}-01` : `${y}-01-01`, end }
}

const MS_STAT_LABEL = 'MILLISECOND COMPLETION'
const CS_STAT_LABEL = 'CENTISECOND COMPLETION'
const TIME_STAT_LABEL = 'TIME SPENT COUNTING'

type StatEntry = {
  label: string
  value: number
  format?: 'number' | 'time' | 'percent' | 'clock'
  sub?: string
  claimed?: number
  total?: number
  myClaims?: number | null
  myClaimsByHour?: number[] | null
  unit?: 'ms' | 'cs'
  myUuid?: string | null
  detail?: { hour: number; pct: number; claimed: number }[]
}

function formatStatValue(entry: StatEntry): string {
  if (entry.format === 'time') {
    const totalSecs = Math.round(entry.value)
    const days = Math.floor(totalSecs / 86400)
    const hrs = Math.floor((totalSecs % 86400) / 3600)
    const mins = Math.floor((totalSecs % 3600) / 60)
    if (days > 0) return `${days.toLocaleString()}d ${hrs}h`
    if (hrs > 0) return `${hrs}h ${mins}m`
    return `${mins}m`
  }
  if (entry.format === 'clock') {
    return formatDurationShort(entry.value)
  }
  if (entry.format === 'percent') {
    return `${truncatedPercent(entry.value, 2, entry.claimed && entry.total ? { part: entry.claimed, whole: entry.total } : undefined)}%`
  }
  return Math.round(entry.value).toLocaleString()
}

const CARD = '#FFF4DF'
const CARD_INK = '#241C12'

function numberFontSize(len: number): string {
  if (len >= 13) return 'clamp(24px, 4vw, 52px)'
  if (len >= 11) return 'clamp(27px, 4.6vw, 62px)'
  if (len >= 9)  return 'clamp(30px, 5.4vw, 74px)'
  return 'clamp(34px, 7vw, 96px)'
}

function StatArrow({ dir, onClick }: { dir: 'prev' | 'next'; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      aria-label={dir === 'prev' ? 'Previous stat' : 'Next stat'}
      style={{
        flexShrink: 0,
        display: 'grid', placeItems: 'center',
        width: 'clamp(38px, 5vw, 58px)',
        height: 'clamp(38px, 5vw, 58px)',
        borderRadius: '50%',
        border: `3px solid ${CARD_INK}`,
        background: hov ? '#F9A03F' : 'rgb(var(--shadow-rgb) / 0.05)',
        color: CARD_INK,
        fontSize: 'clamp(24px, 3.2vw, 38px)',
        lineHeight: 1,
        paddingBottom: 4,
        fontWeight: 900,
        cursor: 'pointer',
        transition: 'background 0.15s, transform 0.1s',
        transform: hov ? 'scale(1.06)' : 'none',
      }}
    >
      {dir === 'prev' ? '‹' : '›'}
    </button>
  )
}

function StatDisplay({ stats, statIdx, onPrev, onNext, children }: {
  stats: StatEntry[]
  statIdx: number
  onPrev: () => void
  onNext: () => void
  children?: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)

  const expandable = !!stats[statIdx]?.detail
  useEffect(() => {
    if (!expandable) setExpanded(false)
  }, [statIdx, expandable])

  const entry = stats[statIdx]
  if (!entry) return null

  const displayStr = entry.format && entry.format !== 'number'
    ? formatStatValue(entry)
    : Math.round(entry.value).toLocaleString()

  return (
    <div>
      <div style={{
        display: 'block',
        padding: 'clamp(16px, 2.2vw, 26px) clamp(16px, 2.2vw, 28px)',
        borderRadius: 18,
        background: CARD,
        border: `3px solid ${CARD_INK}`,
        boxShadow: `0 7px 0 ${CARD_INK}, 0 14px 24px rgba(20,16,10,0.28)`,
      }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, minWidth: 0,
        height: 'clamp(34px, 7vw, 96px)',
      }}>
        {stats.length > 1 && <StatArrow dir="prev" onClick={onPrev} />}
        <div
          title={entry.format === 'clock' ? formatDurationFull(entry.value) : undefined}
          style={{
            flex: 1, minWidth: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%',
            fontSize: numberFontSize(displayStr.length),
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 0.95,
            color: CARD_INK,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}>
          {displayStr}
        </div>
        {stats.length > 1 && <StatArrow dir="next" onClick={onNext} />}
      </div>

      <div style={{
        marginTop: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        userSelect: 'none',
        position: 'relative',
      }}>
        <div style={{
          fontSize: 'clamp(13px, 1.5vw, 18px)',
          fontWeight: 800,
          letterSpacing: '0.22em',
          color: 'rgba(36,28,18,0.72)',
          textTransform: 'uppercase',
        }}>
          {entry.label}
        </div>
        {entry.detail && (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide hourly breakdown' : 'Show hourly breakdown'}
            style={{
              position: 'absolute', right: 0, top: '50%',
              width: 26, height: 26,
              display: 'grid', placeItems: 'center',
              borderRadius: 5,
              border: `2px solid ${CARD_INK}`,
              background: expanded ? '#F9A03F' : 'transparent',
              color: CARD_INK,
              cursor: 'pointer', padding: 0, lineHeight: 1,
              fontSize: 14, fontWeight: 900,
              transform: expanded
                ? 'translateY(-50%) rotate(180deg)'
                : 'translateY(-50%)',
              transition: 'background 0.15s, transform 0.15s',
            }}
          >
            ▾
          </button>
        )}
      </div>

      {entry.detail && expanded && (
        <MsCoverageExplorer
          byHour={entry.detail}
          claimed={entry.claimed ?? 0}
          total={entry.total ?? 0}
          myClaims={entry.myClaims ?? null}
          myClaimsByHour={entry.myClaimsByHour ?? null}
          myUuid={entry.myUuid ?? null}
          unit={entry.unit ?? 'ms'}
        />
      )}

      {children && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '2px solid rgb(var(--shadow-rgb) / 0.13)' }}>
          {children}
        </div>
      )}
      </div>
    </div>
  )
}


type LeaderboardEntry = {
  counter: {
    uuid: string
    username: string
    color: string
    name: string
    discordId?: string
    avatar?: string
  }
  counts: number
}
type LatestBlog = BlogSummary | null

type ThreadEntry = {
  uuid: string
  name: string
  title: string
  counts: number
  validationType?: string
  countFormat?: string
  color1?: string
  color2?: string
}

function threadColor(thread: { name: string; color1?: string }): string {
  if (thread.color1 && /^#[0-9a-fA-F]{6}$/.test(thread.color1)) return thread.color1
  let h = 0
  for (let i = 0; i < thread.name.length; i++) h = (h * 31 + thread.name.charCodeAt(i)) >>> 0
  return `hsl(${h % 360}, 72%, 62%)`
}

type BoardRowData = {
  key: string
  href: string
  label: string
  color: string
  counts: number
  discordId?: string
  avatar?: string
  latest?: string | null
  delta?: number
}

const DEFAULT_ROWS = 3

function inkFor(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? shade(color, 0.42) : CARD_INK
}

function BoardRow({ rank, row }: { rank: number; row: BoardRowData }) {
  const m = medal(rank)
  const src = row.discordId && row.avatar
    ? avatarUrl({ discordId: row.discordId, avatar: row.avatar })
    : undefined

  return (
    <Link href={row.href} prefetch={false} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        display: 'flex', alignItems: 'stretch', gap: 7,
        position: 'relative', minHeight: 30,
      }}>
        <span style={{
          position: 'relative', zIndex: 1, flexShrink: 0,
          alignSelf: 'stretch',
          minWidth: 22, padding: '0 5px',
          borderRadius: '0 4px 4px 0',
          display: 'grid', placeItems: 'center',
          fontSize: 11, fontWeight: 900,
          fontVariantNumeric: 'tabular-nums',
          background: m?.bg ?? 'transparent',
          color: m?.color ?? CARD_INK,
          textShadow: 'none',
        }}>{rank}</span>

        {row.discordId && (
          <span style={{
            position: 'relative', zIndex: 1, flexShrink: 0, alignSelf: 'center',
            width: 20, height: 20, borderRadius: '50%',
            overflow: 'hidden', display: 'grid', placeItems: 'center',
            background: row.color || 'rgba(36,28,18,0.15)',
            border: '1.5px solid rgb(var(--shadow-rgb) / 0.3)',
          }}>
            {src && (
              <img
                src={src} alt="" width={20} height={20}
                loading="lazy" decoding="async"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}
          </span>
        )}

        <span style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0, alignSelf: 'center' }}>
          <span style={{
            display: 'block',
            fontSize: 12, fontWeight: 800, lineHeight: 1.25,
            color: inkFor(row.color),
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{row.label}</span>
          {row.latest != null && (
            <span style={{
              display: 'block',
              fontSize: 9.5, lineHeight: 1.25,
              color: 'rgba(36,28,18,0.45)',
              fontVariantNumeric: 'tabular-nums',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {row.latest}
              {!!row.delta && (
                <span style={{ color: '#2E7D32', fontWeight: 700 }}> +{row.delta}</span>
              )}
            </span>
          )}
        </span>

        <span style={{
          position: 'relative', zIndex: 1, flexShrink: 0, alignSelf: 'center', paddingRight: 6,
          fontSize: 14, fontWeight: 900,
          color: CARD_INK,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.01em',
        }}>{row.counts.toLocaleString()}</span>
      </div>
    </Link>
  )
}

const boardCaption: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 800,
  letterSpacing: '0.16em', color: 'rgba(36,28,18,0.78)',
  textTransform: 'uppercase',
}

const PAGE_SIZE = 100

const BOARD_SCROLL_ROWS = 8
const BOARD_ROW_PX = 35

function BoardColumn({ caption, rows, basis }: {
  caption: string
  rows: BoardRowData[]
  basis?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [page, setPage] = useState(1)

  const cap = expanded ? PAGE_SIZE * page : DEFAULT_ROWS
  const shown = rows.slice(0, cap)
  const hidden = rows.length - DEFAULT_ROWS
  const more = rows.length - shown.length

  const toggle = () => {
    setExpanded(v => {
      if (v) setPage(1)
      return !v
    })
  }

  const visibleRows = expanded ? Math.min(shown.length, BOARD_SCROLL_ROWS) : Math.min(shown.length, DEFAULT_ROWS)
  const scrolls = !!expanded && shown.length > BOARD_SCROLL_ROWS

  return (
    <div style={{ flex: basis ? `0 0 ${basis}` : 1, minWidth: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 8, marginBottom: 5,
      }}>
        <span style={boardCaption}>{caption}</span>
        {hidden > 0 && (
          <button
            onClick={toggle}
            style={{
              background: 'rgba(36,28,18,0.07)',
              border: '1px solid rgba(36,28,18,0.22)',
              borderRadius: 999, padding: '1px 9px', cursor: 'pointer',
              fontSize: 10.5, fontWeight: 800, letterSpacing: '0.04em',
              color: 'rgba(36,28,18,0.72)', whiteSpace: 'nowrap',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#E8781F'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(36,28,18,0.07)'
              e.currentTarget.style.color = 'rgba(36,28,18,0.72)'
            }}
          >
            {expanded ? 'Show less ↑' : `+${hidden} more ↓`}
          </button>
        )}
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 3,
        maxHeight: visibleRows * BOARD_ROW_PX,
        overflowY: scrolls ? 'auto' : 'hidden',
        transition: 'max-height 0.34s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {rows.length === 0
          ? <div style={{ fontSize: 11, color: 'rgba(36,28,18,0.4)', padding: '5px 0' }}>Nothing yet today</div>
          : shown.map((r, i) => (
            <div
              key={r.key}
              style={i >= DEFAULT_ROWS
                ? { animation: `rowIn 0.28s ${(i - DEFAULT_ROWS) * 0.03}s ease both` }
                : undefined}
            >
              <BoardRow rank={i + 1} row={r} />
            </div>
          ))
        }
      </div>

      {expanded && more > 0 && (
        <button
          onClick={() => setPage(n => n + 1)}
          style={{
            marginTop: 6, width: '100%',
            background: 'rgba(36,28,18,0.07)',
            border: '1px solid rgba(36,28,18,0.22)',
            borderRadius: 8, padding: '4px 0', cursor: 'pointer',
            fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
            color: 'rgba(36,28,18,0.72)',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#E8781F'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(36,28,18,0.07)'
            e.currentTarget.style.color = 'rgba(36,28,18,0.72)'
          }}
        >
          Load {Math.min(PAGE_SIZE, more)} more · {more.toLocaleString()} left
        </button>
      )}
    </div>
  )
}

function DailyLeaderboard({ entries, threadEntries, latestCounts, deltas, stacked, threadMeta }: {
  entries: LeaderboardEntry[]
  threadEntries: ThreadEntry[]
  latestCounts: Record<string, LatestCount>
  deltas: Record<string, number>
  stacked: boolean
  threadMeta: ThreadMeta[]
}) {


  const [period, setPeriod] = useState<StatPeriod>('today')
  const [periodBase, setPeriodBase] = useState<{
    counts: Record<string, number>
    counters: Record<string, LeaderboardEntry['counter']>
  } | null>(null)
  const [loadingPeriod, setLoadingPeriod] = useState(false)

  useEffect(() => {
    if (period === 'today') { setPeriodBase(null); return }
    let cancelled = false
    setLoadingPeriod(true)

    const range = periodRange(period)
    const todayKey = easternDay()
    fetch(`${API}/api/thread/stats/threadStats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread: 'all',
        includeDetails: false,
        ...(range
          ? { startDateStr: range.start, endDateStr: range.end }
          : { dateStr: todayKey }),
      }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then((data: { stats?: Record<string, { leaderboard?: Record<string, number> }>; counters?: LeaderboardEntry['counter'][] } | null) => {
        if (cancelled || !data?.stats) return
        const counters: Record<string, LeaderboardEntry['counter']> = {}
        for (const c of data.counters ?? []) counters[c.uuid] = c

        const counts: Record<string, number> = {}
        for (const [key, day] of Object.entries(data.stats)) {
          const isRollup = key === 'all'
          if (period === 'all' ? !isRollup : isRollup) continue
          for (const [uuid, n] of Object.entries(day?.leaderboard ?? {})) {
            counts[uuid] = (counts[uuid] ?? 0) + Number(n || 0)
          }
        }

        if (period === 'all') {
          for (const [uuid, n] of Object.entries(
            data.stats[todayKey]?.leaderboard ?? {},
          )) {
            counts[uuid] = Math.max(0, (counts[uuid] ?? 0) - Number(n || 0))
          }
        }

        setPeriodBase({ counts, counters })
      })
      .catch(() => { if (!cancelled) setPeriodBase(null) })
      .finally(() => { if (!cancelled) setLoadingPeriod(false) })

    return () => { cancelled = true }
  }, [period])

  const [periodThreadBase, setPeriodThreadBase] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    if (period === 'today') { setPeriodThreadBase(null); return }
    let cancelled = false

    const range = periodRange(period)
    const qs = range ? `?start=${range.start}&end=${range.end}` : ''
    const todayQs = `?start=${easternDay()}&end=${easternDay()}`
    Promise.all([
      fetch(`${API}/api/thread/leanStats${qs}`).then(r => (r.ok ? r.json() : null)),
      range
        ? Promise.resolve(null)
        : fetch(`${API}/api/thread/leanStats${todayQs}`).then(r => (r.ok ? r.json() : null)),
    ])
      .then(([totals, todayTotals]: [Record<string, number> | null, Record<string, number> | null]) => {
        if (cancelled || !totals) return
        const byName = new Map(threadMeta.map(t => [t.name, t]))
        const byUuid: Record<string, number> = {}
        for (const [name, counts] of Object.entries(totals)) {
          if (name === 'all' || !counts) continue
          const meta = byName.get(name)
          if (!meta) continue
          const today = todayTotals?.[name] ?? 0
          byUuid[meta.uuid] = Math.max(0, counts - today)
        }
        setPeriodThreadBase(byUuid)
      })
      .catch(() => { if (!cancelled) setPeriodThreadBase(null) })

    return () => { cancelled = true }
  }, [period, threadMeta])

  const shownEntries: LeaderboardEntry[] = period === 'today'
    ? entries
    : (() => {
        if (!periodBase) return []
        const counts = { ...periodBase.counts }
        const counters = { ...periodBase.counters }
        for (const e of entries) {
          counts[e.counter.uuid] = (counts[e.counter.uuid] ?? 0) + e.counts
          counters[e.counter.uuid] ??= e.counter
        }
        return Object.entries(counts)
          .filter(([, n]) => n > 0)
          .map(([uuid, n]) => ({
            counter: counters[uuid] ?? { uuid, username: uuid.slice(0, 8), name: uuid, color: '' },
            counts: n,
          }))
          .sort((a, b) => b.counts - a.counts)
      })()

  const shownThreads: ThreadEntry[] = period === 'today'
    ? threadEntries
    : (() => {
        if (!periodThreadBase) return []
        const byUuid = new Map<string, ThreadEntry>()
        for (const meta of threadMeta) {
          const base = periodThreadBase[meta.uuid]
          if (base) byUuid.set(meta.uuid, { ...meta, counts: base })
        }
        for (const t of threadEntries) {
          const existing = byUuid.get(t.uuid)
          byUuid.set(t.uuid, existing ? { ...existing, counts: existing.counts + t.counts } : t)
        }
        return [...byUuid.values()].sort((a, b) => b.counts - a.counts)
      })()

  const counterRows: BoardRowData[] = shownEntries.map(e => ({
    key: e.counter.uuid,
    href: `/counter/${encodeURIComponent(e.counter.username)}`,
    label: e.counter.name || e.counter.username,
    color: e.counter.color || 'var(--ink-1)',
    counts: e.counts,
    discordId: e.counter.discordId,
    avatar: e.counter.avatar,
  }))
  const threadRows: BoardRowData[] = shownThreads.map(t => ({
    key: t.uuid,
    href: `/thread/${t.name}`,
    label: t.title,
    color: threadColor(t),
    counts: t.counts,
    latest: period === 'today' ? displayCount(latestCounts[t.uuid], t.validationType, t.countFormat) : null,
    delta: period === 'today' ? (deltas[t.uuid] ?? 0) : 0,
  }))

  const periodTotal = shownEntries.reduce((sum, e) => sum + e.counts, 0)

  if (counterRows.length === 0 && threadRows.length === 0) return null



  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <select
            value={period}
            onChange={e => setPeriod(e.currentTarget.value as StatPeriod)}
            aria-label="Leaderboard period"
            style={{
              appearance: 'none',
              background: 'rgba(36,28,18,0.08)',
              border: '1.5px solid rgba(36,28,18,0.3)',
              borderRadius: 7,
              padding: '3px 26px 3px 10px',
              fontSize: 12.5, fontWeight: 800, letterSpacing: '0.06em',
              color: CARD_INK, cursor: 'pointer',
              textTransform: 'uppercase',
              backgroundImage:
                'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'7\'><path d=\'M1 1l4 4 4-4\' stroke=\'%23241C12\' stroke-width=\'1.8\' fill=\'none\' stroke-linecap=\'round\'/></svg>")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
            }}
          >
            {(['today', 'month', 'year', 'all'] as StatPeriod[]).map(k => (
              <option key={k} value={k}>{PERIOD_LABELS[k]}</option>
            ))}
          </select>
          {loadingPeriod && (
            <span style={{ fontSize: 10.5, color: 'rgba(36,28,18,0.45)' }}>loading…</span>
          )}
        </div>

        <div style={{
          fontSize: 12.5, fontWeight: 800, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: CARD_INK,
          fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        }}>
          {periodTotal.toLocaleString()} counts
        </div>
      </div>

      {!stacked ? (
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <BoardColumn caption="Counters" rows={counterRows} basis="50%" />
          <BoardColumn caption="Threads" rows={threadRows} basis="50%" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <BoardColumn caption="Counters" rows={counterRows} />
          <BoardColumn caption="Threads" rows={threadRows} />
        </div>
      )}
    </div>
  )
}

interface ThreadMeta {
  uuid: string
  name: string
  title: string
  validationType?: string
  countFormat?: string
  color1?: string
  color2?: string
}

interface HomeClientProps {
  initialCount: number | null
  initialPosts?: number | null
  threadMeta: ThreadMeta[]
  initialLatestCounts: Record<string, LatestCount>
  initialThreadBoard: ThreadEntry[]
  initialLeaderboard: LeaderboardEntry[]
  initialHour: number
  initialDayKey: string
  initialNarrow?: boolean
  wisdom?: { w: number; h: number } | null
  isLoggedIn: boolean
  viewerUuid?: string | null
  isBanned?: boolean
  isMuted?: boolean
  initialMsCoverage?: any
  initialCsCoverage?: any
  isStaff: boolean
  isCounter?: boolean
  latestBlog?: LatestBlog
  recentBlogs?: BlogSummary[]
  discordMembers?: number | null
}

export default function HomeClient({
  initialCount,
  initialPosts = null,
  threadMeta,
  initialLatestCounts,
  initialThreadBoard,
  initialLeaderboard,
  initialHour,
  initialDayKey,
  initialNarrow = false,
  wisdom = null,
  isLoggedIn,
  viewerUuid = null,
  isBanned = false,
  isMuted = false,
  initialMsCoverage = null,
  initialCsCoverage = null,
  isStaff,
  isCounter = false,
  latestBlog,
  recentBlogs = [],
  discordMembers = null,
}: HomeClientProps) {
  const games = GAMES

  const gameRows = [
    games.filter(g => g.href === '/shuffle'),
    games.filter(g => g.href !== '/shuffle'),
  ].filter(row => row.length > 0)
  const coverageEntry = useCallback(
    (
      data: any,
      label: string,
      unit: 'ms' | 'cs',
      mine: number | null,
      mineByHour: number[] | null = null,
    ): StatEntry | null => {
      if (!data || typeof data.pct !== 'number') return null
      return {
        label,
        value: data.pct,
        format: 'percent',
        claimed: Number(data.claimed) || 0,
        total: Number(data.total) || 0,
        myClaims: mine,
        myClaimsByHour: mineByHour,
        myUuid: viewerUuid,
        unit,
        detail: Array.isArray(data.byHour)
          ? data.byHour.map((h: any) => ({
              hour: Number(h.hour),
              pct: Number(h.pct) || 0,
              claimed: Number(h.claimed) || 0,
            }))
          : undefined,
      }
    },
    [viewerUuid],
  )

  const [stats, setStats] = useState<StatEntry[]>(() => {
    const seed: StatEntry[] = [{ label: 'TOTAL COUNTS', value: initialCount ?? 0 }]
    if (initialPosts) seed.push({ label: 'TOTAL POSTS', value: initialPosts })
    const cs = coverageEntry(initialCsCoverage, CS_STAT_LABEL, 'cs', null)
    const ms = coverageEntry(initialMsCoverage, MS_STAT_LABEL, 'ms', null)
    if (cs) seed.push(cs)
    if (ms) seed.push(ms)
    return seed
  })
  const [statIdx, setStatIdx] = useState(0)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(initialLeaderboard)
  const [threadBoard, setThreadBoard] = useState<ThreadEntry[]>(initialThreadBoard)
  const [narrow, setNarrow] = useState(initialNarrow)
  const [menu, setMenu] = useState<'primary' | 'more'>('primary')
  const canPostBlog = isLoggedIn && isCounter && !isBanned && !isMuted

  const [menuSwitched, setMenuSwitched] = useState(false)
  const [latestCounts, setLatestCounts] = useState(initialLatestCounts)
  const [deltas, setDeltas] = useState<Record<string, number>>({})

  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < STACK_BELOW)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [parkMode, setParkMode] = useState(false)

  useEffect(() => {
    if (!parkMode) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setParkMode(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [parkMode])

  const threadMetaRef = useRef(threadMeta)
  useEffect(() => { threadMetaRef.current = threadMeta }, [threadMeta])

  const [liveHour, setLiveHour] = useState(initialHour)
  useEffect(() => {
    const tick = () => setLiveHour(easternHourFraction())
    tick()
    const id = setInterval(tick, PHASE_POLL_MS)
    return () => clearInterval(id)
  }, [])
  const furniture: React.CSSProperties = {
    opacity: parkMode ? 0 : 1,
    pointerEvents: parkMode ? 'none' : undefined,
    transform: parkMode ? 'translateY(-14px)' : undefined,
    transition: 'opacity 0.7s ease, transform 0.7s ease',
  }

  const skyHour = liveHour
  const sky = skyAt(skyHour)


  const rawTreeTotal = leaderboard.reduce((sum, e) => sum + e.counts, 0)

  const camperSig = leaderboard
    .slice(0, MAX_CAMPERS)
    .map(e => `${e.counter.uuid}:${countsToScale(e.counts).toFixed(3)}`)
    .join('|')

  const campers: Camper[] = useMemo(() => leaderboard.map(e => ({
    uuid: e.counter.uuid,
    name: e.counter.name,
    color: e.counter.color,
    discordId: e.counter.discordId,
    avatar: e.counter.avatar,
    counts: e.counts,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [camperSig])

  const treeSig = treeGrowth(rawTreeTotal).toFixed(3)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const treeTotal = useMemo(() => rawTreeTotal, [treeSig])

  const togglePark = useCallback(() => setParkMode(v => !v), [])

  useEffect(() => {
    const socket = getSocket()
    if (!socket.connected) socket.connect()

    const pending = new Map<string, LatestCount>()
    const pendingDeltas = new Map<string, number>()
    const pendingCounters = new Map<string, { counter: LeaderboardEntry['counter']; n: number }>()
    const pendingThreads = new Map<string, number>()
    let dirty = false

    const join = () => socket.emit('watch', 'all')

    const onLatest = (data: LatestCount & { threadUuid?: string }) => {
      if (!data?.threadUuid) return
      pending.set(data.threadUuid, {
        rawCount: data.rawCount ?? null,
        validCountNumber: data.validCountNumber ?? null,
      })
      pendingDeltas.set(data.threadUuid, (pendingDeltas.get(data.threadUuid) ?? 0) + 1)
      dirty = true
    }

    const onPost = (data: {
      post?: { isValidCount?: boolean }
      counter?: LeaderboardEntry['counter']
      thread?: { uuid?: string }
      total_counts?: number
      total_posts?: number
    }) => {
      if (typeof data?.total_counts === 'number' || typeof data?.total_posts === 'number') {
        const counts = data.total_counts
        const posts = data.total_posts
        setStats(prev => prev.map(stat => {
          if (stat.label === 'TOTAL COUNTS' && typeof counts === 'number') return { ...stat, value: counts }
          if (stat.label === 'TOTAL POSTS' && typeof posts === 'number') return { ...stat, value: posts }
          return stat
        }))
      }

      if (!data?.post?.isValidCount) return

      const counter = data.counter
      if (counter?.uuid) {
        const entry = pendingCounters.get(counter.uuid)
        if (entry) entry.n += 1
        else pendingCounters.set(counter.uuid, { counter, n: 1 })
      }
      const threadUuid = data.thread?.uuid
      if (threadUuid) pendingThreads.set(threadUuid, (pendingThreads.get(threadUuid) ?? 0) + 1)
      dirty = true
    }

    socket.on('connect', join)
    socket.on('latest_count', onLatest)
    socket.on('post', onPost)
    if (socket.connected) join()

    const flush = setInterval(() => {
      if (!dirty) return
      dirty = false

      const latestSnap = Object.fromEntries(pending)
      const deltaSnap = [...pendingDeltas]
      const counterSnap = [...pendingCounters]
      const threadSnap = [...pendingThreads]

      pending.clear()
      pendingDeltas.clear()
      pendingCounters.clear()
      pendingThreads.clear()

      if (Object.keys(latestSnap).length > 0) {
        setLatestCounts(prev => ({ ...prev, ...latestSnap }))
        setDeltas(prev => {
          const next = { ...prev }
          for (const [uuid, n] of deltaSnap) next[uuid] = (next[uuid] ?? 0) + n
          return next
        })
      }

      if (counterSnap.length > 0) {
        setLeaderboard(prev => {
          const byUuid = new Map(prev.map(e => [e.counter.uuid, e]))
          for (const [uuid, { counter, n }] of counterSnap) {
            const existing = byUuid.get(uuid)
            byUuid.set(uuid, existing
              ? { ...existing, counts: existing.counts + n }
              : { counter, counts: n })
          }
          return [...byUuid.values()].sort((a, b) => b.counts - a.counts)
        })
      }

      if (threadSnap.length > 0) {
        setThreadBoard(prev => {
          const byUuid = new Map(prev.map(t => [t.uuid, t]))
          for (const [uuid, n] of threadSnap) {
            const existing = byUuid.get(uuid)
            if (existing) {
              byUuid.set(uuid, { ...existing, counts: existing.counts + n })
              continue
            }
            const meta = threadMetaRef.current.find(t => t.uuid === uuid)
            if (meta) byUuid.set(uuid, { ...meta, counts: n })
          }
          return [...byUuid.values()].sort((a, b) => b.counts - a.counts)
        })
      }
    }, LATEST_FLUSH_MS)

    return () => {
      clearInterval(flush)
      socket.emit('leave_threads')
      socket.off('connect', join)
      socket.off('latest_count', onLatest)
      socket.off('post', onPost)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/api/defaultPage`)
      if (!res.ok) return
      const data = await res.json()
      const next: StatEntry[] = []
      if (data.totalCounts > 0) next.push({ label: 'TOTAL COUNTS', value: data.totalCounts })
      if (data.totalPosts > 0) next.push({ label: 'TOTAL POSTS', value: data.totalPosts })
      if (next.length > 0) {
        setStats(prev => {
          const coverage = prev.filter(
            s =>
              s.label === TIME_STAT_LABEL ||
              s.label === CS_STAT_LABEL ||
              s.label === MS_STAT_LABEL,
          )
          return [...next, ...coverage]
        })
      }

      if (data.dailyLeaderboard) {
        const entries: LeaderboardEntry[] = Object.values(data.dailyLeaderboard)
          .filter((e: any) => e?.counter?.username && e.counts > 0)
          .sort((a: any, b: any) => b.counts - a.counts) as LeaderboardEntry[]
        setLeaderboard(entries)
      }

      if (data.allLeaderboards && typeof data.allLeaderboards === 'object') {
        const byUuid = new Map(threadMeta.map(t => [t.uuid, t]))
        const rows: ThreadEntry[] = []
        for (const [key, value] of Object.entries<any>(data.allLeaderboards)) {
          if (key === 'all' || !value || typeof value !== 'object') continue
          const meta = byUuid.get(key)
          if (!meta) continue
          let counts = 0
          for (const entry of Object.values<any>(value)) {
            counts += Number(entry?.counts) || 0
          }
          if (counts > 0) rows.push({ ...meta, counts })
        }
        rows.sort((a, b) => b.counts - a.counts)
        setThreadBoard(rows)
      }
    } catch {}
  }, [threadMeta])

  useEffect(() => {
    fetchStats()
    const id = setInterval(fetchStats, 20_000)
    return () => clearInterval(id)
  }, [fetchStats])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [res, csRes, timeRes, mineRes] = await Promise.all([
          fetch(`/api/thread/msCoverage`),
          fetch(`/api/thread/csCoverage`).catch(() => null),
          fetch(`/api/thread/countingTime`).catch(() => null),
          viewerUuid
            ? fetch(`/api/thread/msCoverage/counter/${viewerUuid}`).catch(() => null)
            : Promise.resolve(null),
        ])
        if (!res.ok) return
        const data = await res.json()
        const csData = csRes && csRes.ok ? await csRes.json().catch(() => null) : null
        const timeData = timeRes && timeRes.ok ? await timeRes.json().catch(() => null) : null
        let mine: number | null = null
        let mineCs: number | null = null
        let mineByHour: number[] | null = null
        if (mineRes && mineRes.ok) {
          const m = await mineRes.json().catch(() => null)
          if (typeof m?.claims === 'number') mine = m.claims
          if (typeof m?.csClaims === 'number') mineCs = m.csClaims
          if (Array.isArray(m?.claimsByHour) && m.claimsByHour.length === 24) {
            mineByHour = m.claimsByHour.map((n: unknown) => Number(n) || 0)
          }
        }
        if (cancelled || typeof data?.pct !== 'number') return
        setStats(prev => {
          const entry = coverageEntry(data, MS_STAT_LABEL, 'ms', mine, mineByHour)
          if (!entry) return prev
          const csEntry =
            coverageEntry(csData, CS_STAT_LABEL, 'cs', mineCs) ??
            prev.find(s => s.label === CS_STAT_LABEL) ??
            null

          const timeEntry: StatEntry | null =
            timeData && typeof timeData.postedSeconds === 'number' && timeData.postedSeconds > 0
              ? {
                  label: TIME_STAT_LABEL,
                  value: timeData.postedSeconds,
                  format: 'clock',
                  sub: `across ${Number(timeData.counters).toLocaleString()} counters`,
                }
              : (prev.find(s => s.label === TIME_STAT_LABEL) ?? null)

          const without = prev.filter(
            s =>
              s.label !== MS_STAT_LABEL &&
              s.label !== CS_STAT_LABEL &&
              s.label !== TIME_STAT_LABEL,
          )
          return [...without, ...(timeEntry ? [timeEntry] : []), ...(csEntry ? [csEntry] : []), entry]
        })
      } catch {}
    }

    load()
    const id = setInterval(load, 120_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [viewerUuid])

  const prevStat = () => setStatIdx(i => (i - 1 + stats.length) % stats.length)
  const nextStat = () => setStatIdx(i => (i + 1) % stats.length)

  const activeMenu = menu === 'more' ? SECONDARY : PRIMARY

  return (
    <>
      <style>{`
        @keyframes rowIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes menuSwitch {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div style={{
        position: 'fixed',
        top: 56, left: 0, right: 0, bottom: 0,
        background: sky.gradient,
        transition: 'background 0.25s linear',
        overflow: 'hidden',
        zIndex: 0,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}>
        <SkyBodies initialHour={skyHour} parkMode={parkMode} />

        <SkyWisdom wisdom={wisdom} daySeed={initialDayKey} />

        <button
          onClick={() => setParkMode(false)}
          style={{
            position: 'absolute', top: 14, right: 14, zIndex: 60,
            padding: '7px 16px', borderRadius: 999,
            border: '3px solid #2C1B0E', background: '#FFF4DF', color: '#241C12',
            fontWeight: 900, fontSize: 13,
            letterSpacing: '0.06em', cursor: 'pointer',
            boxShadow: '0 3px 0 #2C1B0E',
            opacity: parkMode ? 1 : 0,
            pointerEvents: parkMode ? 'auto' : 'none',
            transition: 'opacity 0.5s ease 0.2s',
          }}
        >
          ← LEAVE PARK
        </button>
        <Campground
          campers={campers}
          narrow={narrow}
          daySeed={initialDayKey}
          wisdom={wisdom}
          isCounter={isCounter}
          darkness={sky.darkness}
          totalCounts={treeTotal}
          hour={skyHour}
          onTogglePark={togglePark}
          parkMode={parkMode}
        />
      </div>

      <div style={{
        position: 'relative', zIndex: 1,
        minHeight: 'calc(100vh - 65px)',
        display: 'flex',
        flexDirection: narrow ? 'column' : 'row',
        pointerEvents: 'none',
        overflowX: 'clip',
      }}>

          <div inert={parkMode} style={{
            ...furniture,
            flex: narrow ? 'none' : '0 0 50%',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: narrow ? '40px 28px 24px' : 'clamp(28px,4vw,64px)',
            paddingRight: narrow ? 28 : 'clamp(20px,3vw,40px)',
          }}>
            <div style={{ pointerEvents: 'auto' }}>
              <StatDisplay stats={stats} statIdx={statIdx} onPrev={prevStat} onNext={nextStat}>
                {(leaderboard.length > 0 || threadBoard.length > 0) && (
                  <DailyLeaderboard
                    entries={leaderboard}
                    threadEntries={threadBoard}
                    latestCounts={latestCounts}
                    deltas={deltas}
                    stacked={narrow}
                    threadMeta={threadMeta}
                  />
                )}
              </StatDisplay>
            </div>

            {!narrow && <BlogRail featured={latestBlog ?? null} recent={recentBlogs} canPost={canPostBlog} />}

            {!isLoggedIn && (
              <div style={{ marginTop: 36, pointerEvents: 'auto' }}>
                <a href={process.env.NEXT_PUBLIC_LOGIN ?? '/api/auth/login'} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '10px 26px',
                  background: '#f97316', color: '#000',
                  fontFamily: 'monospace', fontWeight: 900, fontSize: 12,
                  letterSpacing: '0.2em', textDecoration: 'none', textTransform: 'uppercase',
                  clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = '' }}
                >
                  LOGIN WITH DISCORD
                </a>
              </div>
            )}

          </div>

          <div inert={parkMode} style={{
            ...furniture,
            flex: narrow ? 'none' : 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: narrow ? '24px 28px 40px' : 'clamp(32px,5vw,72px)',
            paddingLeft: narrow ? 28 : 'clamp(24px,3.5vw,52px)',
            paddingBottom: narrow ? PARK_PEEK_PX : undefined,
          }}>
            <div
              key={menu}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 6,
                animation: menuSwitched ? 'menuSwitch 0.3s cubic-bezier(0.23,1,0.32,1) both' : undefined,
                pointerEvents: 'auto',
              }}
            >
              {activeMenu.map(item => (
                <Tile key={item.href} item={item} />
              ))}
              <MenuTile
                label={menu === 'primary' ? 'MORE ›' : '← BACK'}
                active={menu !== 'primary'}
                onToggle={() => { setMenuSwitched(true); setMenu(menu === 'primary' ? 'more' : 'primary') }}
              />
            </div>

            <div style={{
              height: 1,
              margin: '18px 0 14px',
              background: 'linear-gradient(90deg, rgb(var(--shadow-rgb) / 0.35), rgb(var(--shadow-rgb) / 0.08) 70%, transparent)',
            }} />

            <DiscordTile memberCount={discordMembers} />

            <div style={{ display: 'grid', gap: 6, pointerEvents: 'auto' }}>
              {gameRows.map((row, rowIdx) => (
                <div
                  key={rowIdx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${row.reduce((n, g) => n + g.weight, 0)}, 1fr)`,
                    gap: 6,
                  }}
                >
                  {row.map(item => (
                    <Tile
                      key={item.href}
                      item={item}
                    />
                  ))}
                </div>
              ))}
            </div>

            {narrow && <BlogRail featured={latestBlog ?? null} recent={recentBlogs} canPost={canPostBlog} />}
          </div>

      </div>
    </>
  )
}

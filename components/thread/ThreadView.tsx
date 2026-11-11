'use client'

import { useRef, useCallback, useEffect, useState, useMemo, useSyncExternalStore } from 'react'
import * as threadStats from '@/lib/threadStatsStore'
import dynamic from 'next/dynamic'
import { getSocket } from '@/lib/socket'
import { LatencyReporter } from '@/lib/latencyTelemetry'
import { noteOwnPost } from '@/lib/clientHealth'
import { useFavicon } from '@/lib/useFavicon'
import SubmitBox from './SubmitBox'
import InlineThreadPicker from './InlineThreadPicker'
import { useRedditFeed } from './useRedditFeed'
import { LC_THREAD_ID, LC_THREAD_NAME, LC_THREAD_TITLE, LC_THREAD_UUID, REDDIT_RATE_LIMIT_MS } from '@/lib/reddit'
import { hourBarHTML, hourBarKey } from '@/lib/hourBar'
import { useHourBarRelabel } from '@/lib/useDayRollover'
import ReactionPickerOverlay from './ReactionPickerOverlay'
import RegionPicker from './RegionPicker'
import { useRegional, type Regional } from './useRegional'
import { attachSocket } from '@/lib/regional'
import { RankIconBadge } from '@/components/rank/RankIconBadge'
import type { ThreadRankRow } from '@/lib/rankUtils'
import type { ActiveMacroRuntime } from '@/lib/macroRuntime'
import type { Socket } from 'socket.io-client'
import { getInterpolatedReplyColor, REPLY_BADGE_INK, formatTimeSince, formatTimestamp, formatFullTimestamp, timestampShowsDate, standardizeCountFormat } from '@/lib/postHelpers'
import { formatOdds, formatRoll, rarityColor, logPosition, rollTrackDecade } from '@/lib/rolls'
import { escapeHtml, getEmote } from '@/lib/emotes'
import { safeColor } from '@/lib/safeColor'
import { getNativeEmoji } from '@/lib/nativeEmoji'
import { renderMarkdown } from '@/lib/markdown'
import { avatarUrl as counterAvatarUrl, buildCounterMap } from '@/lib/counterUtils'
import { useEdgeLoader } from '@/lib/useEdgeLoader'
import { ensurePaceClock, paceDeltaAt, formatDelta, setPaceTarget, setSplitConfig, seedPaceCounts, seedPaceSplits, setPaceCounts, setTargetSplitMs } from '@/lib/paceClock'
import Boundary from '@/components/Boundary'
import BingoStrip, { BingoStripSkeleton } from '@/components/bingo/BingoStrip'
import BingoTeamEmoji from '@/components/bingo/BingoTeamEmoji'
import { notifyRateLimited } from '@/lib/rateLimitNotice'
import type { CounterInfo } from '@/lib/counterUtils'
import { DEFAULT_PREFS, type ResolvedPrefs } from '@/lib/prefs'
import { toRenderPrefs, type RenderPrefs } from '@/lib/renderPrefs'
import { useThreadColors, useThreadNav } from '@/app/providers'
import { getCachedThread, seedThreadPostCache } from '@/lib/threadPostCache'
import { PrefsContext } from './PrefsContext'
import AboutTab, { type ThreadInfo } from './AboutTab'

const tabLoading = () => (
  <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--ink-3)' }}>Loading…</div>
)

const loadPrefsEditor = () => import('./PrefsEditor')
const loadChatsTab = () => import('./ChatsTab')
const loadSplitsTab = () => import('./SplitsTab')
const loadStatsTab = () => import('./StatsTab')
const loadRankTab = () => import('./RankTab')

const tabLoaders: Partial<Record<SidebarTab, () => Promise<unknown>>> = {
  prefs: loadPrefsEditor,
  chats: loadChatsTab,
  splits: loadSplitsTab,
  stats: loadStatsTab,
  rank: loadRankTab,
}

function prefetchTab(tab: SidebarTab, isReddit: boolean) {
  if (isReddit) return
  void tabLoaders[tab]?.().catch(() => {})
}

const PrefsEditor = dynamic(loadPrefsEditor, { ssr: false, loading: tabLoading })
const ChatsTab = dynamic(loadChatsTab, { ssr: false, loading: tabLoading })
const SplitsTab = dynamic(loadSplitsTab, { ssr: false, loading: tabLoading })
const StatsTab = dynamic(loadStatsTab, { ssr: false, loading: tabLoading })
const RankTab = dynamic(loadRankTab, { ssr: false, loading: tabLoading })
const RedditAboutTab = dynamic(
  () => import('./RedditTabs').then(m => m.RedditAboutTab),
  { ssr: false, loading: tabLoading },
)
const RedditChatsTab = dynamic(() => import('./RedditChatsTab'), { ssr: false, loading: tabLoading })
const RedditStatsTab = dynamic(() => import('./RedditStatsTab'), { ssr: false, loading: tabLoading })
import type { LagStats, RedditAbout } from './useRedditFeed'
import type { MiscSettings, CategoryWithoutFullThreads } from '@/lib/types'
import { flipListOn, liveRowLimit, useDevicePerf } from '@/lib/devicePerf'


function ReplayLauncher({ threadName }: { threadName: string }) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const go = () => {
    const params = new URLSearchParams()
    if (start) params.set('start', start)
    if (end) params.set('end', end)
    const qs = params.toString()
    window.open(`/replay/${encodeURIComponent(threadName)}${qs ? '?' + qs : ''}`, '_blank')
  }
  const inp: React.CSSProperties = {
    background: 'var(--thread-surface)', border: '1px solid var(--thread-line)',
    borderRadius: 6, color: 'var(--thread-ink)', fontSize: '0.85rem', padding: '6px 10px', width: '100%',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={{ fontSize: '0.7rem', color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Start count #</label>
          <input type="number" min="1" placeholder="e.g. 1" value={start} onChange={e => setStart(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={{ fontSize: '0.7rem', color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>End count # (optional)</label>
          <input type="number" min="1" placeholder="leave blank for all" value={end} onChange={e => setEnd(e.target.value)} style={inp} />
        </div>
      </div>
      <button
        onClick={go}
        disabled={!start}
        style={{
          background: start ? 'rgba(76,175,80,0.25)' : 'var(--thread-surface)',
          border: `1px solid ${start ? 'rgba(76,175,80,0.5)' : 'var(--thread-line)'}`,
          borderRadius: 6, color: start ? 'var(--success-ink)' : 'var(--ink-3)', cursor: start ? 'pointer' : 'not-allowed',
          fontSize: '0.85rem', padding: '8px 14px', fontWeight: 600,
        }}
      >
        Open Replay ↗
      </button>
    </div>
  )
}

const MAX_VISIBLE = 50
const HISTORY_PAGE = 50
const MAX_HISTORY_ROWS = 1000
const POST_EMOTE_SIZE = 28
const NAVBAR_HEIGHT = 'var(--navbar-h, 65px)'

const buildHourBarHTML = (ts: string | undefined) =>
  hourBarHTML(ts, {
    lineColor: 'var(--thread-line)',
    labelStyle: 'font-size:12px;color:var(--thread-muted)',
  })

function buildInitialHTML(posts: PostRow[], prefs: RenderPrefs): string {
  const chunks: string[] = []
  let lastKey = ''
  let lastTs: string | undefined
  for (const p of posts) {
    const k = hourBarKey(p.timestamp)
    if (k && k !== lastKey) {
      if (lastKey !== '') chunks.push(buildHourBarHTML(lastTs))
      lastKey = k
    }
    if (p.timestamp) lastTs = p.timestamp
    chunks.push(buildRowHTML(p, prefs))
  }
  return chunks.join('')
}


function stampPaceDelta(li: Element, delta: number | null) {
  const text = formatDelta(delta)
  if (!text || delta == null) return
  const host = li.querySelector<HTMLElement>('.post-count')
  if (!host || host.querySelector('.pace-delta')) return

  const badge = document.createElement('span')
  badge.className = 'pace-delta'
  badge.textContent = `(${text})`
  badge.style.cssText =
    'margin-left:6px;font-size:0.72em;font-weight:800;font-family:var(--font-mono);' +
    `vertical-align:baseline;color:${delta > 0 ? 'var(--success-ink)' : 'var(--danger)'};` +
    `opacity:${Math.abs(delta) < 1 ? '0.62' : '1'};`
  host.appendChild(badge)
}

function markLatestCount(ol: HTMLUListElement, enabled: boolean, highlightColor: string) {
  const prev = ol.querySelector<HTMLLIElement>('.post-row.is-latest-count')
  if (prev) {
    prev.classList.remove('is-latest-count')
    prev.style.border = ''
    prev.style.background = ''
  }
  if (!enabled) return
  const next = ol.querySelector<HTMLLIElement>('.post-row[data-is-count="1"]')
  if (next) {
    next.classList.add('is-latest-count')
    next.style.border = `1px solid ${highlightColor}`
    next.style.background = `${highlightColor}1c`
  }
}

export interface PostRow {
  uuid: string
  threadName?: string
  countContent?: string
  rawCount?: string
  rawText: string
  comment?: string
  isValidCount: boolean
  stricken: boolean
  timestamp: string
  timeSinceLastPost?: number
  validCountNumber?: number
  timeSinceLastCount?: number | string
  authorUUID: string
  authorUsername: string
  authorName: string
  authorColor: string
  authorEmoji?: string
  authorAvatarUrl?: string
  latency?: number
  reactions?: Record<string, string[]>
  roll?: number
  chance?: number
}

export { defaultRenderPrefs, toRenderPrefs, type RenderPrefs } from '@/lib/renderPrefs'

const LOGIN_URL = process.env.NEXT_PUBLIC_LOGIN ?? '/api/auth/login'

const NARROW_LAYOUT = '(max-width: 1199px)'

type SidebarTab = 'about' | 'chats' | 'splits' | 'rank' | 'stats' | 'replay' | 'prefs'
const SIDEBAR_TABS: { value: SidebarTab; label: string }[] = [
  { value: 'about',  label: 'About'  },
  { value: 'chats',  label: 'Chats'  },
  { value: 'splits', label: 'Splits' },
  { value: 'rank',   label: 'Rank'   },
  { value: 'stats',  label: 'Stats'  },
  { value: 'replay', label: 'Replay' },
  { value: 'prefs',  label: 'Prefs'  },
]

const REDDIT_DISABLED_TABS: SidebarTab[] = ['splits', 'rank', 'replay']

const LOGIN_ONLY_TABS: SidebarTab[] = ['rank', 'prefs']

function isTabUsable(tab: SidebarTab, isReddit: boolean, isLoggedIn: boolean): boolean {
  if (!isLoggedIn && LOGIN_ONLY_TABS.includes(tab)) return false
  return !isReddit || !REDDIT_DISABLED_TABS.includes(tab)
}

interface RecentSplit {
  number: string
  split: number
  replay?: string
}

interface ThreadViewProps {
  threadName: string
  threadTitle: string
  threadUUID?: string
  threadEnabled?: boolean
  initialPosts: PostRow[]
  ssrNewestTimestamp: string | null
  contextUUID?: string
  isLoggedIn: boolean
  userUUID?: string
  userUsername?: string
  userRoles?: string[]
  userXP?: number
  bingoGameId?: number | null
  prefs: ResolvedPrefs
  thread?: ThreadInfo
  miscSettings?: MiscSettings
  initialSplits?: RecentSplit[]
  isReddit?: boolean
  reddit?: string
  redditAccess?: string
  ssrRedditAbout?: any
}

const LIVECOUNTING_THREAD_INFO: ThreadInfo = {
  uuid: LC_THREAD_UUID,
  name: LC_THREAD_NAME,
  title: LC_THREAD_TITLE,
  description: "Reddit's live counting thread, mirrored through counting.gg.",
  rules: '',
  threadOfTheDay: false,
  countBans: [],
  autoValidated: false,
  allowDoublePosts: true,
  resetOnMistakes: false,
  validationType: 'main',
  firstValidCount: '',
  locked: false,
  postBans: [],
  updatableBy: [],
} as ThreadInfo

export interface LastCountInfo {
  lastCount?: { rawText?: string; rawCount?: string; countContent?: string; timestamp?: string; authorUUID?: string }
  lastCounter?: { uuid: string; username: string; name?: string; color?: string }
}

export interface DailyHOCEntry {
  counter: CounterInfo
  counts: number
}

function toPostRows(posts: any[], counters: any[], threadName?: string): PostRow[] {
  const counterMap = buildCounterMap<any>(counters)
  return posts.map((p: any) => {
    const author = counterMap.get(p.authorUUID)
    return {
      uuid: p.uuid,
      threadName,
      rawText: p.rawText,
      countContent: p.countContent,
      rawCount: p.rawCount,
      roll: p.roll ?? undefined,
      chance: p.chance ?? undefined,
      comment: p.comment,
      isValidCount: p.isValidCount,
      stricken: p.stricken,
      timestamp: p.timestamp,
      timeSinceLastPost: p.timeSinceLastPost,
      validCountNumber: p.validCountNumber,
      timeSinceLastCount: p.timeSinceLastCount,
      authorUUID: p.authorUUID,
      authorUsername: author?.username ?? 'unknown',
      authorName: author?.name ?? author?.username ?? 'unknown',
      authorColor: author?.color ?? '#888888',
      authorEmoji: author?.emoji,
      authorAvatarUrl: author ? avatarUrl(author.discordId, author.avatar) : undefined,
      reactions: p.reactions ?? undefined,
    }
  })
}

const STRICKEN_SOUND_ROLL_SUPPRESSED = new Set(['1inx', 'incremental_odds'])

export function shouldSuppressStrickenSound(threadName: string, roll: number | null | undefined): boolean {
  return STRICKEN_SOUND_ROLL_SUPPRESSED.has(threadName) && roll !== undefined && roll !== null
}

const STRICKEN_POOL_MAX = 6
let strickenAudioProto: HTMLAudioElement | null = null
const strickenActive: HTMLAudioElement[] = []

function playStrickenSound() {
  if (typeof window === 'undefined') return
  if (!strickenAudioProto) {
    strickenAudioProto = new Audio('/sounds/ding.mp3')
    strickenAudioProto.preload = 'auto'
  }
  if (strickenActive.length >= STRICKEN_POOL_MAX) {
    const oldest = strickenActive.shift()
    oldest?.pause()
  }
  const instance = strickenAudioProto.cloneNode() as HTMLAudioElement
  strickenActive.push(instance)
  instance.addEventListener(
    'ended',
    () => {
      const i = strickenActive.indexOf(instance)
      if (i > -1) strickenActive.splice(i, 1)
    },
    { once: true },
  )
  instance.play().catch(() => {})
}

function avatarUrl(discordId: string, avatar: string) {
  return counterAvatarUrl({ discordId, avatar })
}

const avatarCache = new Map<string, string>()

function getAvatarHTML(post: PostRow): string {
  if (_rowsAreReddit) return ''
  const key = post.authorUUID || post.authorUsername
  const cached = avatarCache.get(key)
  if (cached) return cached
  const color = safeColor(post.authorColor)
  const bg = color + '33'
  const fallbackLabel = escapeHtml(post.authorEmoji ?? post.authorUsername.slice(0, 2).toUpperCase())
  const inner = post.authorAvatarUrl
    ? `<img src="${escapeHtml(post.authorAvatarUrl)}" alt="" width="24" height="24" style="border-radius:50%;object-fit:cover;display:block;">`
    : `<span style="font-size:9px;font-weight:700;color:${color};background:${bg};width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${fallbackLabel}</span>`
  const html = `<div class="post-avatar" style="width:24px;height:24px;border-radius:50%;flex-shrink:0;overflow:hidden;">${inner}</div>`
  avatarCache.set(key, html)
  return html
}

let _currentUserUUID = ''
let _currentUserRoles: string[] = []
let _currentThreadName = ''
let _rowsAreReddit = false
let _rowsValidationType: string | undefined
export function setRowThreadName(name: string, isReddit = false, validationType?: string) {
  _currentThreadName = name
  _rowsAreReddit = isReddit
  _rowsValidationType = validationType
}

export function setRowViewer(uuid: string | undefined, roles: string[] | undefined) {
  _currentUserUUID = uuid ?? ''
  _currentUserRoles = roles ?? []
}

let _rowsInteractive = true
const _liveUuids = new Set<string>()
function markLive(uuid: string) {
  _liveUuids.add(uuid)
  if (_liveUuids.size > 2000) {
    let drop = _liveUuids.size - 1500
    for (const id of _liveUuids) { if (drop-- <= 0) break; _liveUuids.delete(id) }
  }
}
export function setRowInteractive(interactive: boolean) {
  _rowsInteractive = interactive
}

function buildTimeCol(tsLabel: string, tsFull: string, timeSinceLastPost: number | undefined, latency: number | undefined, avatarHTML: string, prefs: RenderPrefs, postUuid: string, rowThreadName?: string, labelHasDate = false): string {
  const timeClass = labelHasDate ? 'post-time has-date' : 'post-time'
  const permalinkThread = rowThreadName || _currentThreadName
  const latencySpan = latency != null && prefs.pref_show_latency
    ? `<span style="font-size:10px;color:var(--thread-muted);font-family:var(--font-mono);white-space:nowrap;" title="End-to-end latency">${Math.round(latency)}ms</span>`
    : `<span style="font-size:10px;visibility:hidden;">0ms</span>`

  let badgeSpan: string
  if (timeSinceLastPost != null && timeSinceLastPost >= 0) {
    const bgColor = getInterpolatedReplyColor(timeSinceLastPost, prefs.pref_reply_time_interval)
    const { h, m, s, ms, paddedMs } = formatTimeSince(timeSinceLastPost)
    const msDisplay = timeSinceLastPost > 999 ? paddedMs : ms
    const u = (n: number | string, unit: string) => `${n}<span style="font-size:9.5px;font-weight:600;">${unit}</span>`
    const units: string[] = []
    if (h > 0) units.push(u(h, 'h'))
    if (m > 0 || h > 0) units.push(u(m, 'm'))
    if (units.length < 2) {
      if (s > 0 || m > 0 || h > 0) units.push(u(s, 's'))
    }
    if (units.length < 2) units.push(u(msDisplay, 'ms'))
    badgeSpan = `<span class="post-reply" style="background:${bgColor};border-radius:3px;padding:1px 4px;font-size:13px;font-weight:600;line-height:1.45;text-align:right;display:inline-block;white-space:nowrap;color:${REPLY_BADGE_INK};">${units.join(' ')}</span>`
  } else {
    badgeSpan = `<span class="post-reply" style="display:inline-block;"></span>`
  }

  return (
    `<div class="post-meta" style="flex-shrink:0;display:flex;align-items:center;">` +
    `<span class="post-latency" style="text-align:right;display:inline-block;flex-shrink:0;">${latencySpan}</span>` +
    (permalinkThread
      ? `<a href="${_rowsAreReddit
            ? `https://www.reddit.com/live/${LC_THREAD_ID}/updates/${encodeURIComponent(postUuid)}`
            : `/thread/${encodeURIComponent(permalinkThread)}/${encodeURIComponent(postUuid)}`}" ` +
        (_rowsAreReddit ? `target="_blank" rel="noreferrer noopener" ` : '') +
        `title="${tsFull}${tsFull ? ': ' : ''}${_rowsAreReddit ? 'view on Reddit' : 'permalink'}" ` +
        `class="${timeClass}" style="font-size:10.5px;color:var(--thread-muted);text-align:right;display:inline-block;overflow:hidden;` +
        `text-decoration:none;flex-shrink:0;" ` +
        `onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${tsLabel}</a>`
      : `<span class="${timeClass}" style="font-size:10.5px;color:var(--thread-muted);text-align:right;display:inline-block;overflow:hidden;" title="${tsFull}">${tsLabel}</span>`) +
    avatarHTML +
    `<span class="post-reply-slot">${badgeSpan}</span>` +
    `</div>`
  )
}

function buildReactionChipsHTML(post: PostRow): string {
  const entries = Object.entries(post.reactions ?? {})
    .filter(([, users]) => Array.isArray(users) && users.length > 0)
  if (entries.length === 0) return ''

  const chips = entries.map(([id, users]) => {
    const mine = users.includes(_currentUserUUID)
    const emote = getEmote(id)
    const inner = emote
      ? `<img src="${escapeHtml(emote.imgUrl)}" alt="${escapeHtml(id)}" style="height:15px;width:auto;vertical-align:-3px;">`
      : escapeHtml(getNativeEmoji(id) ?? id)
    return (
      `<button data-action="toggle-reaction" data-uuid="${post.uuid}" data-reaction="${escapeHtml(id)}" ` +
      `title="${escapeHtml(id)}" ` +
      `style="display:inline-flex;align-items:center;gap:3px;padding:0 5px;height:19px;border-radius:9px;cursor:pointer;` +
      `font-size:11px;line-height:1;flex-shrink:0;` +
      `border:1px solid ${mine ? 'var(--thread-accent)' : 'var(--thread-line)'};` +
      `background:${mine ? 'var(--thread-accent-soft)' : 'var(--thread-surface)'};` +
      `color:${mine ? 'var(--thread-accent)' : 'var(--thread-ink)'};">` +
      inner +
      `<span>${users.length}</span>` +
      `</button>`
    )
  }).join('')

  return `<span style="display:flex;flex-wrap:wrap;align-items:center;gap:3px;flex-basis:100%;width:100%;margin-top:1px;">${chips}</span>`
}

function buildAddReactionHTML(post: PostRow): string {
  return (
    `<button data-action="add-reaction" data-uuid="${post.uuid}" class="reaction-add" ` +
    `title="Add reaction" ` +
    `style="display:inline-flex;align-items:center;background:none;border:none;cursor:pointer;color:var(--thread-muted);` +
    `font-size:13px;padding:2px 4px;border-radius:4px;flex-shrink:0;line-height:1;">☺</button>`
  )
}

function strickenRowStyle(stricken: boolean, dim: boolean, prefs: RenderPrefs): string {
  const opacity = dim ? Math.max(0, Math.min(1, prefs.pref_stricken_count_opacity)) : 1
  if (!stricken || prefs.pref_custom_stricken === 'Disabled') {
    return `opacity:${opacity};`
  }
  const bg = prefs.pref_strike_color
  return `opacity:${opacity};--strike:${bg};--strike-inv:${invertHexColor(bg)};`
}

function strickenRowClass(stricken: boolean, prefs: RenderPrefs): string {
  if (!stricken || prefs.pref_custom_stricken === 'Disabled') return ''
  return prefs.pref_custom_stricken === 'Inverse' ? ' strike-inv' : ' strike-on'
}

function invertHexColor(color: string): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((color || '').trim())
  if (!m) return color
  const hex = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  return '#' + (0xffffff ^ parseInt(hex, 16)).toString(16).padStart(6, '0')
}

function buildNameHTML(post: PostRow): string {
  const name = escapeHtml(post.authorName)
  if (!post.authorEmoji) return name
  const e = `<span class="post-emoji">${escapeHtml(post.authorEmoji)}</span>`
  return `${e} ${name} ${e}`
}

export function buildRowHTML(post: PostRow, prefs: RenderPrefs, forceExpanded = false): string {
  const color = safeColor(post.authorColor)
  const stricken = post.stricken
  const dim = stricken || !post.isValidCount
  const isCount = post.isValidCount && !stricken
  const minimized = !forceExpanded && stricken && !post.comment && prefs.pref_hide_stricken === 'Minimize'
  const hidden = !forceExpanded && stricken && !post.comment && prefs.pref_hide_stricken === 'Hide'

  const tsLabel = post.timestamp ? formatTimestamp(post.timestamp, prefs.pref_timestamp_display) : ''
  const tsFull = post.timestamp ? formatFullTimestamp(post.timestamp, prefs.pref_timestamp_display) : ''
  const timeCol = buildTimeCol(tsLabel, tsFull, post.timeSinceLastPost, post.latency, getAvatarHTML(post), prefs, post.uuid, post.threadName, !!post.timestamp && timestampShowsDate(post.timestamp, prefs.pref_timestamp_display))

  const nameDisplay = buildNameHTML(post)
  const commentHTML = post.comment
    ? `<span class="md" style="font-size:14px;color:var(--thread-ink);margin-left:4px;">${renderMarkdown(post.comment, POST_EMOTE_SIZE)}</span>`
    : ''
  const rawDisplayText = post.countContent ?? (!post.comment ? post.rawText : null)
  const displayText = rawDisplayText
    ? escapeHtml(post.countContent != null
        ? standardizeCountFormat(post.countContent, prefs.pref_standardize_format, _rowsValidationType)
        : rawDisplayText)
    : rawDisplayText
  const countSpan = displayText
    ? `<span class="post-count" style="font-size:${prefs.pref_post_font_size}px;font-family:var(--font-mono);font-weight:600;${stricken ? 'text-decoration:line-through;color:var(--thread-muted);' : ''}">${displayText}</span>`
    : ''
  const reactionChips = buildReactionChipsHTML(post)
  const contentCol =
    `<div class="post-content" style="flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px;overflow-wrap:anywhere;">` +
    countSpan +
    buildRollChipHTML(post) +
    commentHTML +
    `<a class="post-name" data-u="${escapeHtml(post.authorUUID)}" href="/counter/${encodeURIComponent(post.authorUsername)}" style="font-size:14px;color:${escapeHtml(color)};text-decoration:none;flex-shrink:0;" ` +
    `onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${nameDisplay}</a>` +
    reactionChips +
    ((isCount && Number.isFinite(Number(post.validCountNumber))) || (post.latency != null && prefs.pref_show_latency)
      ? `<span class="post-vcn-inline"><span>${isCount && Number.isFinite(Number(post.validCountNumber)) ? `#${Number(post.validCountNumber).toLocaleString()}` : ''}${post.latency != null && prefs.pref_show_latency && isCount && Number.isFinite(Number(post.validCountNumber)) ? '&nbsp;&nbsp;' : ''}${post.latency != null && prefs.pref_show_latency ? `${Math.round(post.latency)}ms` : ''}</span></span>`
      : '') +
    `</div>`
  const rowAlign = reactionChips ? 'flex-start' : 'center'

  const canDelete = _rowsInteractive && post.comment &&
    (_currentUserUUID === post.authorUUID || _currentUserRoles.includes('mod'))
  const deleteBtn = canDelete
    ? `<button data-action="delete-comment" data-uuid="${post.uuid}" ` +
      `style="display:none;background:none;border:none;cursor:pointer;color:var(--thread-muted);font-size:12px;padding:2px 4px;border-radius:4px;flex-shrink:0;" ` +
      `title="Delete comment (hold Shift to skip the confirmation)">✕</button>`
    : ''

  if (hidden) {
    return `<li data-uuid="${post.uuid}" data-is-count="0" class="post-row hidden-post" style="display:none;"></li>`
  }

  if (minimized) {
    return (
      `<li data-uuid="${post.uuid}" data-is-count="${isCount ? '1' : '0'}"${isCount ? ` data-count="${Number(post.validCountNumber)}" data-ts="${Number(post.timestamp) || 0}"` : ''} class="post-row minimized-post" style="display:flex;align-items:center;padding:2px 8px;border-radius:6px;">` +
      `<span data-action="toggle-minimized" data-uuid="${post.uuid}" style="cursor:pointer;font-size:11px;color:var(--thread-muted);user-select:none;">[+] Show hidden post</span>` +
      `</li>`
    )
  }

  return (
    `<li data-uuid="${post.uuid}" data-is-count="${isCount ? '1' : '0'}"${isCount ? ` data-count="${Number(post.validCountNumber)}" data-ts="${Number(post.timestamp) || 0}"` : ''} class="post-row${_liveUuids.has(post.uuid) ? ' post-live' : ''}${strickenRowClass(stricken, prefs)}" style="display:flex;align-items:${rowAlign};padding:2px 8px;border-radius:6px;${strickenRowStyle(stricken, dim, prefs)}" ` +
    `onmouseenter="this.querySelector('[data-action=delete-comment]')&&(this.querySelector('[data-action=delete-comment]').style.display='inline-block')" ` +
    `onmouseleave="this.querySelector('[data-action=delete-comment]')&&(this.querySelector('[data-action=delete-comment]').style.display='none')">` +
    timeCol + contentCol + (_rowsInteractive ? buildAddReactionHTML(post) : '') + deleteBtn +
    (isCount && Number.isFinite(Number(post.validCountNumber))
      ? `<span class="post-vcn">#${Number(post.validCountNumber).toLocaleString()}</span>`
      : '') +
    `</li>`
  )
}

function buildRollChipHTML(post: PostRow): string {
  const roll = Number(post.roll)
  const chance = Number(post.chance)
  if (post.roll == null || !Number.isFinite(roll) || roll <= 0) return ''
  const hasChance = Number.isFinite(chance) && chance > 0

  const hit = hasChance && roll <= chance
  const color = hit ? 'var(--success)' : rarityColor(roll)

  const decade = rollTrackDecade(roll, hasChance ? chance : roll)
  const rollPos = Math.round(logPosition(roll, decade) * 100)
  const chancePos = hasChance ? Math.round(logPosition(chance, decade) * 100) : null

  const rollText = escapeHtml(formatRoll(roll))
  const chanceText = hasChance ? escapeHtml(formatRoll(chance)) : ''
  const op = hit ? '&lt;' : '&gt;'

  const title = hasChance
    ? `Rolled ${rollText} (${escapeHtml(formatOdds(roll))}) against ${chanceText} (${escapeHtml(formatOdds(chance))}): ${hit ? 'hit' : 'missed'}`
    : `Rolled ${rollText} (${escapeHtml(formatOdds(roll))})`

  const track = hasChance
    ? `<span style="position:relative;display:block;width:44px;height:7px;flex-shrink:0;">` +
        `<span style="position:absolute;left:0;right:0;top:3px;height:1px;` +
        `background:var(--thread-line);"></span>` +
        `<span style="position:absolute;left:${chancePos}%;top:0;width:1px;height:7px;` +
        `background:color-mix(in srgb, var(--thread-ink) 55%, transparent);transform:translateX(-0.5px);"></span>` +
        `<span style="position:absolute;left:${rollPos}%;top:1.5px;width:4px;height:4px;` +
        `border-radius:50%;background:${color};transform:translateX(-2px);"></span>` +
      `</span>`
    : ''

  return (
    `<span title="${title}" ` +
    `style="display:inline-flex;align-items:center;gap:4px;flex-shrink:0;` +
    `padding:1px 7px 2px;border-radius:999px;` +
    `background:${color}1a;border:1px solid ${color}${hit ? 'cc' : '55'};">` +
      (hit ? `<span style="font-size:10px;color:${color};line-height:1;">★</span>` : '') +
      `<span style="font-size:10.5px;font-weight:800;color:${color};` +
      `font-variant-numeric:tabular-nums;white-space:nowrap;">${rollText}</span>` +
      (hasChance
        ? `<span style="font-size:10px;opacity:0.6;line-height:1;">${op}</span>` +
          `<span style="font-size:10.5px;font-weight:600;opacity:0.75;` +
          `font-variant-numeric:tabular-nums;white-space:nowrap;">${chanceText}</span>`
        : '') +
      track +
    `</span>`
  )
}

function buildCommentDeletedRowHTML(post: PostRow, prefs: RenderPrefs): string {
  const color = safeColor(post.authorColor)
  const stricken = post.stricken
  const dim = stricken || !post.isValidCount
  const isCount = post.isValidCount && !stricken
  const tsLabel = post.timestamp ? formatTimestamp(post.timestamp, prefs.pref_timestamp_display) : ''
  const tsFull = post.timestamp ? formatFullTimestamp(post.timestamp, prefs.pref_timestamp_display) : ''
  const timeCol = buildTimeCol(tsLabel, tsFull, post.timeSinceLastPost, undefined, getAvatarHTML(post), prefs, post.uuid, post.threadName, !!post.timestamp && timestampShowsDate(post.timestamp, prefs.pref_timestamp_display))

  const nameDisplay = buildNameHTML(post)
  const rawDisplayText = post.countContent ?? post.rawText
  const displayText = escapeHtml(post.countContent != null
    ? standardizeCountFormat(post.countContent, prefs.pref_standardize_format, _rowsValidationType)
    : rawDisplayText)
  const countSpan = displayText
    ? `<span class="post-count" style="font-size:${prefs.pref_post_font_size}px;font-family:var(--font-mono);font-weight:600;${stricken ? 'text-decoration:line-through;color:var(--thread-muted);' : ''}">${displayText}</span>`
    : ''
  const deletedComment = `<span style="font-size:14px;color:var(--thread-muted);font-style:italic;margin-left:4px;">[deleted]</span>`
  const contentCol =
    `<div class="post-content" style="flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px;overflow-wrap:anywhere;">` +
    countSpan +
    deletedComment +
    `<a class="post-name" data-u="${escapeHtml(post.authorUUID)}" href="/counter/${encodeURIComponent(post.authorUsername)}" style="font-size:14px;color:${escapeHtml(color)};text-decoration:none;flex-shrink:0;" ` +
    `onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${nameDisplay}</a>` +
    buildReactionChipsHTML(post) +
    `</div>`

  return (
    `<li data-uuid="${post.uuid}" data-is-count="${isCount ? '1' : '0'}"${isCount ? ` data-count="${Number(post.validCountNumber)}" data-ts="${Number(post.timestamp) || 0}"` : ''} class="post-row${_liveUuids.has(post.uuid) ? ' post-live' : ''}${strickenRowClass(stricken, prefs)}" style="display:flex;align-items:center;padding:2px 8px;border-radius:6px;${strickenRowStyle(stricken, dim, prefs)}">` +
    timeCol + contentCol + (_rowsInteractive ? buildAddReactionHTML(post) : '') +
    `</li>`
  )
}

function SidebarPanel({
  threadTitle, threadName, status, statusColor, watcherCount, activeTab, onTabChange,
  threadUUID, threadEnabled, socket, isLive, thread, userUUID, userUsername, userXP, userRoles, isLoggedIn, splits,
  onMacroRuntimeChange, isReddit, redditAbout, redditLag, redditLatency, redditStatus, redditUsername, redditAccess,
  threadValidationType, regional,
}: {
  regional: Regional
  redditAccess?: string
  onMacroRuntimeChange?: (runtime: ActiveMacroRuntime | null) => void
  isReddit?: boolean
  redditAbout?: RedditAbout | null
  redditLag?: LagStats
  redditLatency?: LagStats
  threadValidationType?: string
  redditStatus?: string
  redditUsername?: string
  threadTitle: string
  threadName: string
  status: string
  statusColor: string
  watcherCount: number | null
  activeTab: SidebarTab
  onTabChange: (t: SidebarTab) => void
  threadUUID?: string
  threadEnabled?: boolean
  socket: Socket | null
  isLive: boolean
  thread?: ThreadInfo
  userUUID?: string
  userUsername?: string
  userXP?: number
  userRoles?: string[]
  isLoggedIn: boolean
  splits: RecentSplit[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px 8px', flexShrink: 0,
        borderBottom: '1px solid var(--thread-surface)',
      }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {threadTitle}
        </h1>
        {(() => {
          const viewers = (isReddit ? redditAbout?.viewerCount ?? null : watcherCount)
          return (
            <span
              title={viewers === null ? undefined
                : `${viewers} ${viewers === 1 ? 'person is' : 'people are'} viewing this thread${isReddit ? ' on Reddit' : ''}`}
              style={{
                display: 'inline-flex', alignItems: 'baseline', gap: 5,
                fontSize: 13, color: statusColor, fontWeight: 600,
                fontFamily: 'monospace', flexShrink: 0,
              }}
            >
              {!regional.owner?.movable && (
                <span style={{
                  minWidth: '7ch', textAlign: 'right', color: 'var(--thread-muted)',
                  fontVariantNumeric: 'tabular-nums', visibility: regional.ping === null ? 'hidden' : 'visible',
                }}>
                  {regional.ping ?? 0} ms
                </span>
              )}
              <span>●{viewers !== null ? ` ${viewers}` : ''} {status}</span>
            </span>
          )
        })()}
        <RegionPicker regional={regional} isLoggedIn={isLoggedIn} />
      </div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 0,
        borderBottom: '1px solid var(--thread-line)', flexShrink: 0,
      }}>
        {SIDEBAR_TABS.map(({ value, label }) => {
          const usable = isTabUsable(value, !!isReddit, isLoggedIn)
          const why = !usable
            ? (!isLoggedIn && LOGIN_ONLY_TABS.includes(value) ? 'Sign in to use this' : `Not available on ${threadTitle}`)
            : undefined
          return (
            <button
              key={value}
              onClick={() => usable && onTabChange(value)}
              onMouseEnter={() => usable && prefetchTab(value, !!isReddit)}
              onFocus={() => usable && prefetchTab(value, !!isReddit)}
              disabled={!usable}
              title={why}
              style={{
                padding: '8px 12px', background: 'none', border: 'none',
                cursor: usable ? 'pointer' : 'not-allowed',
                fontSize: 14, fontWeight: activeTab === value ? 700 : 400,
                color: !usable ? 'color-mix(in srgb, var(--thread-ink) 28%, transparent)'
                  : activeTab === value ? 'var(--thread-accent)'
                  : 'var(--thread-muted)',
                borderBottom: activeTab === value ? '2px solid var(--thread-accent)' : '2px solid transparent',
                marginBottom: -1,
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {!isTabUsable(activeTab, !!isReddit, isLoggedIn) ? (
        <div style={{ flex: 1, padding: '12px 16px', fontSize: 13, color: 'var(--ink-3)' }}>
          {!isLoggedIn && LOGIN_ONLY_TABS.includes(activeTab)
            ? 'Sign in to use this.'
            : `Not available on ${threadTitle}.`}
        </div>
      ) : activeTab === 'chats' ? (
        <Boundary name="Chats">
          {isReddit
            ? <RedditChatsTab redditAccess={redditAccess} />
            : <ChatsTab threadName={threadName} socket={socket} isLive={isLive} viewerUUID={userUUID} viewerRoles={userRoles} validationType={threadValidationType} />}
        </Boundary>
      ) : activeTab === 'splits' ? (
        <Boundary name="Splits">
          <SplitsTab splits={splits} threadUUID={threadUUID} isLoggedIn={isLoggedIn} countsPerSplit={thread?.countsPerSplit} splitsPerGet={thread?.splitsPerGet} />
        </Boundary>
      ) : activeTab === 'stats' ? (
        <Boundary name="Stats">
          {isReddit
            ? <RedditStatsTab />
            : <StatsTab
                validationType={threadValidationType}
                threadName={threadName}
                socket={socket}
                userRoles={userRoles}
                viewerUUID={userUUID}
              />}
        </Boundary>
      ) : activeTab === 'rank' ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Boundary name="Rank">
            <RankTab
              threadName={threadName}
              threadUUID={threadUUID}
              threadTitle={threadTitle}
              socket={socket}
              username={userUsername}
              isLoggedIn={isLoggedIn}
            />
          </Boundary>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {activeTab === 'about'  && (
            isReddit ? (
              <RedditAboutTab
                about={redditAbout ?? null}
                reddit={redditUsername}
                isLoggedIn={isLoggedIn}
                lag={redditLag}
                latency={redditLatency}
                status={redditStatus ?? ''}
              />
            ) : (
              <AboutTab
                thread={thread}
                userUUID={userUUID}
                userXP={userXP}
                userRoles={userRoles}
                isLoggedIn={isLoggedIn}
                socket={socket}
                onMacroRuntimeChange={onMacroRuntimeChange}
              />
            )
          )}
          {activeTab === 'replay' && <ReplayLauncher threadName={threadName} />}
          {activeTab === 'prefs'  && <PrefsEditor scope="thread" threadUUID={threadUUID} threadEnabled={threadEnabled} />}
        </div>
      )}
    </div>
  )
}


function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return narrow
}

export default function ThreadView({ threadName: initialThreadName, threadTitle: initialThreadTitle, threadUUID: initialThreadUUID, threadEnabled, initialPosts, ssrNewestTimestamp, contextUUID, isLoggedIn, userUUID, userUsername, userRoles, userXP, prefs, thread: initialThread, miscSettings, initialSplits,
  isReddit: initialIsReddit, reddit, redditAccess, ssrRedditAbout, bingoGameId = null,
}: ThreadViewProps) {
  _currentUserUUID = userUUID ?? ''
  _currentUserRoles = userRoles ?? []
  _rowsInteractive = true
  const renderPrefs = useMemo(() => toRenderPrefs(prefs), [
    prefs.pref_custom_stricken, prefs.pref_strike_color, prefs.pref_stricken_count_opacity,
    prefs.pref_hide_stricken, prefs.pref_standardize_format, prefs.pref_show_latency, prefs.pref_reply_time_interval,
    prefs.pref_post_font_size,
  ])
  const olRef = useRef<HTMLUListElement>(null)
  useHourBarRelabel(olRef)
  const bumpFavicon = useFavicon()
  const countRef = useRef(0)
  const topHourKeyRef = useRef<string>(hourBarKey(initialPosts[0]?.timestamp))
  const seenUuidsRef = useRef<Set<string>>(new Set())
  const handledPostsRef = useRef<Set<string>>(new Set())
  const pendingHashesRef = useRef<Map<string, number>>(new Map())
  const latencyReporterRef = useRef<LatencyReporter | null>(null)
  const postCacheRef = useRef<Map<string, PostRow>>(new Map())

  const scrollerRef = useRef<HTMLDivElement>(null)
  const bottomHourKeyRef = useRef<string>('')
  const bottomTimestampRef = useRef<string | undefined>(undefined)
  const oldestUuidRef = useRef<string | undefined>(undefined)
  const olderLoadedRef = useRef(0)
  const [loadedOldest, setLoadedOldest] = useState(false)
  const [feedPlaced, setFeedPlaced] = useState(false)
  const [status, setStatus] = useState<'connecting' | 'live' | 'disconnected'>('connecting')
  const [watcherCount, setWatcherCount] = useState<number | null>(null)
  const [macroRuntime, setMacroRuntime] = useState<ActiveMacroRuntime | null>(null)
  const [macrosEnabled, setMacrosEnabled] = useState(true)
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null)
  const [isReddit, setIsReddit] = useState(!!initialIsReddit)
  const isNarrow = useIsNarrow()
  const activePostStyle = isNarrow ? prefs.pref_post_style_mobile : prefs.pref_post_style
  useEffect(() => () => threadStats.resetThreadStats(), [])

  const devicePerf = useDevicePerf()
  const flipList = flipListOn(devicePerf) && !prefs.pref_load_from_bottom
  useEffect(() => {
    if (!flipList) return
    document.documentElement.classList.add('cgg-flip')
    return () => document.documentElement.classList.remove('cgg-flip')
  }, [flipList])
  const [splits, setSplits] = useState<RecentSplit[]>(initialSplits ?? [])

  useEffect(() => {
    if (initialSplits?.length) seedPaceSplits(initialSplits)
  }, [initialSplits])
  const [activeTab, setActiveTab] = useState<'posts' | 'sidebar'>('posts')
  const narrow = useSyncExternalStore(
    onChange => {
      const mq = window.matchMedia(NARROW_LAYOUT)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(NARROW_LAYOUT).matches,
    () => false,
  )
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('about')

  const [threadName, setThreadName] = useState(initialThreadName)
  const regional = useRegional(socketInstance, threadName)

  _currentThreadName = threadName
  _rowsAreReddit = isReddit
  const [threadTitle, setThreadTitle] = useState(initialThreadTitle)
  const [threadUUID, setThreadUUID] = useState(initialThreadUUID)
  const threadUUIDRef = useRef(initialThreadUUID)
  threadUUIDRef.current = threadUUID
  const [thread, setThread] = useState(initialThread)
  _rowsValidationType = thread?.validationType
  const [switching, setSwitching] = useState(false)
  const [reactionTarget, setReactionTarget] = useState<{ postUuid: string; x: number; y: number } | null>(null)
  const mountedThreadRef = useRef(initialThreadName)
  const threadNameRef = useRef(initialThreadName)
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])
  const contextUUIDRef = useRef(contextUUID)
  const [inContext, setInContext] = useState(!!contextUUID)

  const { setThreadViewMounted, pendingNav, consumeThreadNav } = useThreadNav()
  useEffect(() => {
    setThreadViewMounted(true)
    return () => setThreadViewMounted(false)
  }, [setThreadViewMounted])

  useEffect(() => {
    document.title = `${threadTitle} | counting.gg`
  }, [threadTitle])

  const { setThreadColors } = useThreadColors()
  useEffect(() => {
    setThreadColors(thread?.color1 && thread?.color2 ? { color1: thread.color1, color2: thread.color2 } : null)
    return () => setThreadColors(null)
  }, [thread?.color1, thread?.color2, setThreadColors])

  const sidebarWash = thread?.color1 && thread?.color2
    ? { backgroundImage: `linear-gradient(180deg, ${thread.color1}14, ${thread.color2}14)` }
    : undefined

  const renderPosts = useCallback((rows: PostRow[]) => {
    const ol = olRef.current
    if (!ol) return
    seenUuidsRef.current.clear()
    postCacheRef.current.clear()
    pendingHashesRef.current.clear()
    countRef.current = 0
    for (const row of rows) {
      seenUuidsRef.current.add(row.uuid)
      postCacheRef.current.set(row.uuid, row)
    }
    ol.innerHTML = buildInitialHTML(rows, renderPrefs)
    setFeedPlaced(false)
    if (prefs.pref_load_from_bottom) {
      requestAnimationFrame(() => {
        const sc = scrollerRef.current
        if (sc) sc.scrollTop = sc.scrollHeight
        setFeedPlaced(true)
      })
    } else {
      setFeedPlaced(true)
    }

    seedPaceCounts(rows)
    countRef.current = rows.length
    topHourKeyRef.current = hourBarKey(rows[0]?.timestamp)
    bottomHourKeyRef.current = hourBarKey(rows[rows.length - 1]?.timestamp)
    bottomTimestampRef.current = rows[rows.length - 1]?.timestamp
    oldestUuidRef.current = rows[rows.length - 1]?.uuid
    olderLoadedRef.current = 0
    setLoadedOldest(false)
    {
      const sc = scrollerRef.current
      if (sc) sc.scrollTop = prefs.pref_load_from_bottom ? sc.scrollHeight : 0
    }
    markLatestCount(ol, !!prefs.pref_highlight_last_count, prefs.pref_highlight_last_count_color)
  }, [prefs.pref_highlight_last_count, prefs.pref_highlight_last_count_color, renderPrefs, prefs.pref_load_from_bottom])

  const switchToThread = useCallback((nextName: string) => {
    if (nextName === mountedThreadRef.current) return
    const toReddit = nextName === LC_THREAD_NAME
    mountedThreadRef.current = nextName
    setRowThreadName(nextName, toReddit)

    if (isReddit !== toReddit) setIsReddit(toReddit)

    if (toReddit) {
      setThreadName(nextName)
      threadNameRef.current = nextName
      setThreadTitle(LC_THREAD_TITLE)
      setThreadUUID(undefined)
      setThread(LIVECOUNTING_THREAD_INFO)
      setWatcherCount(null)
      contextUUIDRef.current = undefined
      setInContext(false)
      renderPosts([])
      setSwitching(false)
      return
    }
    contextUUIDRef.current = undefined
    setInContext(false)
    setWatcherCount(null)

    const cached = getCachedThread(nextName)
    if (cached) {
      setThreadName(nextName)
      threadNameRef.current = nextName
      if (cached.thread?.title) setThreadTitle(cached.thread.title)
      setThreadUUID(cached.threadUUID)
      if (cached.thread) setThread(cached.thread)
      renderPosts(cached.posts)
      const socket = getSocket()
      socket.emit('watch', nextName)
    } else {
      setSwitching(true)
    }

    const API = ''

    Promise.all([
      fetch(`${API}/api/thread/getRecent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_name: nextName, context: null }),
        credentials: 'include',
      }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/api/thread/${encodeURIComponent(nextName)}`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : null),
    ]).then(([recentData, threadData]) => {
      if (!isMountedRef.current) return
      if (!recentData) { setSwitching(false); return }
      if (mountedThreadRef.current !== nextName) return

      setThreadName(nextName)
      threadNameRef.current = nextName
      setSplits([])
      if (threadData?.title) setThreadTitle(threadData.title)
      if (threadData?.uuid) setThreadUUID(threadData.uuid)
      if (threadData) setThread(threadData)

      const rows: PostRow[] = toPostRows(
        (recentData.recentCounts ?? []).slice(0, MAX_VISIBLE),
        recentData.counters ?? [],
        nextName,
      )
      renderPosts(rows)
      if (threadData?.uuid) seedThreadPostCache(nextName, threadData.uuid, rows, threadData)

      const socket = getSocket()
      socket.emit('watch', nextName)

      setSwitching(false)
    }).catch(() => { if (isMountedRef.current) setSwitching(false) })
  }, [renderPosts, isReddit])

  useEffect(() => {
    if (!pendingNav) return
    if (pendingNav !== mountedThreadRef.current) {
      window.history.pushState(null, '', `/thread/${pendingNav}`)
      switchToThread(pendingNav)
    }
    consumeThreadNav()
  }, [pendingNav, consumeThreadNav, switchToThread])

  useEffect(() => {
    const onPopState = () => {
      const match = window.location.pathname.match(/^\/thread\/(.+)$/)
      if (!match) return
      switchToThread(decodeURIComponent(match[1]))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [switchToThread])


  const appendPost = useCallback((post: PostRow) => {
    const ol = olRef.current
    if (!ol) return
    if (seenUuidsRef.current.has(post.uuid)) return
    seenUuidsRef.current.add(post.uuid)
    postCacheRef.current.set(post.uuid, post)
    const tmp = document.createElement('template')
    tmp.innerHTML = buildRowHTML(post, renderPrefs)
    const li = tmp.content.firstElementChild
    if (!li) return
    ol.appendChild(li)
    countRef.current++
  }, [renderPrefs])

  const atNewestEnd = useCallback(() => {
    const sc = scrollerRef.current
    if (!sc) return true
    if (!prefs.pref_load_from_bottom) return Math.abs(sc.scrollTop) < 4
    return sc.scrollHeight - sc.scrollTop - sc.clientHeight < 40
  }, [prefs.pref_load_from_bottom])

  const pinToNewest = useCallback(() => {
    const sc = scrollerRef.current
    if (!sc || !prefs.pref_load_from_bottom) return
    sc.scrollTop = sc.scrollHeight
  }, [prefs.pref_load_from_bottom])

  const insertPost = useCallback((post: PostRow) => {
    const ol = olRef.current
    if (!ol) return
    if (seenUuidsRef.current.has(post.uuid)) return
    seenUuidsRef.current.add(post.uuid)
    postCacheRef.current.set(post.uuid, post)

    const followed = atNewestEnd()

    const k = hourBarKey(post.timestamp)
    if (k && k !== topHourKeyRef.current && topHourKeyRef.current !== '') {
      const barTmp = document.createElement('template')
      barTmp.innerHTML = buildHourBarHTML(post.timestamp)
      ol.insertBefore(barTmp.content.firstElementChild!, ol.firstChild)
      countRef.current++
    }
    if (k) topHourKeyRef.current = k

    markLive(post.uuid)
    const tmp = document.createElement('template')
    tmp.innerHTML = buildRowHTML(post, renderPrefs)
    const li = tmp.content.firstElementChild!
    if (post.isValidCount && !post.stricken) {
      const n = Number(post.validCountNumber)
      const at = Number(post.timestamp)
      if (Number.isFinite(n) && Number.isFinite(at)) {
        stampPaceDelta(li, paceDeltaAt(n, at))
      }
    }
    ol.insertBefore(li, ol.firstChild)
    if (followed) requestAnimationFrame(pinToNewest)
    countRef.current++

    const atLiveHead = followed
    const limit = Math.min(liveRowLimit(MAX_VISIBLE) + olderLoadedRef.current, MAX_HISTORY_ROWS)
    if (atLiveHead || countRef.current > MAX_HISTORY_ROWS) {
      while (countRef.current > limit) {
        const last = ol.lastChild
        if (last) {
          if ((last as HTMLElement).dataset?.uuid) {
            const uuid = (last as HTMLElement).dataset.uuid!
            seenUuidsRef.current.delete(uuid)
            postCacheRef.current.delete(uuid)
          }
          ol.removeChild(last)
          countRef.current--
        } else break
      }
      const last = ol.lastElementChild as HTMLElement | null
      if (last?.dataset?.uuid) oldestUuidRef.current = last.dataset.uuid
    }

    markLatestCount(ol, !!prefs.pref_highlight_last_count, prefs.pref_highlight_last_count_color)
  }, [prefs.pref_highlight_last_count, prefs.pref_highlight_last_count_color, prefs.pref_pace_mode, renderPrefs, atNewestEnd, pinToNewest])

  const loadOlderPosts = useCallback(async () => {
    const ol = olRef.current
    const cursor = oldestUuidRef.current
    const threadName = threadNameRef.current
    if (!ol || !cursor || !threadName) return

    const API = ''
    const params = new URLSearchParams({
      thread_name: threadName,
      uuid: cursor,
      limit: String(HISTORY_PAGE),
    })

    const res = await fetch(`${API}/api/thread/loadOlderCounts?${params}`, {
      credentials: 'include',
    })
    if (res.status === 429) {
      notifyRateLimited(Number(res.headers.get('retry-after')) || undefined)
      return
    }
    if (!res.ok) return
    const data = await res.json()

    if (threadNameRef.current !== threadName) return

    const rows = toPostRows(data.counts ?? [], data.counters ?? [], threadName)
      .filter(r => !seenUuidsRef.current.has(r.uuid))

    if (rows.length > 0) {
      const chunks: string[] = []
      for (const row of rows) {
        seenUuidsRef.current.add(row.uuid)
        postCacheRef.current.set(row.uuid, row)
        const k = hourBarKey(row.timestamp)
        if (k && k !== bottomHourKeyRef.current) {
          if (bottomHourKeyRef.current !== '') chunks.push(buildHourBarHTML(bottomTimestampRef.current))
          bottomHourKeyRef.current = k
        }
        if (row.timestamp) bottomTimestampRef.current = row.timestamp
        chunks.push(buildRowHTML(row, renderPrefs))
      }

      const frag = document.createElement('template')
      frag.innerHTML = chunks.join('')
      const added = frag.content.childElementCount
      ol.appendChild(frag.content)
      countRef.current += added
      olderLoadedRef.current = Math.min(
        olderLoadedRef.current + added,
        MAX_HISTORY_ROWS,
      )
      oldestUuidRef.current = rows[rows.length - 1].uuid
    }

    if (data.loadedOldest || rows.length === 0) setLoadedOldest(true)
  }, [renderPrefs])

  useEffect(() => {
    if (!isReddit) ensurePaceClock()
  }, [isReddit])

  useEffect(() => {
    setPaceTarget(
      prefs.pref_pace_mode === 'Get' ? 'get'
        : prefs.pref_pace_mode === 'Counts' ? 'counts'
        : 'split',
    )
    setPaceCounts(Number(prefs.pref_pace_counts) || 100)
    const savedMs = Number(prefs.pref_pace_target_ms) || 0
    setTargetSplitMs(savedMs > 0 ? savedMs : null)
  }, [prefs.pref_pace_mode, prefs.pref_pace_counts, prefs.pref_pace_target_ms])

  useEffect(() => {
    setSplitConfig(
      thread?.countsPerSplit ?? 100,
      thread?.splitsPerGet ?? 10,
      thread?.splitOffset ?? 0,
    )
  }, [thread?.countsPerSplit, thread?.splitsPerGet, thread?.splitOffset])

  const { loading: loadingOlder } = useEdgeLoader({
    root: scrollerRef,
    edge: prefs.pref_load_from_bottom ? 'top' : 'bottom',
    margin: 800,
    enabled: !isReddit && !switching && feedPlaced,
    exhausted: loadedOldest,
    onLoad: loadOlderPosts,
  })

  const replacePost = useCallback((oldUuid: string, post: PostRow) => {
    const ol = olRef.current
    if (!ol) return
    const li = ol.querySelector(`[data-uuid="${oldUuid}"]`)
    if (!li) return
    if (oldUuid !== post.uuid) {
      seenUuidsRef.current.delete(oldUuid)
      postCacheRef.current.delete(oldUuid)
      seenUuidsRef.current.add(post.uuid)
    }
    postCacheRef.current.set(post.uuid, post)
    if (_liveUuids.has(oldUuid)) markLive(post.uuid)
    const tmp = document.createElement('template')
    tmp.innerHTML = buildRowHTML(post, renderPrefs)
    ol.replaceChild(tmp.content.firstElementChild!, li)
    markLatestCount(ol, !!prefs.pref_highlight_last_count, prefs.pref_highlight_last_count_color)
  }, [prefs.pref_highlight_last_count, prefs.pref_highlight_last_count_color, renderPrefs])

  const removePost = useCallback((uuid: string) => {
    const ol = olRef.current
    if (!ol) return
    const li = ol.querySelector(`[data-uuid="${uuid}"]`)
    if (!li) return
    ol.removeChild(li)
    countRef.current--
    seenUuidsRef.current.delete(uuid)
    postCacheRef.current.delete(uuid)
  }, [])

  const getCachedPost = useCallback((uuid: string) => postCacheRef.current.get(uuid), [])

  const redditHost = useMemo(
    () => ({ insertPost, appendPost, replacePost, removePost, getCachedPost }),
    [insertPost, appendPost, replacePost, removePost, getCachedPost],
  )
  const redditFeed = useRedditFeed({
    enabled: !!isReddit,
    ssrAbout: ssrRedditAbout,
    reddit,
    redditAccess,
    host: redditHost,
  })

  const { loading: loadingOlderReddit } = useEdgeLoader({
    root: scrollerRef,
    edge: 'bottom',
    margin: 600,
    enabled: !!isReddit && !switching,
    exhausted: redditFeed.exhausted,
    onLoad: redditFeed.loadOlder,
  })

  const redditCanPost = !!reddit && !!redditAccess && redditFeed.contributor !== 'no'

  useEffect(() => {
    setSidebarTab(t => (isTabUsable(t, !!isReddit, isLoggedIn) ? t : 'about'))
  }, [isReddit, isLoggedIn])

  useEffect(() => {
    const ol = olRef.current
    if (!ol) { console.error('[thread] post list ref was null on mount'); return }
    for (const post of initialPosts.slice(0, MAX_VISIBLE)) {
      seenUuidsRef.current.add(post.uuid)
      postCacheRef.current.set(post.uuid, post)
    }
    const seedPosts = initialPosts.slice(0, MAX_VISIBLE)
    ol.innerHTML = buildInitialHTML(seedPosts, renderPrefs)
    if (prefs.pref_load_from_bottom) {
      requestAnimationFrame(() => {
        const sc = scrollerRef.current
        if (sc) sc.scrollTop = sc.scrollHeight
        setFeedPlaced(true)
      })
    } else {
      setFeedPlaced(true)
    }

    seedPaceCounts(seedPosts)
    countRef.current = Math.min(initialPosts.length, MAX_VISIBLE)
    topHourKeyRef.current = hourBarKey(seedPosts[0]?.timestamp)
    bottomHourKeyRef.current = hourBarKey(seedPosts[seedPosts.length - 1]?.timestamp)
    bottomTimestampRef.current = seedPosts[seedPosts.length - 1]?.timestamp
    oldestUuidRef.current = seedPosts[seedPosts.length - 1]?.uuid
    markLatestCount(ol, !!prefs.pref_highlight_last_count, prefs.pref_highlight_last_count_color)
    if (initialThreadUUID) seedThreadPostCache(initialThreadName, initialThreadUUID, seedPosts, initialThread)

    const handleClick = (e: MouseEvent) => {
      const deleteBtn = (e.target as Element).closest('[data-action="delete-comment"]') as HTMLElement | null
      if (deleteBtn) {
        const uuid = deleteBtn.dataset.uuid
        if (!uuid) return
        if (!e.shiftKey && !confirm('Delete this comment? The count itself will remain. This can\'t be undone.')) return
        getSocket().emit('deleteComment', { uuid })
        return
      }
      const minimizedToggle = (e.target as Element).closest('[data-action="toggle-minimized"]') as HTMLElement | null
      if (minimizedToggle) {
        const uuid = minimizedToggle.dataset.uuid
        if (!uuid) return
        const cached = postCacheRef.current.get(uuid)
        const li = ol.querySelector(`[data-uuid="${uuid}"]`)
        if (!cached || !li) return
        const tmp = document.createElement('template')
        tmp.innerHTML = buildRowHTML(cached, renderPrefs, true)
        const newNode = tmp.content.firstElementChild!
        ol.replaceChild(newNode, li)
        return
      }

      const reactionChip = (e.target as Element).closest('[data-action="toggle-reaction"]') as HTMLElement | null
      if (reactionChip) {
        const uuid = reactionChip.dataset.uuid
        const id = reactionChip.dataset.reaction
        if (!uuid || !id) return
        getSocket().emit('updateReactions', { post_uuid: uuid, id })
        return
      }

      const addReaction = (e.target as Element).closest('[data-action="add-reaction"]') as HTMLElement | null
      if (addReaction) {
        const uuid = addReaction.dataset.uuid
        if (!uuid) return
        const rect = addReaction.getBoundingClientRect()
        ol.querySelectorAll('.post-row.reaction-picker-open')
          .forEach(el => el.classList.remove('reaction-picker-open'))
        addReaction.closest('.post-row')?.classList.add('reaction-picker-open')
        setReactionTarget({ postUuid: uuid, x: rect.left, y: rect.bottom })
      }
    }
    ol.addEventListener('click', handleClick)
    return () => ol.removeEventListener('click', handleClick)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isTugOfWarStalled = useCallback(() => {
    if (thread?.validationType !== 'tugofwar') return false
    const recent = [...postCacheRef.current.values()]
      .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
      .slice(0, 50)
      .filter(p => p.isValidCount)
    if (recent.length === 0) return false
    const distinct = new Set(recent.map(p => p.rawCount ?? p.countContent ?? p.rawText))
    return distinct.size <= 15
  }, [thread?.validationType])

  useEffect(() => {
    if (!isLoggedIn || !threadUUID || isReddit) { setMacroRuntime(null); return }
    let cancelled = false
    const API = ''
    fetch(`${API}/api/threads/${threadUUID}/macro-presets/active`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (!cancelled) setMacroRuntime(data ?? null) })
      .catch(() => { if (!cancelled) setMacroRuntime(null) })
    return () => { cancelled = true }
  }, [threadUUID, isLoggedIn, isReddit])

  useEffect(() => {
    if (!contextUUID) return
    const ol = olRef.current
    if (!ol) return
    const row = ol.querySelector(`[data-uuid="${contextUUID}"]`) as HTMLElement | null
    if (!row) return
    row.classList.add('post-row-focus', 'post-row-focus-flash')
    row.scrollIntoView({ block: 'center' })
    const t = setTimeout(() => row.classList.remove('post-row-focus-flash'), 1800)
    return () => clearTimeout(t)
  }, [contextUUID])

  useEffect(() => {
    const ol = olRef.current
    if (!ol) return
    markLatestCount(ol, !!prefs.pref_highlight_last_count, prefs.pref_highlight_last_count_color)
  }, [prefs.pref_highlight_last_count, prefs.pref_highlight_last_count_color])

  useEffect(() => {
    if (isReddit) { setStatus('live'); return }
    const socket = getSocket()
    attachSocket(socket)

    const reporter = new LatencyReporter(socket, threadNameRef.current)
    reporter.start()
    latencyReporterRef.current = reporter

    const onConnect = async () => {
      setStatus('live')
      socket.emit('watch', threadNameRef.current)

      if (ssrNewestTimestamp) {
        try {
          const res = await fetch('/api/thread/getRecent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ thread_name: threadNameRef.current, context: null }),
            credentials: 'include',
          })
          if (res.ok) {
            const data = await res.json()
            const posts: any[] = data.recentCounts ?? []
            const counters: any[] = data.counters ?? []
            const counterMap = buildCounterMap<any>(counters)
            const newPosts = posts.filter(p => p.timestamp > ssrNewestTimestamp)
            newPosts.reverse()
            for (const p of newPosts) {
              const author = counterMap.get(p.authorUUID)
              insertPost({
                uuid: p.uuid,
                rawText: p.rawText,
                countContent: p.countContent,
                rawCount: p.rawCount,
                roll: p.roll ?? undefined,
                chance: p.chance ?? undefined,
                comment: p.comment,
                isValidCount: p.isValidCount,
                stricken: p.stricken,
                timestamp: p.timestamp,
                timeSinceLastPost: p.timeSinceLastPost,
                validCountNumber: p.validCountNumber,
                timeSinceLastCount: p.timeSinceLastCount,
                authorUUID: p.authorUUID,
                authorUsername: author?.username ?? 'unknown',
                authorName: author?.name ?? author?.username ?? 'unknown',
                authorColor: author?.color ?? '#888888',
                authorEmoji: author?.emoji,
                authorAvatarUrl: author ? avatarUrl(author.discordId, author.avatar) : undefined,
                reactions: p.reactions ?? undefined,
              })
            }
          }
        } catch {
          console.warn('[thread] gap fetch failed after reconnect')
        }
      }
    }

    const onDisconnect = () => {
      setStatus('disconnected')
    }

    const handlePost = (data: { post: any; counter: any }) => {
      const postThread = data.post?.thread
      if (postThread && threadUUIDRef.current && postThread !== threadUUIDRef.current) return

      const postUuid: string | undefined = data.post?.uuid
      if (postUuid) {
        const handled = handledPostsRef.current
        if (handled.has(postUuid)) return
        if (handled.size >= 2000) handled.clear()
        handled.add(postUuid)
      }

      bumpFavicon()

      if (data.post?.isValidCount && data.counter) {
        const lc = data.counter
        threadStats.setLastCount({
          lastCount: {
            rawText: data.post.rawText,
            countContent: data.post.countContent,
            rawCount: data.post.rawCount,
            timestamp: data.post.timestamp,
            authorUUID: data.post.authorUUID,
          },
          lastCounter: { uuid: lc.uuid, username: lc.username, name: lc.name, color: lc.color },
        })
        threadStats.setDailyHOC(prev => {
          const i = prev.findIndex(e => e.counter?.uuid === lc.uuid)
          if (i === -1) return [...prev, { counter: lc as CounterInfo, counts: 1 }]
          const next = prev.slice()
          next[i] = { ...next[i], counts: next[i].counts + 1 }
          return next
        })
      }

      if (contextUUIDRef.current) return
      const { post: p, counter: c } = data
      let latency: number | undefined
      const hash = p.post_hash
      if (hash && pendingHashesRef.current.has(hash)) {
        const sent = pendingHashesRef.current.get(hash)!
        const receivedAt = Date.now()
        latency = receivedAt - sent
        pendingHashesRef.current.delete(hash)

        latencyReporterRef.current?.record({
          roundTripMs: latency,
          processingMs: typeof p.processingLatency === 'number' ? p.processingLatency : 0,
          schedulingMs: typeof p.schedulingMs === 'number' ? p.schedulingMs : 0,
          dbReadMs: typeof p.dbReadMs === 'number' ? p.dbReadMs : 0,
          dbWriteMs: typeof p.dbWriteMs === 'number' ? p.dbWriteMs : 0,
          otherMs: typeof p.otherMs === 'number' ? p.otherMs : 0,
        }, {
          sentAt: sent,
          receivedAt,
          serverAt: typeof p.serverAt === 'number' ? p.serverAt : undefined,
        })
        noteOwnPost(latency, typeof p.processingLatency === 'number' ? p.processingLatency : 0)
      }
      if (
        p.stricken &&
        prefs.pref_sound_on_stricken !== 'Disabled' &&
        !shouldSuppressStrickenSound(threadNameRef.current, p.roll)
      ) {
        const isMine = p.authorUUID === _currentUserUUID
        if (prefs.pref_sound_on_stricken === 'All Stricken' || (prefs.pref_sound_on_stricken === 'Only My Counts' && isMine)) {
          playStrickenSound()
        }
      }
      insertPost({
        uuid: p.uuid,
        rawText: p.rawText,
        countContent: p.countContent,
        rawCount: p.rawCount,
        roll: p.roll ?? undefined,
        chance: p.chance ?? undefined,
        comment: p.comment,
        isValidCount: p.isValidCount,
        stricken: p.stricken,
        timestamp: p.timestamp,
        timeSinceLastPost: p.timeSinceLastPost,
        validCountNumber: p.validCountNumber,
        timeSinceLastCount: p.timeSinceLastCount,
        authorUUID: p.authorUUID,
        authorUsername: c?.username ?? 'unknown',
        authorName: c?.name ?? c?.username ?? 'unknown',
        authorColor: c?.color ?? '#888888',
        authorEmoji: c?.emoji,
        authorAvatarUrl: c ? avatarUrl(c.discordId, c.avatar) : undefined,
        reactions: p.reactions ?? undefined,
        latency,
      })
    }

    const onDeleteComment = (serverPost: any) => {
      const ol = olRef.current
      if (!ol) return
      const li = ol.querySelector(`[data-uuid="${serverPost.uuid}"]`)
      if (!li) return
      const cached = postCacheRef.current.get(serverPost.uuid)
      const post: PostRow = {
        uuid: serverPost.uuid,
        rawText: serverPost.rawText ?? cached?.rawText ?? '',
        countContent: serverPost.countContent ?? cached?.countContent,
        rawCount: serverPost.rawCount ?? cached?.rawCount,
        roll: serverPost.roll ?? cached?.roll,
        chance: serverPost.chance ?? cached?.chance,
        comment: undefined,
        isValidCount: serverPost.isValidCount ?? cached?.isValidCount ?? true,
        stricken: serverPost.stricken ?? cached?.stricken ?? false,
        timestamp: serverPost.timestamp ?? cached?.timestamp ?? '',
        timeSinceLastPost: cached?.timeSinceLastPost,
        validCountNumber: serverPost.validCountNumber ?? cached?.validCountNumber,
        timeSinceLastCount: serverPost.timeSinceLastCount ?? cached?.timeSinceLastCount,
        authorUUID: cached?.authorUUID ?? '',
        authorUsername: cached?.authorUsername ?? 'unknown',
        authorName: cached?.authorName ?? 'unknown',
        authorColor: cached?.authorColor ?? '#888888',
        authorEmoji: cached?.authorEmoji,
        authorAvatarUrl: cached?.authorAvatarUrl,
      }
      postCacheRef.current.set(post.uuid, post)
      const tmp = document.createElement('template')
      tmp.innerHTML = buildCommentDeletedRowHTML(post, renderPrefs)
      const newNode = tmp.content.firstElementChild!
      ol.replaceChild(newNode, li)
      markLatestCount(ol, !!prefs.pref_highlight_last_count, prefs.pref_highlight_last_count_color)
    }

    const onUpdateReaction = (data: { post_uuid: string; reactions: Record<string, string[]> }) => {
      const ol = olRef.current
      if (!ol || !data?.post_uuid) return
      const cached = postCacheRef.current.get(data.post_uuid)
      if (!cached) return
      const updated: PostRow = { ...cached, reactions: data.reactions ?? {} }
      postCacheRef.current.set(updated.uuid, updated)

      const li = ol.querySelector(`[data-uuid="${data.post_uuid}"]`)
      if (!li) return
      const wasPickerOpen = li.classList.contains('reaction-picker-open')
      const tmp = document.createElement('template')
      tmp.innerHTML = updated.comment === undefined && cached.comment !== undefined
        ? buildCommentDeletedRowHTML(updated, renderPrefs)
        : buildRowHTML(updated, renderPrefs)
      const newNode = tmp.content.firstElementChild! as HTMLElement
      if (wasPickerOpen) newNode.classList.add('reaction-picker-open')
      ol.replaceChild(newNode, li)
      markLatestCount(ol, !!prefs.pref_highlight_last_count, prefs.pref_highlight_last_count_color)
    }

    const onWatcherCount = (n: number) => {
      if (typeof n === 'number') setWatcherCount(n)
    }

    const onLastCount = (data: LastCountInfo) => { if (data) threadStats.setLastCount(data) }
    const onDailyHOC = (data: Record<string, unknown>) => {
      if (!data || typeof data !== 'object') return
      const values = Object.values(data)
      const isThisThread = values.length === 0 ||
        (typeof values[0] === 'object' && values[0] !== null && 'counts' in values[0])

      if (isThisThread) {
        threadStats.setDailyHOC(values as DailyHOCEntry[])
        return
      }
      const uuid = threadUUIDRef.current
      if (!uuid || !(uuid in data)) return
      const board = data[uuid] as Record<string, DailyHOCEntry> | undefined
      threadStats.setDailyHOC(board ? Object.values(board) : [])
    }

    const onThreadUpdate = (data: { threadInfo?: ThreadInfo }) => {
      const next = data?.threadInfo
      if (!next?.uuid) return
      if (threadUUIDRef.current && next.uuid !== threadUUIDRef.current) return
      setThread(prev => (prev ? { ...prev, ...next } : next))
      if (next.title) setThreadTitle(next.title)
    }

    const onPostBans = (data: { counters?: { uuid: string }[] }) => {
      const uuids = (data?.counters ?? []).map(c => c.uuid).filter(Boolean)
      setThread(prev => (prev ? { ...prev, postBans: uuids } : prev))
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    const onSplit = (data: RecentSplit) => {
      if (data?.number == null || data?.split == null) return
      setSplits(prev => [
        { number: data.number, split: data.split, replay: data.replay },
        ...prev,
      ].slice(0, 55))
    }

    const onRecentSplits = (rows: RecentSplit[]) => {
      if (!Array.isArray(rows) || !rows.length) return
      setSplits(prev => {
        const seen = new Set(prev.map(s => `${s.number}|${s.split}`))
        return [...prev, ...rows.filter(s => !seen.has(`${s.number}|${s.split}`))].slice(0, 55)
      })
    }

    socket.on('watcher_count', onWatcherCount)
    const onPost = (data: { post: any; counter: any }) => handlePost(data)
    socket.on('post', onPost)
    socket.on('deleteComment', onDeleteComment)
    socket.on('updateReaction', onUpdateReaction)
    socket.on('lastCount', onLastCount)
    socket.on('dailyHOC', onDailyHOC)
    socket.on('split', onSplit)
    socket.on('recent_splits', onRecentSplits)
    socket.on('thread_update', onThreadUpdate)
    socket.on('postBans', onPostBans)

    if (!socket.connected) {
      socket.connect()
    } else {
      onConnect()
    }

    setSocketInstance(socket)

    return () => {
      reporter.stop()
      latencyReporterRef.current = null
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('watcher_count', onWatcherCount)
      socket.off('post', onPost)
      socket.off('deleteComment', onDeleteComment)
      socket.off('updateReaction', onUpdateReaction)
      socket.off('thread_update', onThreadUpdate)
      socket.off('postBans', onPostBans)
      socket.off('lastCount', onLastCount)
      socket.off('dailyHOC', onDailyHOC)
      socket.off('split', onSplit)
      socket.off('recent_splits', onRecentSplits)
    }
  }, [threadName, isReddit]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { getSocket().emit('leave_threads') }, [])


  const statusColor = status === 'live' ? 'var(--success)' : status === 'disconnected' ? 'var(--danger)' : '#3b82f6'
  const h = `calc(100vh - ${NAVBAR_HEIGHT})`

  return (
    <PrefsContext.Provider value={prefs}>
    <>
      <style>{`
        .thread-layout {
          display: flex;
          height: ${h};
          overflow: hidden;
        }
        .thread-left {
          flex: 2;
          min-width: 0;
          height: 100%;
          overflow-y: auto;
          border-right: 1px solid var(--thread-line);
          padding: 12px 16px;
        }
        .thread-middle {
          flex: 6;
          min-width: 0;
          height: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .thread-right {
          flex: 4;
          min-width: 0;
          height: 100%;
          overflow-y: auto;
          border-left: 1px solid var(--thread-line);
          display: flex;
          flex-direction: column;
        }
        .pp-right .thread-middle { order: 3; }
        .pp-right .thread-right  { order: 2; }
        .pp-right .thread-right {
          border-left: none;
          border-right: 1px solid var(--thread-line);
        }

        .thread-tabs { display: none; }
        .bingo-strip-ssr { display: none; }
        .thread-sidebar-tab { display: none; }
        @media (max-width: 1199px) {
          .thread-left { display: none; }
          .thread-right { display: none; }
          .bingo-strip-ssr { display: block; flex-shrink: 0; }
          .thread-middle {
            flex: unset;
            width: 100%;
            height: calc(${h} - var(--thread-tabs-h, 41px));
          }
          .thread-tabs {
            display: flex;
            height: var(--thread-tabs-h, 41px);
            flex-shrink: 0;
            border-bottom: 1px solid var(--thread-line);
          }
          .thread-layout { flex-direction: column; }
          .thread-sidebar-tab {
            display: none;
            flex: 1;
            overflow-y: auto;
            padding: 12px 16px;
          }
          .thread-sidebar-tab.active { display: block; }
          .thread-middle.tab-hidden { display: none; }
        }
      `}</style>

      <div className={`thread-layout${prefs.pref_post_position === 'Right' ? ' pp-right' : ''}`}>
        <div className="thread-tabs">
          <button
            onClick={() => setActiveTab('posts')}
            style={{
              flex: 1, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === 'posts' ? 'var(--thread-accent)' : 'var(--thread-ink)',
              fontWeight: activeTab === 'posts' ? 700 : 500, fontSize: 14,
              borderBottom: activeTab === 'posts' ? '2px solid var(--thread-accent)' : '2px solid transparent',
            }}
          >
            {threadTitle}
          </button>
          <button
            onClick={() => setActiveTab('sidebar')}
            style={{
              flex: 1, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === 'sidebar' ? 'var(--thread-accent)' : 'var(--thread-ink)',
              fontWeight: activeTab === 'sidebar' ? 700 : 500, fontSize: 14,
              borderBottom: activeTab === 'sidebar' ? '2px solid var(--thread-accent)' : '2px solid transparent',
            }}
          >
            Sidebar
          </button>
        </div>

        <div className="thread-left" data-thread-picker style={{ ...sidebarWash, ...(prefs.pref_hide_thread_picker ? { display: 'none' } : null) }}>
          <InlineThreadPicker currentThreadName={threadName} initialMiscSettings={miscSettings} username={userUsername} />
        </div>

        <div
          className={`thread-middle${activeTab === 'sidebar' ? ' tab-hidden' : ''}`}
          style={prefs.pref_load_from_bottom ? { flexDirection: 'column-reverse' } : undefined}
        >
          {!isReddit && <BingoTeamEmoji />}
          {narrow && !isReddit && (
            <BingoStrip
              isLoggedIn={isLoggedIn}
              meUuid={userUUID ?? null}
              threadUuid={threadUUID ?? null}
              expectGame={bingoGameId != null}
              style={{ order: prefs.pref_load_from_bottom ? 99 : -1 }}
            />
          )}
          {!narrow && !isReddit && bingoGameId != null && (
            <div className="bingo-strip-ssr" style={{ order: prefs.pref_load_from_bottom ? 99 : -1 }}>
              <BingoStripSkeleton />
            </div>
          )}
          <SubmitBox
            threadName={threadName}
            padHidden={narrow && activeTab === 'sidebar'}
            socket={socketInstance}
            isLive={isReddit ? redditFeed.status === 'live' && redditCanPost : status === 'live'}
            isLoggedIn={isLoggedIn}
            pendingHashesRef={pendingHashesRef}
            inline
            userUUID={userUUID}
            userRoles={userRoles}
            threadLocked={thread?.locked}
            threadPostBans={thread?.postBans}
            threadUpdatableBy={thread?.updatableBy}
            threadValidationType={thread?.validationType}
            isTugOfWarStalled={isTugOfWarStalled}
            macroRuntime={macroRuntime}
            macrosEnabled={macrosEnabled}
            onMacrosEnabledChange={setMacrosEnabled}
            {...(isReddit ? {
              onSubmit: redditFeed.submit,
              fixedIntervalMs: REDDIT_RATE_LIMIT_MS,
              forceClearMode: 'Custom',
              placeholder: redditCanPost ? undefined
                : !isLoggedIn ? 'Sign in to post'
                : !reddit ? 'Link Reddit to post'
                : 'Read-only: not a contributor',
            } : {})}
          />
          {isReddit && (redditFeed.error || !redditCanPost) && (
            <div style={{
              margin: '0 4px 4px', padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem', lineHeight: 1.5,
              ...(redditFeed.error
                ? { background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.28)', color: '#fca5a5' }
                : { background: 'var(--thread-line)', border: '1px solid var(--thread-line)', color: 'var(--thread-muted)' }),
            }}>
              {redditFeed.error ?? (
                !isLoggedIn
                  ? <>You&apos;re reading /r/livecounting live.{' '}
                      <a href={LOGIN_URL} style={{ color: 'var(--primary)', fontWeight: 700 }}>Sign in</a>
                      {' '}and link Reddit to post.</>
                  : !reddit
                    ? <>Link your Reddit account in <a href="/prefs" style={{ color: 'var(--primary)', fontWeight: 700 }}>preferences</a> to post here.</>
                    : <>/u/{reddit} isn&apos;t a contributor on this live thread.{' '}
                        <a href="http://counting.gg/joinlive/threads/livecounting/join"
                           target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 700 }}>Request access</a>.</>
              )}
            </div>
          )}
          {inContext && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              margin: '0 4px 4px', padding: '8px 12px', borderRadius: 8,
              background: 'color-mix(in srgb, var(--primary) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)',
              fontSize: '0.8rem', lineHeight: 1.5,
            }}>
              <span>You&rsquo;re viewing the context of an older post: live counts are paused.</span>
              <a
                href={`/thread/${encodeURIComponent(threadName)}`}
                style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                Jump to live
              </a>
            </div>
          )}
          <div
            ref={scrollerRef}
            style={{
              flex: 1, overflowY: 'auto', minHeight: 0, position: 'relative',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <ul
              ref={olRef}
              className={[
                'cgg-post-list',
                prefs.pref_timestamp_display === 'Hidden' ? 'ts-hidden'
                  : prefs.pref_timestamp_display === 'Seconds' ? ''
                  : 'ts-ms',
                activePostStyle === 'LC' ? 'ps-lc'
                  : activePostStyle === 'Minimal' ? 'ps-min'
                  : '',
              ].filter(Boolean).join(' ')}
              style={{
                listStyle: 'none', padding: '0 4px', margin: 0,
                display: 'flex',
                flexShrink: 0,
                flexDirection: prefs.pref_load_from_bottom ? 'column-reverse' : 'column',
                gap: 2,
                willChange: 'contents', contain: 'layout style',
              }}
            />
            {(isReddit
              ? loadingOlderReddit || redditFeed.exhausted
              : loadingOlder || loadedOldest) && (isReddit ? (
              <div style={{
                padding: '10px 12px 16px', textAlign: 'center',
                fontSize: 11, color: 'var(--muted-foreground, #666)',
                flexShrink: 0,
                order: prefs.pref_load_from_bottom ? -1 : 0,
              }}>
                {loadingOlderReddit
                  ? 'Loading older updates...'
                  : redditFeed.exhausted
                    ? 'No more updates available from Reddit.'
                    : null}
              </div>
            ) : (
              <div style={{
                padding: '10px 12px 16px', textAlign: 'center',
                fontSize: 11, color: 'var(--muted-foreground, #666)',
                flexShrink: 0,
                order: prefs.pref_load_from_bottom ? -1 : 0,
              }}>
                {loadingOlder
                  ? 'Loading older counts…'
                  : loadedOldest
                    ? 'You’ve reached the beginning of this thread.'
                    : null}
              </div>
            ))}
            {switching && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgb(var(--surface-0-rgb) / 0.75)',
                backdropFilter: 'blur(2px)',
                display: 'flex', flexDirection: 'column', gap: 2, padding: '4px',
                zIndex: 10,
              }}>
                <style>{`@keyframes skshimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`}</style>
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
                    opacity: 1 - i * 0.045,
                  }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(90deg,var(--thread-line) 25%,color-mix(in srgb, var(--thread-ink) 9%, transparent) 50%,var(--thread-line) 75%)', backgroundSize: '400px 100%', animation: 'skshimmer 1.3s infinite linear' }} />
                    <div style={{ height: 12, borderRadius: 3, width: `${50 + (i * 41) % 140}px`, background: 'linear-gradient(90deg,var(--thread-line) 25%,color-mix(in srgb, var(--thread-ink) 9%, transparent) 50%,var(--thread-line) 75%)', backgroundSize: '400px 100%', animation: 'skshimmer 1.3s infinite linear' }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="thread-right" style={sidebarWash}>
          {!narrow && <SidebarPanel
            threadValidationType={thread?.validationType}
            threadTitle={threadTitle}
            threadName={threadName}
            status={status}
            statusColor={statusColor}
            watcherCount={watcherCount}
            regional={regional}
            onMacroRuntimeChange={setMacroRuntime}
            activeTab={sidebarTab}
            onTabChange={setSidebarTab}
            isReddit={isReddit}
            redditAbout={redditFeed.about}
            redditLag={redditFeed.lag}
            redditLatency={redditFeed.latency}
            redditStatus={redditFeed.status}
            redditUsername={reddit}
            redditAccess={redditAccess}
            threadUUID={threadUUID}
            threadEnabled={threadEnabled}
            socket={socketInstance}
            isLive={status === 'live'}
            thread={thread}
            userUUID={userUUID}
            userUsername={userUsername}
            userXP={userXP}
            userRoles={userRoles}
            isLoggedIn={isLoggedIn}
            splits={splits}
          />}
        </div>

        <div className={`thread-sidebar-tab${activeTab === 'sidebar' ? ' active' : ''}`}>
          {narrow && <SidebarPanel
            threadValidationType={thread?.validationType}
            threadTitle={threadTitle}
            threadName={threadName}
            status={status}
            statusColor={statusColor}
            watcherCount={watcherCount}
            regional={regional}
            onMacroRuntimeChange={setMacroRuntime}
            activeTab={sidebarTab}
            onTabChange={setSidebarTab}
            isReddit={isReddit}
            redditAbout={redditFeed.about}
            redditLag={redditFeed.lag}
            redditLatency={redditFeed.latency}
            redditStatus={redditFeed.status}
            redditUsername={reddit}
            redditAccess={redditAccess}
            threadUUID={threadUUID}
            threadEnabled={threadEnabled}
            socket={socketInstance}
            isLive={status === 'live'}
            thread={thread}
            userUUID={userUUID}
            userUsername={userUsername}
            userXP={userXP}
            userRoles={userRoles}
            isLoggedIn={isLoggedIn}
            splits={splits}
          />}
        </div>
      </div>

      {reactionTarget && (
        <ReactionPickerOverlay
          x={reactionTarget.x}
          y={reactionTarget.y}
          onClose={() => {
            olRef.current?.querySelectorAll('.post-row.reaction-picker-open')
              .forEach(el => el.classList.remove('reaction-picker-open'))
            setReactionTarget(null)
          }}
          onSelect={(id) => {
            getSocket().emit('updateReactions', { post_uuid: reactionTarget.postUuid, id })
            olRef.current?.querySelectorAll('.post-row.reaction-picker-open')
              .forEach(el => el.classList.remove('reaction-picker-open'))
            setReactionTarget(null)
          }}
        />
      )}
    </>
    </PrefsContext.Provider>
  )
}

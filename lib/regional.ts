import type { Socket } from 'socket.io-client'

export const REGIONS = [
  { id: 'enam', label: 'US East', code: 'US-E' },
  { id: 'wnam', label: 'US West', code: 'US-W' },
  { id: 'weur', label: 'Europe West', code: 'EU-W' },
  { id: 'eeur', label: 'Europe East', code: 'EU-E' },
  { id: 'apac', label: 'Asia', code: 'ASIA' },
  { id: 'apac-ne', label: 'Asia NE', code: 'AS-NE' },
  { id: 'apac-se', label: 'Asia SE', code: 'AS-SE' },
  { id: 'oc', label: 'Oceania', code: 'OCE' },
] as const

export type RegionId = (typeof REGIONS)[number]['id']

export interface ThreadOwner {
  thread_name: string
  movable: boolean
  region: RegionId | null
  epoch: number
  moving: boolean
  worker: string | null
  cooldownUntil: number
  regionsOpen?: boolean
  burstPerSec?: number
  target?: RegionId | null
  auto?: boolean
  pausedUntil?: number | null
  pending?: { target: RegionId | 'vps'; inMs: number } | null
  pendingAt?: number
}

export interface PostPayload {
  thread_name: string
  text: string
  post_hash: string
  macroMetadata?: unknown
}

export interface RegionalSample {
  kind: 'ack' | 'ping' | 'probe'
  region: string
  ms: number
  thread?: string
}

interface Outgoing {
  socket: Socket
  payload: PostPayload
  order: number
  via: RegionId | null
  sentAt?: number
  retry?: boolean
  decided?: boolean
}

interface MacroIds {
  macroPresetId?: unknown
  macroPresetVersionId?: unknown
}

const PROBE_CACHE_KEY = 'cgg_region_pings'
const OWNER_CACHE_PREFIX = 'cgg_thread_owner:'
const VPS_PING_KEY = 'cgg_vps_ping'
const PROBE_EVERY_MS = 5 * 60_000
const PINGS_PER_REGION = 5
const KEEPALIVE_MS = 3_000
const RECONNECT_MS = 1_500
const DEFAULT_BURST_PER_SEC = 25
const BURST_HEADROOM = 5
const PACE_MS = 1_100
const PING_REPORT_MS = 30_000
const ACK_TIMEOUT_MS = 4_000
const FAILED_CONNECTS_BEFORE_REPORT = 2
const REPORT_EVERY_MS = 5_000
const RESEND_GRACE_MS = 1_500
const FLUSH_AT_ONCE = 5
const FLUSH_GAP_MS = 60
const RESEND_UNKNOWN_MS = 10_000
const REMEMBERED_POSTS = 2_000
const SHARE_EVERY_MS = 5 * 60_000
const RETIRE_WITHIN_MS = 3_000
const RETIRE_CHECK_MS = 100

interface RegionPost {
  post?: { uuid?: unknown; post_hash?: unknown }
  counter?: unknown
  thread_streak?: unknown
}

interface Internal {
  emitEvent(args: unknown[]): void
}

let deliverySocket: Socket | null = null
const patchedSockets = new WeakSet<Socket>()
const shownFromRegion = new Map<string, string>()
const shownFromVps = new Set<string>()
const awaitingDurable = new Set<string>()

function bounded<T>(collection: Set<T> | Map<T, unknown>): void {
  if (collection.size <= REMEMBERED_POSTS) return
  const oldest = collection.keys().next().value
  if (oldest !== undefined) collection.delete(oldest)
}

function settleFromVps(data: unknown): boolean {
  const uuid = (data as RegionPost | null)?.post?.uuid
  if (typeof uuid !== 'string') return false
  const hash = shownFromRegion.get(uuid)
  if (hash === undefined) {
    shownFromVps.add(uuid)
    bounded(shownFromVps)
    return false
  }
  shownFromRegion.delete(uuid)
  if (hash) {
    awaitingDurable.delete(hash)
    noteSequenced(pending.get(hash))
    pending.delete(hash)
  }
  return true
}

export function attachSocket(socket: Socket): void {
  deliverySocket = socket
  if (patchedSockets.has(socket)) return
  patchedSockets.add(socket)
  socket.on('thread_owner', (o: ThreadOwner) => {
    if (typeof o?.thread_name === 'string') setOwner(o)
  })
  const internal = socket as unknown as Internal
  const original = internal.emitEvent.bind(socket)
  internal.emitEvent = (args: unknown[]) => {
    if (args[0] === 'post' && settleFromVps(args[1])) return
    original(args)
  }
}

function deliver(event: string, data: unknown): void {
  for (const listener of deliverySocket?.listeners(event) ?? []) listener(data)
}

function showFromRegion(m: RegionPost): void {
  const uuid = m.post?.uuid
  const hash = typeof m.post?.post_hash === 'string' ? m.post.post_hash : ''
  if (typeof uuid !== 'string' || shownFromVps.has(uuid) || shownFromRegion.has(uuid)) return
  shownFromRegion.set(uuid, hash)
  bounded(shownFromRegion)
  if (hash && pending.has(hash)) awaitingDurable.add(hash)
  if (hash) markDecided(hash)
  deliver('post', { post: m.post, counter: m.counter, thread_streak: m.thread_streak })
}

export function postQueued(hash: string | null | undefined): void {
  if (hash) markDecided(hash)
}

function noteSequenced(outgoing: Outgoing | undefined): void {
  if (!outgoing) return
  const thread = outgoing.payload.thread_name
  if (outgoing.order > (sequenced.get(thread) ?? -1)) sequenced.set(thread, outgoing.order)
}

function markDecided(hash: string): void {
  const outgoing = pending.get(hash)
  if (!outgoing) return
  outgoing.decided = true
  noteSequenced(outgoing)
  releaseIfClear(outgoing.payload.thread_name)
}

function unanswered(thread: string): boolean {
  for (const o of pending.values()) {
    if (o.payload.thread_name === thread && !o.decided) return true
  }
  return false
}

function releaseIfClear(thread: string): void {
  if (!holding.has(thread) || draining.has(thread) || owners.get(thread)?.moving || switchingRoute(thread)) return
  resending.delete(thread)
  drain(thread)
}

let tokenSource: () => Promise<{ token: string; exp: number }> = async () => {
  const res = await fetch('/api/do/token', { credentials: 'include' })
  if (!res.ok) throw new Error(`token ${res.status}`)
  return res.json()
}
let reporter: ((sample: RegionalSample) => void) | null = null
let onUnreachable: ((thread: string, region: RegionId) => void) | null = null

export function configureRegional(options: {
  tokenSource?: () => Promise<{ token: string; exp: number }>
  reporter?: ((sample: RegionalSample) => void) | null
  onUnreachable?: ((thread: string, region: RegionId) => void) | null
}): void {
  if (options.tokenSource) {
    tokenSource = options.tokenSource
    token = null
  }
  if (options.reporter !== undefined) reporter = options.reporter
  if (options.onUnreachable !== undefined) onUnreachable = options.onUnreachable
}

function report(sample: RegionalSample): void {
  if (Number.isFinite(sample.ms) && sample.ms >= 0) reporter?.(sample)
}

export function regionCode(region: string | null): string {
  if (!region) return 'VPS'
  return REGIONS.find(r => r.id === region)?.code ?? region
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return Math.round(sorted[Math.floor(sorted.length / 2)])
}

let token: { value: string; exp: number } | null = null

async function workerToken(): Promise<string> {
  if (token && token.exp - Date.now() > 60_000) return token.value
  const fresh = await tokenSource()
  token = { value: fresh.token, exp: fresh.exp }
  return fresh.token
}

function wsUrl(worker: string, path: string, params: Record<string, string>): string {
  return `${worker}${path}?${new URLSearchParams(params).toString()}`
}

function readCache(): { at: number; pings: Partial<Record<RegionId, number>> } | null {
  try {
    const raw = localStorage.getItem(PROBE_CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCache(pings: Partial<Record<RegionId, number>>): void {
  try {
    localStorage.setItem(PROBE_CACHE_KEY, JSON.stringify({ at: Date.now(), pings }))
  } catch {
    return
  }
}

function pingOnce(ws: WebSocket): Promise<number> {
  return new Promise((resolve, reject) => {
    const started = performance.now()
    const timer = setTimeout(() => reject(new Error('timeout')), 4_000)
    const onMessage = (event: MessageEvent) => {
      if (event.data !== 'pong') return
      clearTimeout(timer)
      ws.removeEventListener('message', onMessage)
      resolve(performance.now() - started)
    }
    ws.addEventListener('message', onMessage)
    ws.send('ping')
  })
}

async function probeRegion(worker: string, region: RegionId, t: string): Promise<number | null> {
  const ws = new WebSocket(wsUrl(worker, `/probe/${region}`, { t }))
  try {
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => resolve(), { once: true })
      ws.addEventListener('error', () => reject(new Error('closed')), { once: true })
    })
    const rtts: number[] = []
    for (let i = 0; i < PINGS_PER_REGION; i++) rtts.push(await pingOnce(ws))
    return Math.round(Math.min(...(rtts.length > 1 ? rtts.slice(1) : rtts)))
  } catch {
    return null
  } finally {
    ws.close(1000)
  }
}

export function cachedRegionPings(): Partial<Record<RegionId, number>> {
  return readCache()?.pings ?? {}
}

let probing: Promise<Partial<Record<RegionId, number>>> | null = null

export function regionPings(worker: string, force = false): Promise<Partial<Record<RegionId, number>>> {
  const cached = readCache()
  if (!force && cached && Date.now() - cached.at < PROBE_EVERY_MS) return Promise.resolve(cached.pings)
  if (probing) return probing
  probing = (async () => {
    const t = await workerToken()
    const results = await Promise.all(REGIONS.map(async r => [r.id, await probeRegion(worker, r.id, t)] as const))
    const pings: Partial<Record<RegionId, number>> = {}
    for (const [id, ms] of results) {
      if (ms === null) continue
      pings[id] = ms
      report({ kind: 'probe', region: id, ms })
    }
    writeCache(pings)
    return pings
  })().finally(() => {
    probing = null
  })
  return probing
}

function burstFor(thread: string): number {
  return Math.max(1, (owners.get(thread)?.burstPerSec ?? DEFAULT_BURST_PER_SEC) - BURST_HEADROOM)
}

function encodePost(payload: PostPayload, retry: boolean): string {
  const ids = (payload.macroMetadata ?? {}) as MacroIds
  const macro = Number.isInteger(ids.macroPresetId) ? [ids.macroPresetId, ids.macroPresetVersionId ?? null] : undefined
  return JSON.stringify({
    t: 'post',
    text: payload.text,
    h: payload.post_hash,
    s: Date.now(),
    ...(retry ? { r: 1 } : {}),
    ...(macro ? { m: macro } : {}),
  })
}

class RegionalPoster {
  private ws: WebSocket | null = null
  private queue: string[] = []
  private rtts: number[] = []
  private sentAt = new Map<string, number>()
  private keepalive: ReturnType<typeof setInterval> | null = null
  private pacing: ReturnType<typeof setTimeout> | null = null
  private closed = false
  private retiring = false
  private pingSent = 0
  private lastPingReport = 0
  private failedConnects = 0
  private lastTroubleReport = 0
  private watchdog: ReturnType<typeof setInterval>

  readonly thread: string
  readonly region: RegionId
  readonly worker: string

  constructor(thread: string, region: RegionId, worker: string) {
    this.thread = thread
    this.region = region
    this.worker = worker
    this.watchdog = setInterval(() => this.overdue() && this.troubled(), KEEPALIVE_MS)
    void this.connect()
  }

  ping(): number | null {
    return median(this.rtts)
  }

  send(payload: PostPayload, retry = false): void {
    const message = encodePost(payload, retry)
    this.sentAt.set(payload.post_hash, performance.now())
    if (this.queue.length === 0 && !this.pacing && this.ws?.readyState === WebSocket.OPEN) this.ws.send(message)
    else this.queue.push(message)
  }

  private flush(): void {
    this.pacing = null
    const ws = this.ws
    if (ws?.readyState !== WebSocket.OPEN) return
    for (const message of this.queue.splice(0, burstFor(this.thread))) ws.send(message)
    if (this.queue.length > 0) this.pacing = setTimeout(() => this.flush(), PACE_MS)
  }

  private stopPacing(): void {
    if (this.pacing) clearTimeout(this.pacing)
    this.pacing = null
  }

  retire(): void {
    this.retiring = true
    const unsent = this.queue.splice(0).map(m => JSON.parse(m).h as string)
    for (const h of unsent) this.sentAt.delete(h)
    takeBack(this.thread, unsent)
    const until = Date.now() + RETIRE_WITHIN_MS
    const check = () => {
      if (this.sentAt.size === 0 || Date.now() >= until) this.close()
      else setTimeout(check, RETIRE_CHECK_MS)
    }
    check()
  }

  close(): void {
    this.closed = true
    this.stopPacing()
    clearInterval(this.watchdog)
    if (this.keepalive) clearInterval(this.keepalive)
    this.ws?.close(1000)
  }

  private unconfirmed(): string[] {
    const queued = new Set(this.queue.map(m => JSON.parse(m).h as string))
    return [...pending.values()]
      .filter(o => o.payload.thread_name === this.thread && o.via === this.region && !queued.has(o.payload.post_hash))
      .sort((a, b) => a.order - b.order)
      .map(o => {
        this.sentAt.set(o.payload.post_hash, performance.now())
        return encodePost(o.payload, false)
      })
  }

  private record(ms: number): void {
    this.rtts.push(ms)
    if (this.rtts.length > 10) this.rtts.shift()
    notify()
  }

  private reportPing(): void {
    const ms = this.ping()
    if (ms === null || Date.now() - this.lastPingReport < PING_REPORT_MS) return
    this.lastPingReport = Date.now()
    report({ kind: 'ping', region: this.region, ms, thread: this.thread })
  }

  private onMessage(raw: string): void {
    if (raw === 'pong') {
      if (this.pingSent) this.record(performance.now() - this.pingSent)
      this.reportPing()
      return
    }
    const m = JSON.parse(raw)
    const hash = typeof m.h === 'string' ? m.h : null
    if (hash && this.sentAt.has(hash) && m.t !== 'moved') {
      const ms = performance.now() - this.sentAt.get(hash)!
      this.record(ms)
      report({ kind: 'ack', region: this.region, ms, thread: this.thread })
    }
    if (hash) this.sentAt.delete(hash)
    if (m.t === 'moved') refusePost(this.thread, hash, this.region)
    else if ((m.t === 'ok' || m.t === 'passed' || m.t === 'dup') && hash) markDecided(hash)
    else if (m.t === 'post') showFromRegion(m)
    else if (m.t === 'thread_update') deliver('thread_update', { threadInfo: m.threadInfo })
    else if (m.t === 'rejected') deliver('post_rejected', { thread_name: this.thread, post_hash: hash, reason: m.reason })
    else if (m.t === 'rate_limited') {
      if (hash) pending.delete(hash)
      deliver('rate_limited', { scope: 'burst' })
    }
  }

  private troubled(): void {
    if (this.closed || Date.now() - this.lastTroubleReport < REPORT_EVERY_MS) return
    this.lastTroubleReport = Date.now()
    onUnreachable?.(this.thread, this.region)
  }

  private overdue(): boolean {
    const now = performance.now()
    for (const at of this.sentAt.values()) if (now - at > ACK_TIMEOUT_MS) return true
    return false
  }

  private async connect(): Promise<void> {
    if (this.closed || this.retiring) return
    let t: string
    try {
      t = await workerToken()
    } catch {
      setTimeout(() => void this.connect(), RECONNECT_MS * 4)
      return
    }
    const ws = new WebSocket(wsUrl(this.worker, `/thread/${encodeURIComponent(this.thread)}`, { region: this.region, t }))
    this.ws = ws
    let opened = false
    let ended = false
    const end = (failed: boolean) => {
      if (ended) return
      ended = true
      this.stopPacing()
      if (this.keepalive) clearInterval(this.keepalive)
      this.keepalive = null
      if (failed) this.failedConnects += 1
      if (this.failedConnects >= FAILED_CONNECTS_BEFORE_REPORT) this.troubled()
      if (!this.closed && !this.retiring) setTimeout(() => void this.connect(), RECONNECT_MS)
    }
    ws.addEventListener('open', () => {
      opened = true
      this.queue.unshift(...this.unconfirmed())
      this.flush()
      this.keepalive = setInterval(() => {
        this.pingSent = performance.now()
        if (ws.readyState === WebSocket.OPEN) ws.send('ping')
      }, KEEPALIVE_MS)
    })
    ws.addEventListener('message', event => {
      this.failedConnects = 0
      this.onMessage(String(event.data))
    })
    ws.addEventListener('error', () => end(!opened))
    ws.addEventListener('close', event => end(!opened || event.code === 1011))
  }
}

const owners = new Map<string, ThreadOwner>()
const posters = new Map<string, RegionalPoster>()
const standby = new Map<string, RegionalPoster>()
const sequenced = new Map<string, number>()
const held = new Map<string, Outgoing[]>()
const holding = new Set<string>()
const resending = new Set<string>()
const draining = new Set<string>()
const pending = new Map<string, Outgoing>()
const listeners = new Set<() => void>()
let version = 0
let order = 0

function notify(): void {
  version++
  for (const l of listeners) l()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function snapshot(): number {
  return version
}

export function ownerOf(thread: string): ThreadOwner | null {
  return owners.get(thread) ?? null
}

const rememberedOwners = new Map<string, ThreadOwner | null>()

function readStored<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    return
  }
}

function removeStored(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    return
  }
}

export function displayOwner(thread: string): ThreadOwner | null {
  const live = owners.get(thread)
  if (live) return live
  if (!rememberedOwners.has(thread)) {
    const stored = readStored<ThreadOwner>(OWNER_CACHE_PREFIX + thread)
    rememberedOwners.set(thread, stored?.movable ? { ...stored, moving: false } : null)
  }
  return rememberedOwners.get(thread) ?? null
}

let vpsPing: number | null | undefined

export function lastVpsPing(): number | null {
  if (vpsPing === undefined) vpsPing = readStored<number>(VPS_PING_KEY)
  return vpsPing
}

export function recordVpsPing(ms: number): void {
  if (ms === vpsPing) return
  vpsPing = ms
  writeStored(VPS_PING_KEY, ms)
  notify()
}

export function regionalPing(thread: string): number | null {
  return posters.get(thread)?.ping() ?? null
}

export function pendingCount(): number {
  return pending.size
}

export function heldCount(): number {
  let n = 0
  for (const queue of held.values()) n += queue.length
  return n
}

function hold(thread: string, outgoing: Outgoing): void {
  const queue = held.get(thread) ?? []
  queue.push(outgoing)
  queue.sort((a, b) => a.order - b.order)
  held.set(thread, queue)
}

export function confirmPost(hash: string | null | undefined): void {
  if (!hash || awaitingDurable.has(hash)) return
  const outgoing = pending.get(hash)
  noteSequenced(outgoing)
  pending.delete(hash)
  if (outgoing) releaseIfClear(outgoing.payload.thread_name)
}

export function refusePost(thread: string, hash: string | null | undefined, refusedBy: RegionId | null): void {
  const outgoing = hash ? pending.get(hash) : undefined
  if (outgoing) pending.delete(hash!)
  const owner = owners.get(thread)
  if (owner?.moving) {
    holding.add(thread)
    if (outgoing) hold(thread, outgoing)
    releaseIfClear(thread)
    return
  }
  const settledElsewhere = !!owner && !owner.moving && owner.region !== refusedBy
  if (settledElsewhere) {
    if (outgoing) route(outgoing)
    return
  }
  holding.add(thread)
  if (outgoing) hold(thread, outgoing)
}

function route(outgoing: Outgoing): void {
  const thread = outgoing.payload.thread_name
  if (holding.has(thread)) {
    hold(thread, outgoing)
    return
  }
  dispatch(outgoing)
}

function dispatch(outgoing: Outgoing): void {
  const thread = outgoing.payload.thread_name
  if (outgoing.order < (sequenced.get(thread) ?? -1)) {
    pending.delete(outgoing.payload.post_hash)
    deliver('post_rejected', { thread_name: thread, post_hash: outgoing.payload.post_hash, reason: 'superseded' })
    return
  }
  const poster = posters.get(thread)
  outgoing.via = poster?.region ?? null
  outgoing.sentAt = Date.now()
  pending.set(outgoing.payload.post_hash, outgoing)
  if (poster) poster.send(outgoing.payload, outgoing.retry)
  else outgoing.socket.emit('post', outgoing.payload)
}

export function stalePending(thread: string, olderThanMs: number): { h: string; text: string }[] {
  const cutoff = Date.now() - olderThanMs
  return [...pending.values()]
    .filter(o => o.payload.thread_name === thread && (o.sentAt ?? 0) < cutoff)
    .sort((a, b) => a.order - b.order)
    .slice(0, 200)
    .map(o => ({ h: o.payload.post_hash, text: o.payload.text }))
}

function takeBack(thread: string, hashes: string[]): void {
  const unsent = hashes.map(h => pending.get(h)).filter((o): o is Outgoing => !!o && !o.decided)
  if (unsent.length === 0) return
  for (const o of unsent) {
    pending.delete(o.payload.post_hash)
    hold(thread, o)
  }
  holding.add(thread)
}

function laterInFlight(thread: string, lost: Outgoing[]): boolean {
  const lostHashes = new Set(lost.map(o => o.payload.post_hash))
  const oldest = Math.min(...lost.map(o => o.order))
  for (const o of pending.values()) {
    if (o.payload.thread_name !== thread || lostHashes.has(o.payload.post_hash) || o.decided) continue
    if (o.order > oldest) return true
  }
  return false
}

function onlyTheTail(thread: string, lost: Outgoing[]): Outgoing[] {
  const newest = sequenced.get(thread) ?? -1
  const kept: Outgoing[] = []
  for (const o of lost) {
    if (o.order > newest) {
      kept.push(o)
      continue
    }
    pending.delete(o.payload.post_hash)
    awaitingDurable.delete(o.payload.post_hash)
    deliver('post_rejected', { thread_name: thread, post_hash: o.payload.post_hash, reason: 'superseded' })
  }
  return kept
}

export function reconcile(thread: string, known: string[], connectedAt: number): void {
  for (const h of known) {
    noteSequenced(pending.get(h))
    pending.delete(h)
  }
  releaseIfClear(thread)
  const now = Date.now()
  if (now - connectedAt < RESEND_UNKNOWN_MS) return
  const lost = [...pending.values()].filter(
    o => o.payload.thread_name === thread && (o.sentAt ?? now) < now - RESEND_UNKNOWN_MS,
  )
  if (lost.length === 0) return
  const owner = owners.get(thread)
  if (!owner || owner.moving || resending.has(thread) || laterInFlight(thread, lost)) return
  for (const o of onlyTheTail(thread, lost)) {
    pending.delete(o.payload.post_hash)
    o.retry = true
    hold(thread, o)
  }
  holding.add(thread)
  drain(thread)
}

function resendStranded(thread: string, region: RegionId | null): void {
  const stranded = [...pending.values()].filter(
    o => o.payload.thread_name === thread && o.via !== null && o.via !== region && !o.decided,
  )
  if (stranded.length === 0 || resending.has(thread)) return
  holding.add(thread)
  resending.add(thread)
  setTimeout(() => {
    resending.delete(thread)
    const still = stranded.filter(o => !o.decided && pending.has(o.payload.post_hash))
    for (const o of onlyTheTail(thread, still)) {
      pending.delete(o.payload.post_hash)
      hold(thread, o)
    }
    releaseIfClear(thread)
  }, RESEND_GRACE_MS)
}

function switchingRoute(thread: string): boolean {
  const route = posters.get(thread)?.region ?? null
  for (const o of pending.values()) {
    if (o.payload.thread_name === thread && !o.decided && o.via !== route) return true
  }
  return false
}

function drain(thread: string): void {
  if (draining.has(thread)) return
  draining.add(thread)
  holding.add(thread)
  let sent = 0
  const step = () => {
    const owner = owners.get(thread)
    const queue = held.get(thread) ?? []
    if (owner?.moving) {
      draining.delete(thread)
      notify()
      return
    }
    if (!owner || queue.length === 0) {
      draining.delete(thread)
      if (owner && queue.length === 0 && !switchingRoute(thread)) {
        held.delete(thread)
        holding.delete(thread)
      }
      notify()
      return
    }
    if (switchingRoute(thread)) {
      draining.delete(thread)
      notify()
      return
    }
    dispatch(queue.shift()!)
    sent += 1
    if (sent < FLUSH_AT_ONCE) step()
    else setTimeout(step, FLUSH_GAP_MS)
  }
  step()
}

export function setOwner(incoming: ThreadOwner): void {
  const owner = incoming.pending ? { ...incoming, pendingAt: Date.now() + incoming.pending.inMs } : incoming
  const thread = owner.thread_name
  owners.set(thread, owner)
  rememberedOwners.set(thread, owner.movable ? owner : null)
  if (owner.movable) writeStored(OWNER_CACHE_PREFIX + thread, { ...owner, moving: false, pending: null })
  else removeStored(OWNER_CACHE_PREFIX + thread)
  const ready = standby.get(thread)
  if (owner.moving) {
    if (ready && ready.region !== owner.target) {
      ready.close()
      standby.delete(thread)
    }
    if (owner.target && owner.worker && !standby.has(thread) && posters.get(thread)?.region !== owner.target) {
      standby.set(thread, new RegionalPoster(thread, owner.target, owner.worker))
    }
    notify()
    return
  }
  const current = posters.get(thread)
  const wanted = owner.region && owner.worker ? owner.region : null
  if (current && current.region !== wanted) {
    current.retire()
    posters.delete(thread)
  }
  if (ready) {
    standby.delete(thread)
    if (ready.region === wanted && !posters.has(thread)) posters.set(thread, ready)
    else ready.close()
  }
  if (wanted && owner.worker && !posters.has(thread)) {
    posters.set(thread, new RegionalPoster(thread, wanted, owner.worker))
  }
  if (unanswered(thread)) holding.add(thread)
  resendStranded(thread, wanted)
  releaseIfClear(thread)
  notify()
}

export function forgetThread(thread: string): void {
  posters.get(thread)?.close()
  posters.delete(thread)
  standby.get(thread)?.close()
  standby.delete(thread)
  owners.delete(thread)
  notify()
}

let sharedAt = 0

function shareLatency(worker: string): void {
  if (Date.now() - sharedAt < SHARE_EVERY_MS) return
  sharedAt = Date.now()
  const vps = lastVpsPing()
  if (vps !== null) report({ kind: 'ping', region: 'vps', ms: vps })
  const cached = readCache()
  if (!cached || Date.now() - cached.at >= PROBE_EVERY_MS) {
    void regionPings(worker).catch(() => undefined)
    return
  }
  for (const [region, ms] of Object.entries(cached.pings)) {
    if (typeof ms === 'number') report({ kind: 'probe', region, ms })
  }
}

export function sendPost(socket: Socket, payload: PostPayload): void {
  const owner = owners.get(payload.thread_name)
  if (owner?.movable && owner.worker) shareLatency(owner.worker)
  route({ socket, payload, order: order++, via: null })
}

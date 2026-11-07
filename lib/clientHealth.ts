import type { Socket } from 'socket.io-client'
import { ConnectionWatch } from './connectionWatch'

interface Spread { p50: number; p95: number; max: number }

const WINDOW_MS = 60_000
const PROBE_MS = 50
const PING_MS = 10_000
const PAUSED_MS = 5_000
const SIZE_SAMPLE = 10

interface LoafEntry {
  startTime: number; duration: number; blockingDuration?: number
  renderStart?: number; styleAndLayoutStart?: number
  scripts?: {
    invoker?: string; invokerType?: string; sourceURL?: string; sourceFunctionName?: string
    sourceCharPosition?: number; duration: number; forcedStyleAndLayoutDuration?: number
  }[]
}

function heapMb(): number | null {
  const m = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory
  return m?.usedJSHeapSize ? Math.round(m.usedJSHeapSize / 1048576) : null
}

const spread = (xs: number[]): Spread | null => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const at = (p: number) => Math.round(s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))])
  return { p50: at(0.5), p95: at(0.95), max: Math.round(s[s.length - 1]) }
}

export function routeKey(path: string): string {
  const p = path.split('?')[0]
  if (/^\/thread\/[^/]+/.test(p)) return p.split('/').slice(0, 3).join('/')
  return p
    .replace(/^\/counter\/[^/]+/, '/counter/:u')
    .replace(/^\/bingo\/\d+/, '/bingo/:id')
    .replace(/^\/achievements\/[^/]+/, '/achievements/:id')
    .replace(/^\/blog\/[^/]+/, '/blog/:slug')
    .slice(0, 64) || '/'
}

function device() {
  const ua = navigator.userAgent
  const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other'
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS' : /Linux|CrOS/.test(ua) ? 'Linux' : 'Other'
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string; rtt?: number; downlink?: number } }
  return {
    b, os,
    m: /Mobi|Android|iPhone|iPad/.test(ua) || matchMedia('(pointer: coarse)').matches,
    cores: nav.hardwareConcurrency ?? null,
    mem: nav.deviceMemory ?? null,
    net: nav.connection?.effectiveType ?? null,
    rtt: nav.connection?.rtt ?? null,
    dl: nav.connection?.downlink ?? null,
    w: window.innerWidth,
  }
}

const own: { rt: number[]; proc: number[] } = { rt: [], proc: [] }
export function noteOwnPost(roundTripMs: number, processingMs: number): void {
  if (!(roundTripMs >= 0 && roundTripMs < 60_000)) return
  if (own.rt.length >= 600) return
  own.rt.push(roundTripMs)
  own.proc.push(Math.max(0, processingMs || 0))
}

export class ClientHealth {
  private lag: number[] = []
  private lastProbe = 0
  private probe: number | null = null
  private flushTimer: number | null = null
  private pingTimer: number | null = null
  private pings: number[] = []
  private ltN = 0
  private ltMs = 0
  private lt: PerformanceObserver | null = null
  private frames = 0
  private jank = 0
  private frameMax = 0
  private lastFrame = 0
  private raf: number | null = null
  private visibleMs = 0
  private visibleSince = 0
  private msgTotal = 0
  private byEvent = new Map<string, { n: number; sn: number; sbytes: number; ms: number }>()
  private loafN = 0
  private loafBlock = 0
  private loafStyle = 0
  private loafRender = 0
  private loafScripts = new Map<string, { ms: number; n: number; forced: number }>()
  private loaf: PerformanceObserver | null = null
  private restoreDispatch: (() => void) | null = null
  private readonly born = performance.now()
  private readonly watch: ConnectionWatch
  private sentPings = new Map<number, boolean>()

  constructor(private readonly socket: Socket, private readonly route: () => string) {
    this.watch = new ConnectionWatch(socket)
  }

  start(): void {
    this.lastProbe = performance.now()
    this.probe = window.setInterval(() => {
      const now = performance.now()
      const late = now - this.lastProbe - PROBE_MS
      if (document.visibilityState === 'visible' && late < PAUSED_MS) this.lag.push(Math.max(0, late))
      this.lastProbe = now
      if (this.lag.length > 3000) this.lag.shift()
    }, PROBE_MS)
    this.flushTimer = window.setInterval(() => this.flush(), WINDOW_MS)
    this.pingTimer = window.setInterval(() => {
      if (!this.socket.connected) return
      const t = Date.now()
      if (this.sentPings.size < 100) this.sentPings.set(t, false)
      this.socket.volatile.emit('latency_ping', { t, h: 1 })
    }, PING_MS)
    this.socket.on('latency_pong', this.onPong)
    this.socket.onAny(this.onAny)
    this.watch.start()
    this.timeDispatch()
    if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame')) {
      try {
        this.loaf = new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as LoafEntry[]) this.onLoaf(e)
        })
        this.loaf.observe({ type: 'long-animation-frame', buffered: false })
      } catch {}
    }
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        this.lt = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) { this.ltN++; this.ltMs += e.duration }
        })
        this.lt.observe({ type: 'longtask', buffered: false })
      } catch {}
    }
    this.visibleSince = document.visibilityState === 'visible' ? performance.now() : 0
    document.addEventListener('visibilitychange', this.onVisibility)
    this.frame(performance.now())
  }

  stop(): void {
    if (this.probe != null) window.clearInterval(this.probe)
    if (this.flushTimer != null) window.clearInterval(this.flushTimer)
    if (this.pingTimer != null) window.clearInterval(this.pingTimer)
    if (this.raf != null) cancelAnimationFrame(this.raf)
    this.socket.off('latency_pong', this.onPong)
    this.socket.offAny(this.onAny)
    this.watch.stop()
    this.restoreDispatch?.()
    this.loaf?.disconnect()
    this.lt?.disconnect()
    document.removeEventListener('visibilitychange', this.onVisibility)
  }

  private frame = (t: number) => {
    if (this.lastFrame && document.visibilityState === 'visible') {
      const gap = t - this.lastFrame
      this.frames++
      if (gap > 50) this.jank++
      if (gap > this.frameMax) this.frameMax = gap
    }
    this.lastFrame = t
    this.raf = requestAnimationFrame(this.frame)
  }

  private onVisibility = () => {
    const now = performance.now()
    if (document.visibilityState === 'visible') { this.visibleSince = now; this.lastProbe = now }
    else if (this.visibleSince) { this.visibleMs += now - this.visibleSince; this.visibleSince = 0 }
    this.lastFrame = 0
  }

  private onPong = (msg: unknown) => {
    const { t, h } = (msg ?? {}) as { t?: unknown; h?: unknown }
    if (typeof t !== 'number') return
    const rtt = Date.now() - t
    if (rtt >= 0 && rtt < 60_000 && this.pings.length < 200) this.pings.push(rtt)
    if (h === 1 && this.sentPings.has(t)) this.sentPings.set(t, true)
    this.watch.notePong(rtt)
  }

  private onAny = (event: string, ...args: unknown[]) => {
    this.msgTotal++
    const e = this.byEvent.get(event) ?? { n: 0, sn: 0, sbytes: 0, ms: 0 }
    e.n++
    if (e.n % SIZE_SAMPLE === 1) {
      try {
        e.sbytes += JSON.stringify(args).length
        e.sn++
      } catch {}
    }
    this.byEvent.set(event, e)
  }

  private timeDispatch() {
    const sock = this.socket as unknown as { emitEvent?: (args: unknown[]) => void }
    const orig = sock.emitEvent
    if (typeof orig !== 'function') return
    sock.emitEvent = (args: unknown[]) => {
      const t0 = performance.now()
      try {
        orig.call(this.socket, args)
      } finally {
        const name = typeof args[0] === 'string' ? args[0] : '?'
        const e = this.byEvent.get(name)
        if (e) e.ms += performance.now() - t0
      }
    }
    this.restoreDispatch = () => { sock.emitEvent = orig }
  }

  private onLoaf(e: LoafEntry) {
    this.loafN++
    this.loafBlock += e.blockingDuration ?? 0
    const end = e.startTime + e.duration
    if (e.renderStart) this.loafRender += Math.max(0, end - e.renderStart)
    if (e.styleAndLayoutStart) this.loafStyle += Math.max(0, end - e.styleAndLayoutStart)
    for (const sc of e.scripts ?? []) {
      const file = (sc.sourceURL || '').split('/').pop()?.split('?')[0] || ''
      const fn = sc.sourceFunctionName || '(anon)'
      const key = `${sc.invoker || sc.invokerType || '?'} · ${fn}${file ? ` @ ${file}:${sc.sourceCharPosition ?? 0}` : ''}`.slice(0, 160)
      const v = this.loafScripts.get(key) ?? { ms: 0, n: 0, forced: 0 }
      v.ms += sc.duration
      v.n++
      v.forced += sc.forcedStyleAndLayoutDuration ?? 0
      this.loafScripts.set(key, v)
    }
  }

  private flush() {
    const now = performance.now()
    if (this.visibleSince) { this.visibleMs += now - this.visibleSince; this.visibleSince = now }
    const bytesOf = (e: { n: number; sn: number; sbytes: number; ms: number }) => (e.sn ? Math.round((e.sbytes / e.sn) * e.n) : 0)
    let bytes = 0
    for (const e of this.byEvent.values()) bytes += bytesOf(e)
    const report = {
      route: routeKey(this.route()),
      tr: (this.socket.io as unknown as { engine?: { transport?: { name?: string } } }).engine?.transport?.name ?? 'unknown',
      vis: Math.min(1, this.visibleMs / WINDOW_MS),
      lag: spread(this.lag),
      lt: { n: this.ltN, ms: Math.round(this.ltMs) },
      fr: { n: this.frames, jank: this.jank, max: Math.round(this.frameMax) },
      ping: spread(this.pings),
      own: own.rt.length ? { n: own.rt.length, rt: spread(own.rt), proc: spread(own.proc) } : null,
      msg: {
        total: this.msgTotal,
        bytes,
        top: [...this.byEvent.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 12).map(([k, v]) => [k, v.n, bytesOf(v), Math.round(v.ms)]),
      },
      loaf: this.loaf ? {
        n: this.loafN,
        block: Math.round(this.loafBlock),
        style: Math.round(this.loafStyle),
        render: Math.round(this.loafRender),
        scripts: [...this.loafScripts.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, 8)
          .map(([k, v]) => [k, Math.round(v.ms), v.n, Math.round(v.forced)]),
      } : null,
      mem: heapMb(),
      dom: document.getElementsByTagName('*').length,
      age: Math.round((now - this.born) / 60_000),
      dev: device(),
      pings: this.settlePings(),
      conn: this.watch.snapshot(),
    }
    this.lag = []; this.pings = []; this.ltN = 0; this.ltMs = 0
    this.frames = 0; this.jank = 0; this.frameMax = 0; this.visibleMs = 0
    this.msgTotal = 0; this.byEvent.clear()
    this.loafN = 0; this.loafBlock = 0; this.loafStyle = 0; this.loafRender = 0; this.loafScripts.clear()
    own.rt = []; own.proc = []
    if (report.vis === 0 || !this.socket.connected) return
    this.socket.volatile.emit('client_health', report)
    this.watch.delivered()
  }

  private settlePings(): { sent: number; back: number } {
    const settled = Date.now() - 10_000
    let sent = 0
    let back = 0
    for (const [t, returned] of this.sentPings) {
      if (t > settled) continue
      sent++
      if (returned) back++
      this.sentPings.delete(t)
    }
    return { sent, back }
  }
}

import type { Socket } from 'socket.io-client'

export interface RawSample {
  roundTripMs: number
  processingMs: number
  schedulingMs: number
  dbReadMs: number
  dbWriteMs: number
  otherMs: number
}

interface Spread {
  p50: number
  p95: number
  max: number
}

export const latencySnapshot = {
  pingP50: 0,
  pingP95: 0,
  blockedMsPerMin: 0,
  transport: 'unknown',
  roundTripP50: 0,
  processingP50: 0,
  samples: 0,
  uplinkP50: 0,
  downlinkP50: 0,
  loopLagP95: 0,
  paintP50: 0,
}

export interface LatencyReport {
  t: number
  thread: string
  transport: string
  n: number
  roundTrip: Spread
  processing: Spread
  unaccounted: Spread
  bands: { scheduling: number; dbRead: number; dbWrite: number; other: number }
  ping: Spread
  blockedMs: number
  longtask: boolean
  uplink: Spread | null
  downlink: Spread | null
  loopLag: Spread | null
  paint: Spread | null
}

export interface Stamps {
  sentAt: number
  receivedAt: number
  serverAt?: number
}

const WINDOW_MS = 15_000
const MAX_SAMPLES = 400
const PING_MS = 3_000
const LOOP_PROBE_MS = 500
const OFFSET_WINDOW = 200

const pct = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return Math.round(sorted[i])
}

const spread = (values: number[]): Spread => {
  const s = [...values].sort((a, b) => a - b)
  return { p50: pct(s, 50), p95: pct(s, 95), max: Math.round(s[s.length - 1] ?? 0) }
}

const spreadOrNull = (values: number[]): Spread | null => (values.length === 0 ? null : spread(values))

const nextTask = (fn: () => void): void => {
  const c = new MessageChannel()
  c.port1.onmessage = () => {
    c.port1.close()
    fn()
  }
  c.port2.postMessage(null)
}

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : Math.round(values.reduce((a, b) => a + b, 0) / values.length)

export function summarise(
  thread: string,
  transport: string,
  samples: RawSample[],
  pings: number[] = [],
  blockedMs = 0,
  extra: { longtask?: boolean; uplink?: number[]; downlink?: number[]; loopLag?: number[]; paint?: number[] } = {},
): LatencyReport | null {
  if (samples.length === 0) return null
  return {
    t: Date.now(),
    thread,
    transport,
    n: samples.length,
    roundTrip: spread(samples.map(s => s.roundTripMs)),
    processing: spread(samples.map(s => s.processingMs)),
    unaccounted: spread(samples.map(s => Math.max(0, s.roundTripMs - s.processingMs))),
    bands: {
      scheduling: mean(samples.map(s => s.schedulingMs)),
      dbRead: mean(samples.map(s => s.dbReadMs)),
      dbWrite: mean(samples.map(s => s.dbWriteMs)),
      other: mean(samples.map(s => s.otherMs)),
    },
    ping: spread(pings),
    blockedMs: Math.round(blockedMs),
    longtask: extra.longtask ?? false,
    uplink: spreadOrNull(extra.uplink ?? []),
    downlink: spreadOrNull(extra.downlink ?? []),
    loopLag: spreadOrNull(extra.loopLag ?? []),
    paint: spreadOrNull(extra.paint ?? []),
  }
}

export class LatencyReporter {
  private samples: RawSample[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private pings: number[] = []
  private blockedMs = 0
  private observer: PerformanceObserver | null = null
  private longtask = false
  private offsets: { rtt: number; offset: number }[] = []
  private uplinks: number[] = []
  private downlinks: number[] = []
  private loopLags: number[] = []
  private paints: number[] = []
  private loopTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly socket: Socket,
    private readonly thread: string,
  ) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.flush(), WINDOW_MS)

    this.socket.on('latency_pong', this.onPong)
    this.pingTimer = setInterval(() => {
      if (this.socket.connected) this.socket.volatile.emit('latency_ping', { t: Date.now() })
    }, PING_MS)

    const probe = () => {
      const wait = LOOP_PROBE_MS * (0.5 + Math.random())
      const due = performance.now() + wait
      this.loopTimer = setTimeout(() => {
        if (!this.timer) return
        if (!document.hidden) this.push(this.loopLags, Math.max(0, performance.now() - due))
        probe()
      }, wait)
    }
    probe()

    if (typeof PerformanceObserver !== 'undefined') {
      try {
        this.observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) this.blockedMs += entry.duration
        })
        this.observer.observe({ type: 'longtask', buffered: false })
        this.longtask = true
      } catch {
      }
    }
  }

  stop(): void {
    if (this.loopTimer) clearTimeout(this.loopTimer)
    this.loopTimer = null
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (this.pingTimer) clearInterval(this.pingTimer)
    this.pingTimer = null
    this.socket.off('latency_pong', this.onPong)
    this.observer?.disconnect()
    this.observer = null
    this.flush()
  }

  private onPong = (msg: unknown): void => {
    const now = Date.now()
    const { t, s } = (msg ?? {}) as { t?: unknown; s?: unknown }
    if (typeof t !== 'number') return
    const rtt = now - t
    if (rtt < 0 || rtt > 60_000) return
    this.pings.push(rtt)
    if (this.pings.length > 100) this.pings.shift()

    if (typeof s !== 'number') return
    this.offsets.push({ rtt, offset: s - (t + now) / 2 })
    if (this.offsets.length > OFFSET_WINDOW) this.offsets.shift()
  }

  private offset(): number | null {
    let best: { rtt: number; offset: number } | null = null
    for (const o of this.offsets) if (!best || o.rtt < best.rtt) best = o
    return best?.offset ?? null
  }

  private push(into: number[], v: number): void {
    if (!(v >= 0 && v < 60_000)) return
    if (into.length >= MAX_SAMPLES) into.shift()
    into.push(v)
  }

  record(sample: RawSample, stamps?: Stamps): void {
    if (this.samples.length >= MAX_SAMPLES) this.samples.shift()
    this.samples.push(sample)
    if (!stamps) return

    const offset = this.offset()
    if (typeof stamps.serverAt === 'number' && offset !== null) {
      const ingress = stamps.serverAt - sample.processingMs - offset
      const up = Math.max(0, ingress - stamps.sentAt)
      this.push(this.uplinks, up)
      this.push(this.downlinks, Math.max(0, sample.roundTripMs - sample.processingMs - up))
    }

    if (!document.hidden) {
      const from = stamps.receivedAt
      requestAnimationFrame(() => nextTask(() => this.push(this.paints, Date.now() - from)))
    }
  }

  private transport(): string {
    const engine = (this.socket as unknown as { io?: { engine?: { transport?: { name?: string } } } }).io?.engine
    return engine?.transport?.name ?? 'unknown'
  }

  private flush(): void {
    const transport = this.transport()
    const blocked = this.blockedMs
    this.blockedMs = 0
    const report = summarise(this.thread, transport, this.samples, this.pings, blocked, {
      longtask: this.longtask,
      uplink: this.uplinks,
      downlink: this.downlinks,
      loopLag: this.loopLags,
      paint: this.paints,
    })
    this.samples = []
    this.pings = []
    this.uplinks = []
    this.downlinks = []
    this.loopLags = []
    this.paints = []

    if (report) {
      latencySnapshot.pingP50 = report.ping.p50
      latencySnapshot.pingP95 = report.ping.p95
      latencySnapshot.blockedMsPerMin = Math.round((blocked / WINDOW_MS) * 60_000)
      latencySnapshot.transport = transport
      latencySnapshot.roundTripP50 = report.roundTrip.p50
      latencySnapshot.processingP50 = report.processing.p50
      latencySnapshot.samples = report.n
      latencySnapshot.uplinkP50 = report.uplink?.p50 ?? 0
      latencySnapshot.downlinkP50 = report.downlink?.p50 ?? 0
      latencySnapshot.loopLagP95 = report.loopLag?.p95 ?? 0
      latencySnapshot.paintP50 = report.paint?.p50 ?? 0
    }

    if (!report || !this.socket.connected) return
    this.socket.volatile.emit('client_latency', report)
  }
}

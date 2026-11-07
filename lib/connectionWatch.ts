import type { Socket } from 'socket.io-client'

export type DropRecord = [at: number, reason: string, downMs: number | null]

export interface EdgeProbe {
  ms: number
  colo: string | null
}

export interface ConnectionReport {
  drops: DropRecord[]
  attempts: number
  offlineMs: number
  netChanges: number
  edge: EdgeProbe | null
}

const MAX_DROPS = 20
const EDGE_TIMEOUT_MS = 15_000
const EDGE_MIN_GAP_MS = 20_000
const EDGE_BASELINE_MS = 10 * 60_000
const SLOW_PONG_MS = 800

type NetworkInformationLike = EventTarget & { effectiveType?: string }

const onLocalhost = () =>
  typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)

function coloOf(trace: string): string | null {
  const m = /^colo=([A-Z0-9]{2,8})$/m.exec(trace)
  return m ? m[1] : null
}

export class ConnectionWatch {
  private drops: DropRecord[] = []
  private downSince: number | null = null
  private downReason = ''
  private attempts = 0
  private offlineMs = 0
  private offlineSince: number | null = null
  private netChanges = 0
  private edge: EdgeProbe | null = null
  private edgeInFlight = false
  private edgeLastAt = 0
  private edgeUnavailable = onLocalhost()

  constructor(private readonly socket: Socket) {}

  start(): void {
    this.socket.on('disconnect', this.onDisconnect)
    this.socket.on('connect', this.onConnect)
    this.socket.io.on('reconnect_attempt', this.onAttempt)
    window.addEventListener('offline', this.onOffline)
    window.addEventListener('online', this.onOnline)
    this.network()?.addEventListener('change', this.onNetChange)
    if (!navigator.onLine) this.offlineSince = Date.now()
    void this.probeEdge()
  }

  stop(): void {
    this.socket.off('disconnect', this.onDisconnect)
    this.socket.off('connect', this.onConnect)
    this.socket.io.off('reconnect_attempt', this.onAttempt)
    window.removeEventListener('offline', this.onOffline)
    window.removeEventListener('online', this.onOnline)
    this.network()?.removeEventListener('change', this.onNetChange)
  }

  notePong(rttMs: number): void {
    if (rttMs >= SLOW_PONG_MS) void this.probeEdge()
  }

  snapshot(): ConnectionReport {
    const now = Date.now()
    const openOffline = this.offlineSince != null ? now - this.offlineSince : 0
    const pending: DropRecord[] = this.downSince != null ? [[this.downSince, this.downReason, null]] : []
    if (now - this.edgeLastAt > EDGE_BASELINE_MS) void this.probeEdge()
    return {
      drops: [...this.drops, ...pending].slice(-MAX_DROPS),
      attempts: this.attempts,
      offlineMs: Math.round(this.offlineMs + openOffline),
      netChanges: this.netChanges,
      edge: this.edge,
    }
  }

  delivered(): void {
    this.drops = []
    this.attempts = 0
    this.offlineMs = 0
    if (this.offlineSince != null) this.offlineSince = Date.now()
    this.netChanges = 0
    this.edge = null
  }

  private network(): NetworkInformationLike | undefined {
    return (navigator as Navigator & { connection?: NetworkInformationLike }).connection
  }

  private onDisconnect = (reason: string) => {
    if (this.downSince != null) return
    this.downSince = Date.now()
    this.downReason = reason
  }

  private onConnect = () => {
    if (this.downSince == null) return
    const now = Date.now()
    this.drops.push([this.downSince, this.downReason, now - this.downSince])
    if (this.drops.length > MAX_DROPS) this.drops.shift()
    this.downSince = null
    void this.probeEdge()
  }

  private onAttempt = () => {
    this.attempts++
  }

  private onOffline = () => {
    if (this.offlineSince == null) this.offlineSince = Date.now()
  }

  private onOnline = () => {
    if (this.offlineSince == null) return
    this.offlineMs += Date.now() - this.offlineSince
    this.offlineSince = null
  }

  private onNetChange = () => {
    this.netChanges++
    void this.probeEdge()
  }

  private async probeEdge(): Promise<void> {
    const now = Date.now()
    if (this.edgeUnavailable || this.edgeInFlight || now - this.edgeLastAt < EDGE_MIN_GAP_MS) return
    if (document.visibilityState !== 'visible') return
    this.edgeInFlight = true
    this.edgeLastAt = now
    const abort = new AbortController()
    const timer = window.setTimeout(() => abort.abort(), EDGE_TIMEOUT_MS)
    const t0 = performance.now()
    try {
      const res = await fetch(`/cdn-cgi/trace?r=${now}`, { cache: 'no-store', credentials: 'omit', signal: abort.signal })
      const body = await res.text()
      const ms = Math.round(performance.now() - t0)
      if (!res.ok) {
        this.edgeUnavailable = res.status === 404
        return
      }
      const probe = { ms, colo: coloOf(body) }
      if (!this.edge || probe.ms > this.edge.ms) this.edge = probe
    } catch {
      const ms = Math.round(performance.now() - t0)
      if (abort.signal.aborted && (!this.edge || ms > this.edge.ms)) this.edge = { ms, colo: this.edge?.colo ?? null }
    } finally {
      window.clearTimeout(timer)
      this.edgeInFlight = false
    }
  }
}

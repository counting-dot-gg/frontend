import { io } from 'socket.io-client'

const URL = process.env.PROBE_URL ?? 'http://127.0.0.1:8804'
const PATH = process.env.PROBE_PATH ?? '/socket.io'
const HOST = process.env.PROBE_HOST
const LABEL = process.env.PROBE_LABEL ?? 'probe'
const PING_EVERY_MS = Number(process.env.PROBE_PING_MS ?? 2000)
const REPORT_EVERY_MS = Number(process.env.PROBE_REPORT_MS ?? 30_000)
const WINDOW = 512

let samples = []
let edgeSamples = []
let edgeFailures = 0
const EDGE = (process.env.PROBE_EDGE ?? (URL.startsWith('https:') ? '1' : '0')) === '1'
let connects = 0
let disconnects = 0
let lastDisconnectReason = ''
let outstanding = 0
let lost = 0

const stamp = () => new Date().toISOString().slice(11, 19)

function pct(sorted, p) {
  if (sorted.length === 0) return 0
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return Math.round(sorted[i])
}

function edgeReport() {
  if (!EDGE) return ''
  const e = [...edgeSamples].sort((a, b) => a - b)
  edgeSamples = []
  if (e.length === 0) return ` | edge: no replies (failures=${edgeFailures})`
  return ` | edge n=${e.length} p50=${pct(e, 50)}ms p95=${pct(e, 95)}ms max=${Math.round(e[e.length - 1])}ms failures=${edgeFailures}`
}

function report() {
  if (samples.length === 0) {
    console.log(`${stamp()} ${LABEL} no replies (connects=${connects} disconnects=${disconnects} ${lastDisconnectReason})${edgeReport()}`)
    return
  }
  const s = [...samples].sort((a, b) => a - b)
  samples = []
  console.log(
    `${stamp()} ${LABEL} n=${s.length} p50=${pct(s, 50)}ms p95=${pct(s, 95)}ms max=${Math.round(s[s.length - 1])}ms` +
      ` connects=${connects} disconnects=${disconnects} lost=${lost}` +
      (lastDisconnectReason ? ` last="${lastDisconnectReason}"` : '') +
      edgeReport(),
  )
}

const UA = process.env.PROBE_UA ?? 'countgg-socket-probe/1.0'

const socket = io(URL, {
  extraHeaders: { 'User-Agent': UA, ...(HOST ? { Host: HOST } : {}) },
  path: PATH,
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30_000,
  timeout: 20_000,
  withCredentials: false,
})

socket.on('connect', () => {
  connects += 1
  console.log(`${stamp()} ${LABEL} connected (${socket.id})`)
})

socket.on('disconnect', (reason) => {
  disconnects += 1
  lastDisconnectReason = String(reason)
  console.log(`${stamp()} ${LABEL} disconnected: ${reason}`)
})

socket.on('connect_error', (err) => {
  console.log(`${stamp()} ${LABEL} connect_error: ${err.message}`)
})

socket.on('latency_pong', (msg) => {
  const t = msg?.t
  if (typeof t !== 'number') return
  outstanding = Math.max(0, outstanding - 1)
  const rtt = Date.now() - t
  if (rtt < 0 || rtt > 120_000) return
  samples.push(rtt)
  if (samples.length > WINDOW) samples.shift()
})

setInterval(() => {
  if (!socket.connected) return
  if (outstanding > 0) {
    lost += outstanding
    outstanding = 0
  }
  outstanding += 1
  socket.emit('latency_ping', { t: Date.now() })
}, PING_EVERY_MS)

if (EDGE) {
  const traceUrl = new globalThis.URL('/cdn-cgi/trace', URL).toString()
  let colo = ''
  setInterval(async () => {
    const t0 = performance.now()
    try {
      const res = await fetch(traceUrl, { headers: { 'User-Agent': UA }, cache: 'no-store' })
      const body = await res.text()
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      edgeSamples.push(performance.now() - t0)
      if (edgeSamples.length > WINDOW) edgeSamples.shift()
      const c = /^colo=(\w+)$/m.exec(body)?.[1]
      if (c && c !== colo) {
        colo = c
        console.log(`${stamp()} ${LABEL} edge answered by Cloudflare ${colo}`)
      }
    } catch {
      edgeFailures += 1
    }
  }, PING_EVERY_MS)
}

setInterval(report, REPORT_EVERY_MS)

const stop = () => {
  report()
  socket.close()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

console.log(`${LABEL} probing ${URL}${PATH === '/socket.io' ? '' : PATH}${HOST ? ` (Host: ${HOST})` : ''} every ${PING_EVERY_MS}ms${EDGE ? ' (+ Cloudflare edge)' : ''}, reporting every ${REPORT_EVERY_MS / 1000}s`)

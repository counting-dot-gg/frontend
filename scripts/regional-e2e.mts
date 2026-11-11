import { createHmac } from 'node:crypto'
import { io, type Socket } from 'socket.io-client'
import {
  configureRegional, confirmPost, heldCount, ownerOf, pendingCount, refusePost, sendPost, setOwner,
  type ThreadOwner,
} from '../lib/regional.ts'

const env = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback
  if (value === undefined) {
    console.error(`set ${key}`)
    process.exit(2)
  }
  return value
}

const SOCKET_URL = env('SOCKET_URL', 'http://192.168.1.154:8804')
const API_URL = env('API_URL', 'http://192.168.1.154:3001')
const ORIGIN = env('ORIGIN', 'http://192.168.1.154:3002')
const THREAD = env('THREAD', 'test2')
const COOKIE = env('COOKIE')
const ROUTE = env('ROUTE', 'enam,weur,vps,wnam,enam,vps').split(',')
const RATE = Number(env('RATE', '10'))
const BURST = Number(env('BURST', '8'))
const MOVE_EVERY_MS = Number(env('MOVE_EVERY_MS', '6000'))
const SETTLE_MS = Number(env('SETTLE_MS', '60000'))
const START = BigInt(env('START'))
const BREAK_IN = env('BREAK_IN', 'enam')
const BREAK_AFTER_MS = Number(env('BREAK_AFTER_MS', '3000'))
const AFTER_BREAK_MS = Number(env('AFTER_BREAK_MS', '4000'))
const SHARED_SECRET = BREAK_IN === 'none' ? '' : env('DO_SHARED_SECRET')

const headers = { Cookie: COOKIE, Origin: ORIGIN }

configureRegional({
  tokenSource: async () => {
    const res = await fetch(`${API_URL}/api/do/token`, { headers })
    if (!res.ok) throw new Error(`token ${res.status}: sign in with a counter account on the dev site and use its cookie`)
    return res.json()
  },
})

function connect(withLogin: boolean): Promise<Socket> {
  const socket = io(SOCKET_URL, {
    transports: ['websocket'],
    extraHeaders: withLogin ? headers : { Origin: ORIGIN },
    reconnection: true,
  })
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket))
    socket.once('connect_error', reject)
  })
}

function nextOwner(socket: Socket, wanted: (o: ThreadOwner) => boolean, ms = 20_000): Promise<ThreadOwner> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('thread_owner', on)
      reject(new Error('no matching thread_owner'))
    }, ms)
    function on(o: ThreadOwner) {
      if (o.thread_name !== THREAD || !wanted(o)) return
      clearTimeout(timer)
      socket.off('thread_owner', on)
      resolve(o)
    }
    socket.on('thread_owner', on)
  })
}

async function breakObject(owner: ThreadOwner): Promise<void> {
  const base = (owner.worker ?? '').replace(/^wss:/, 'https:').replace(/^ws:/, 'http:')
  const body = JSON.stringify({ thread: THREAD, region: owner.region, epoch: owner.epoch, mode: 'broken' })
  const ts = String(Date.now())
  const sig = createHmac('sha256', SHARED_SECRET).update(`${ts}.${body}`).digest('hex')
  const res = await fetch(`${base}/admin/fault`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cgg-ts': ts, 'x-cgg-sig': sig },
    body,
  })
  if (!res.ok) throw new Error(`break ${res.status}`)
}

const counter = await connect(true)
const viewer = await connect(false)
const refusals: string[] = []
let unreachableReports = 0
configureRegional({
  onUnreachable: (thread, region) => {
    unreachableReports++
    log('reporting', region, 'unreachable')
    counter.emit('thread_region_unreachable', { thread_name: thread, region })
  },
})
let rateLimited = 0
const t0 = Date.now()
const log = (...parts: unknown[]) => console.log(`${((Date.now() - t0) / 1000).toFixed(2)}s`, ...parts)
counter.on('rate_limited', (m: { scope?: string }) => {
  rateLimited++
  log('rate_limited', m?.scope)
})
let lastOwner = ''
counter.on('thread_owner', (o: ThreadOwner) => {
  const key = `${o.region ?? 'vps'} epoch ${o.epoch} ${o.moving ? 'moving' : 'settled'}`
  if (o.thread_name !== THREAD || key === lastOwner) return
  lastOwner = key
  log('owner', key)
})
counter.on('thread_owner', (o: ThreadOwner) => o.thread_name === THREAD && setOwner(o))
counter.on('post_moved', (m: { thread_name: string; post_hash?: string }) => {
  if (m.thread_name === THREAD) refusePost(THREAD, m.post_hash, null)
})
counter.on('post', (m: { post?: { post_hash?: string } }) => confirmPost(m?.post?.post_hash))
counter.on('thread_region_refused', (m: { thread_name: string; reason: string }) => {
  if (m.thread_name !== THREAD) return
  refusals.push(m.reason)
  log('refused', m.reason)
})

const seen: string[] = []
const seenCount = new Map<string, number>()
const invalid: string[] = []
viewer.on('post', (m: { post?: { post_hash?: string; isValidCount?: boolean; rawText?: string } }) => {
  const hash = m?.post?.post_hash
  if (!hash || !hash.startsWith('e2e-')) return
  seen.push(hash)
  if (!m.post?.isValidCount) invalid.push(m.post?.rawText ?? hash)
  seenCount.set(hash, (seenCount.get(hash) ?? 0) + 1)
})

const firstOwner = nextOwner(counter, () => true)
counter.emit('watch', THREAD)
viewer.emit('watch', THREAD)
const start = await firstOwner
if (!start.movable) throw new Error(`${THREAD} is not movable: set DO_THREADS on the socket`)
if (start.region) {
  counter.emit('thread_region', { thread_name: THREAD, region: 'vps' })
  await nextOwner(counter, o => !o.region && !o.moving, 30_000)
}
log(`start: ${THREAD} on the VPS, epoch ${ownerOf(THREAD)?.epoch}`)

const run = `e2e-${Date.now().toString(36)}`
const sent: string[] = []
let n = 0
function post(): void {
  n += 1
  const hash = `${run}-${n}`
  sent.push(hash)
  sendPost(counter, { thread_name: THREAD, text: String(START + BigInt(n)), post_hash: hash })
}

const poster = setInterval(post, 1000 / RATE)
const moves: { to: string; ms: number; colo?: string }[] = []
for (const to of ROUTE) {
  await new Promise(r => setTimeout(r, MOVE_EVERY_MS))
  const before = ownerOf(THREAD)
  const started = Date.now()
  const settled = nextOwner(counter, o => !o.moving && (o.region ?? 'vps') === to, 30_000)
  counter.emit('thread_region', { thread_name: THREAD, region: to })
  if (to === ROUTE[0]) counter.emit('thread_region', { thread_name: THREAD, region: to })
  for (let i = 0; i < BURST; i++) post()
  try {
    await settled
    moves.push({ to, ms: Date.now() - started })
    log(`moved ${before?.region ?? 'vps'} -> ${to} in ${Date.now() - started} ms (epoch ${ownerOf(THREAD)?.epoch})`)
  } catch {
    log(`move to ${to} did not finish; refusals so far: ${refusals.join(', ') || 'none'}`)
  }
}
let reclaimMs: number | null = null
if (BREAK_IN !== 'none') {
  await new Promise(r => setTimeout(r, MOVE_EVERY_MS))
  const settled = nextOwner(counter, o => !o.moving && o.region === BREAK_IN, 30_000)
  counter.emit('thread_region', { thread_name: THREAD, region: BREAK_IN })
  const owner = await settled
  log(`on ${BREAK_IN} (epoch ${owner.epoch}); breaking its object in ${BREAK_AFTER_MS} ms`)
  await new Promise(r => setTimeout(r, BREAK_AFTER_MS))
  const reclaimed = nextOwner(counter, o => !o.moving && !o.region, 90_000)
  const brokeAt = Date.now()
  await breakObject(owner)
  log('object broken')
  try {
    const back = await reclaimed
    reclaimMs = Date.now() - brokeAt
    log(`taken back to the VPS in ${reclaimMs} ms (epoch ${back.epoch})`)
  } catch {
    log('the VPS never took the thread back')
  }
  await new Promise(r => setTimeout(r, AFTER_BREAK_MS))
}
clearInterval(poster)

const deadline = Date.now() + SETTLE_MS
while (Date.now() < deadline && (pendingCount() > 0 || heldCount() > 0 || sent.some(h => !seenCount.has(h)))) {
  await new Promise(r => setTimeout(r, 250))
}

const missing = sent.filter(h => !seenCount.has(h))
const duplicated = [...seenCount].filter(([, c]) => c > 1).map(([h]) => h)
const position = new Map(sent.map((h, i) => [h, i]))
let outOfOrder = 0
for (let i = 1; i < seen.length; i++) {
  if ((position.get(seen[i]) ?? 0) < (position.get(seen[i - 1]) ?? 0)) outOfOrder++
}

console.log('')
console.log(`sent ${sent.length}, seen by the viewer ${seenCount.size}, pending ${pendingCount()}, held ${heldCount()}`)
console.log(`missing ${missing.length}${missing.length ? ` (first: ${missing.slice(0, 5).join(', ')})` : ''}`)
console.log(`duplicated ${duplicated.length}${duplicated.length ? ` (first: ${duplicated.slice(0, 5).join(', ')})` : ''}`)
console.log(`out of order ${outOfOrder}`)
console.log(`invalid counts ${invalid.length}${invalid.length ? ` (first: ${invalid.slice(0, 5).join(', ')})` : ''}`)
console.log(`moves completed ${moves.length} of ${ROUTE.length}; refusals: ${refusals.join(', ') || 'none'}`)
const concurrentRefused = refusals.includes('moving')
console.log(`rate limited ${rateLimited}`)
if (BREAK_IN !== 'none') {
  console.log(`broken object taken back: ${reclaimMs === null ? 'NO' : `yes, in ${reclaimMs} ms`}; unreachable reports ${unreachableReports}`)
}
console.log(`second move request while moving refused: ${concurrentRefused ? 'yes' : 'NO'}`)

const passed = rateLimited === 0 && missing.length === 0 && duplicated.length === 0 && outOfOrder === 0 && invalid.length === 0
  && moves.length === ROUTE.length
  && concurrentRefused && pendingCount() === 0 && heldCount() === 0
  && (BREAK_IN === 'none' || reclaimMs !== null)
console.log(passed ? 'PASS' : 'FAIL')
counter.close()
viewer.close()
process.exit(passed ? 0 : 1)

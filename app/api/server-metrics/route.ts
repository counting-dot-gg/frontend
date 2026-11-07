import { PROM_UID, cached, grafana } from '@/lib/grafanaServer'

const CACHE_MS = 30_000
const POINTS = 90
const WINDOWS = new Set([30, 60, 180, 1440, 10080])

const NODE = 'job="integrations/node_exporter"'
const SOCKET = 'job="cgg-socket"'
const ROOT = `${NODE},mountpoint="/"`
const DB = `${NODE},mountpoint="/mnt/mysql_data"`
const daysLeft = (fs: string) =>
  `(node_filesystem_avail_bytes{${fs}} / -deriv(node_filesystem_avail_bytes{${fs}}[3d]) / 86400) > 0`
const uptimePct = (job: string) => `100 * avg(avg_over_time(probe_success{job="${job}"}[30d]))`
const ping = (w: string) =>
  `avg by (probe) (avg_over_time(probe_http_duration_seconds{job="socket",phase="connect"}[${w}])) * 1000`
const usedPct = (fs: string) => `100 * (1 - node_filesystem_avail_bytes{${fs}} / node_filesystem_size_bytes{${fs}})`

const quantileMs = (metric: string, q: number, r: string) =>
  `histogram_quantile(${q}, sum by (le) (rate(${metric}_bucket{${SOCKET}}[${r}]))) * 1000`

const QUERIES: Record<string, (r: string, s: string) => string> = {
  rtMs: (r) => quantileMs('cgg_client_round_trip_seconds', 0.5, r),
  procMs: (r) => quantileMs('cgg_client_processing_seconds', 0.5, r),
  unaccMs: (r) => quantileMs('cgg_client_unaccounted_seconds', 0.5, r),
  countsPerMin: (r) => `sum(rate(cgg_client_counts_total{${SOCKET}}[${r}])) * 60`,
  pollingReports: (_r, s) => `sum(increase(cgg_client_reports_total{${SOCKET},transport="polling"}[${s}]))`,
  postsPerSec: (r) => `sum(rate(cgg_posts_total{${SOCKET}}[${r}]))`,
  p50: (r) => quantileMs('cgg_post_total_seconds', 0.5, r),
  p99: (r) => quantileMs('cgg_post_total_seconds', 0.99, r),
  p999: (r) => quantileMs('cgg_post_total_seconds', 0.999, r),
  maxMs: (_r, s) => `max_over_time(cgg_post_total_seconds_max_1m{${SOCKET}}[${s}]) * 1000`,
  fsyncP99: (r) => quantileMs('cgg_wal_sync_seconds', 0.99, r),
  sockets: (_r, s) => `max_over_time(cgg_sockets{${SOCKET}}[${s}])`,
  persistLag: (_r, s) => `max_over_time(cgg_persist_lag_records{${SOCKET}}[${s}])`,
  rejectedPerSec: (r) => `sum(rate(cgg_posts_rejected_total{${SOCKET}}[${r}]))`,
  limitedPerSec: (r) => `sum(rate(cgg_rate_limited_total{${SOCKET}}[${r}]))`,
  dbRowsPerSec: (r) => `sum(rate(cgg_persist_rows_total{${SOCKET}}[${r}]))`,
  walMB: (_r, s) => `max_over_time(cgg_wal_disk_bytes{${SOCKET}}[${s}]) / 1e6`,
  cpuPct: (r) => `100 * (1 - avg(rate(node_cpu_seconds_total{${NODE},mode="idle"}[${r}])))`,
  memPct: () => `100 * (1 - node_memory_MemAvailable_bytes{${NODE}} / node_memory_MemTotal_bytes{${NODE}})`,
  load1: () => `node_load1{${NODE}}`,
  netInMBs: (r) => `sum(rate(node_network_receive_bytes_total{${NODE},device!="lo"}[${r}])) / 1e6`,
  netOutMBs: (r) => `sum(rate(node_network_transmit_bytes_total{${NODE},device!="lo"}[${r}])) / 1e6`,
  diskReadMBs: (r) => `sum(rate(node_disk_read_bytes_total{${NODE}}[${r}])) / 1e6`,
  diskWriteMBs: (r) => `sum(rate(node_disk_written_bytes_total{${NODE}}[${r}])) / 1e6`,
  rootUsedPct: () => usedPct(ROOT),
  dbUsedPct: () => usedPct(DB),
}

const INSTANT: Record<string, string> = {
  rootFreeGB: `node_filesystem_avail_bytes{${ROOT}} / 1e9`,
  rootSizeGB: `node_filesystem_size_bytes{${ROOT}} / 1e9`,
  dbFreeGB: `node_filesystem_avail_bytes{${DB}} / 1e9`,
  dbSizeGB: `node_filesystem_size_bytes{${DB}} / 1e9`,
  rootDaysLeft: daysLeft(ROOT),
  dbDaysLeft: daysLeft(DB),
  memTotalGB: `node_memory_MemTotal_bytes{${NODE}} / 1e9`,
  cpus: `count(node_cpu_seconds_total{${NODE},mode="idle"})`,
  bootAt: `node_boot_time_seconds{${NODE}}`,
  backupAt: `max(cgg_backup_last_success_timestamp_seconds)`,
  backupMB: `max(cgg_backup_last_size_bytes) / 1e6`,
  backupSec: `max(cgg_backup_last_duration_seconds)`,
  walMB: `max(cgg_wal_disk_bytes{${SOCKET}}) / 1e6`,
  siteUptime: uptimePct('site'),
  socketUptime: uptimePct('socket'),
  certDays: `min(probe_ssl_earliest_cert_expiry{job=~"site|socket"} - time()) / 86400`,
}

const CURRENT = ['rtMs', 'procMs', 'unaccMs', 'countsPerMin', 'postsPerSec', 'p50', 'p99', 'sockets', 'cpuPct', 'memPct']

type Series = Record<string, (number | null)[]>
interface Payload {
  minutes: number
  stepSec: number
  now: number
  socketUp: boolean | null
  current: Record<string, number | null>
  cities: { name: string; ms: number | null; series: (number | null)[] }[]
  t: number[]
  series: Series
}

interface PromData {
  result: { metric: Record<string, string>; values?: [number, string][]; value?: [number, string] }[]
}

async function prom(path: string, params: Record<string, string>): Promise<PromData> {
  const json = await grafana<{ status: string; error?: string; data: PromData }>(
    `/api/datasources/proxy/uid/${PROM_UID}/api/v1/${path}`, params,
  )
  if (json.status !== 'success') throw new Error(`grafana: ${json.error ?? 'query failed'}`)
  return json.data
}

const round = (v: number) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100)

async function build(minutes: number): Promise<Payload> {
  const now = Math.floor(Date.now() / 1000)
  const stepSec = Math.max(30, Math.ceil((minutes * 60) / POINTS / 30) * 30)
  const end = now - (now % stepSec)
  const start = end - minutes * 60
  const r = `${Math.max(60, stepSec * 2)}s`
  const s = `${stepSec}s`
  const t: number[] = []
  for (let x = start; x <= end; x += stepSec) t.push(x * 1000)

  const names = Object.keys(QUERIES)
  const [ranges, up, now5m, pingRange, pingNow] = await Promise.all([
    Promise.all(names.map((n) =>
      prom('query_range', { query: QUERIES[n](r, s), start: String(start), end: String(end), step: String(stepSec) }),
    )),
    prom('query', { query: `max(up{${SOCKET}})` }).catch(() => null),
    Promise.all([
      ...CURRENT.map((n) => QUERIES[n]('5m', '5m')),
      ...Object.values(INSTANT),
    ].map((query) => prom('query', { query }).catch(() => null))),
    prom('query_range', { query: ping(`${Math.max(600, stepSec)}s`), start: String(start), end: String(end), step: String(stepSec) }).catch(() => null),
    prom('query', { query: ping('1h') }).catch(() => null),
  ])
  const current: Record<string, number | null> = {}
  ;[...CURRENT, ...Object.keys(INSTANT)].forEach((n, i) => {
    const v = Number(now5m[i]?.result[0]?.value?.[1])
    current[n] = Number.isFinite(v) ? round(v) : null
  })

  const series: Series = {}
  names.forEach((n, i) => {
    const out: (number | null)[] = t.map(() => null)
    for (const [ts, v] of ranges[i].result[0]?.values ?? []) {
      const idx = Math.round((ts - start) / stepSec)
      const num = Number(v)
      if (idx >= 0 && idx < out.length && Number.isFinite(num)) out[idx] = round(num)
    }
    series[n] = out
  })

  const cities = (pingNow?.result ?? [])
    .map((r) => {
      const name = r.metric.probe
      const out: (number | null)[] = t.map(() => null)
      for (const [ts, v] of pingRange?.result.find((x) => x.metric.probe === name)?.values ?? []) {
        const idx = Math.round((ts - start) / stepSec)
        if (idx >= 0 && idx < out.length && Number.isFinite(Number(v))) out[idx] = round(Number(v))
      }
      const ms = Number(r.value?.[1])
      return { name, ms: Number.isFinite(ms) ? round(ms) : null, series: out }
    })
    .sort((a, b) => (a.ms ?? Infinity) - (b.ms ?? Infinity))

  const upVal = up?.result?.[0]?.value?.[1]
  return { minutes, stepSec, now: Date.now(), socketUp: upVal == null ? null : upVal === '1', current, cities, t, series }
}

const load = cached(CACHE_MS, build)

export async function GET(req: Request) {
  const minutes = Number(new URL(req.url).searchParams.get('minutes'))
  if (!WINDOWS.has(minutes)) return Response.json({ error: 'minutes must be 30, 60, 180, 1440 or 10080' }, { status: 400 })
  try {
    const { value, stale } = await load(minutes)
    return Response.json(stale ? { ...value, stale } : value, { headers: { 'Cache-Control': 'public, max-age=15' } })
  } catch (err) {
    console.error('[server-metrics]', err instanceof Error ? err.message : err)
    return Response.json({ error: 'metrics unavailable' }, { status: 503 })
  }
}

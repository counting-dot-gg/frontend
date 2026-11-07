import { HISTORY_UID, cached, grafana } from '@/lib/grafanaServer'

const FOLDER_UID = 'cgg-status'
const DAYS = 14
const MAX = 30

interface Incident {
  title: string
  summary: string | null
  where: string | null
  start: number
  end: number | null
}

interface RulesResponse {
  data: {
    groups: {
      folderUid: string
      rules: { uid: string; name: string; isPaused: boolean; labels?: Record<string, string>; annotations?: Record<string, string> }[]
    }[]
  }
}

interface HistoryLine {
  current: string
  ruleUID: string
  ruleTitle: string
  fingerprint: string
  labels: Record<string, string>
}

interface LokiResponse {
  data: { result: { values: [string, string][] }[] }
}

const PLACES: Record<string, string> = { '/': 'system disk', '/mnt/mysql_data': 'database disk' }

async function build(): Promise<{ incidents: Incident[] }> {
  const [rules, history] = await Promise.all([
    grafana<RulesResponse>('/api/prometheus/grafana/api/v1/rules'),
    grafana<LokiResponse>(`/api/datasources/proxy/uid/${HISTORY_UID}/loki/api/v1/query_range`, {
      query: `{from="state-history", folderUID="${FOLDER_UID}"}`,
      start: String((Date.now() - DAYS * 86_400_000) * 1e6),
      end: String(Date.now() * 1e6),
      direction: 'forward',
      limit: '5000',
    }),
  ])

  const publicRules = new Map<string, { title: string; summary: string | null }>()
  for (const g of rules.data.groups) {
    if (g.folderUid !== FOLDER_UID) continue
    for (const r of g.rules) {
      if (r.labels?.public === 'true') publicRules.set(r.uid, { title: r.name, summary: r.annotations?.summary ?? null })
    }
  }

  const lines: (HistoryLine & { t: number })[] = []
  for (const stream of history.data.result) {
    for (const [ns, line] of stream.values) {
      try {
        const h = JSON.parse(line) as HistoryLine
        if (publicRules.has(h.ruleUID)) lines.push({ ...h, t: Math.round(Number(ns) / 1e6) })
      } catch {}
    }
  }
  lines.sort((a, b) => a.t - b.t)

  const open = new Map<string, Incident>()
  const incidents: Incident[] = []
  for (const h of lines) {
    const key = `${h.ruleUID}/${h.fingerprint}`
    if (h.current.startsWith('Alerting') && !open.has(key)) {
      const rule = publicRules.get(h.ruleUID)!
      const mount = h.labels.mountpoint
      const inc: Incident = {
        title: rule.title,
        summary: rule.summary && !rule.summary.includes('{{') ? rule.summary : null,
        where: mount ? (PLACES[mount] ?? mount) : null,
        start: h.t,
        end: null,
      }
      open.set(key, inc)
      incidents.push(inc)
    } else if (h.current.startsWith('Normal') && open.has(key)) {
      open.get(key)!.end = h.t
      open.delete(key)
    }
  }

  return { incidents: incidents.sort((a, b) => b.start - a.start).slice(0, MAX) }
}

const load = cached(60_000, build)

export async function GET() {
  try {
    const { value, stale } = await load(0)
    return Response.json({ ...value, days: DAYS, stale }, { headers: { 'Cache-Control': 'public, max-age=30' } })
  } catch (err) {
    console.error('[status-incidents]', err instanceof Error ? err.message : err)
    return Response.json({ error: 'incidents unavailable' }, { status: 503 })
  }
}

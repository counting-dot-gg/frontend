import { cached, grafana } from '@/lib/grafanaServer'
import type { Severity, SiteStatus } from '@/lib/siteStatus'

const FOLDER_UID = 'cgg-status'
const FIRING = new Set(['firing', 'alerting'])

interface RulesResponse {
  data: {
    groups: {
      folderUid: string
      rules: {
        name: string
        state: string
        isPaused?: boolean
        labels?: Record<string, string>
        alerts?: { state: string; activeAt?: string }[]
      }[]
    }[]
  }
}

function severityOf(labels: Record<string, string> | undefined): Severity {
  return labels?.severity === 'major' ? 'major' : 'minor'
}

function since(alerts: { state: string; activeAt?: string }[] | undefined): number | null {
  const starts = (alerts ?? [])
    .filter(a => FIRING.has(a.state.toLowerCase()) && a.activeAt)
    .map(a => Date.parse(a.activeAt!))
    .filter(Number.isFinite)
  return starts.length ? Math.min(...starts) : null
}

async function build(): Promise<SiteStatus> {
  const rules = await grafana<RulesResponse>('/api/prometheus/grafana/api/v1/rules')
  const firing: SiteStatus['firing'] = []
  for (const g of rules.data.groups) {
    if (g.folderUid !== FOLDER_UID) continue
    for (const r of g.rules) {
      if (r.isPaused || r.labels?.public !== 'true' || !FIRING.has(r.state.toLowerCase())) continue
      firing.push({ title: r.name, severity: severityOf(r.labels), since: since(r.alerts) })
    }
  }
  firing.sort((a, b) => Number(b.severity === 'major') - Number(a.severity === 'major') || (a.since ?? 0) - (b.since ?? 0))
  const level = firing.some(f => f.severity === 'major') ? 'major' : firing.length ? 'minor' : 'ok'
  return { level, firing }
}

const load = cached(30_000, build)

export async function GET() {
  try {
    const { value } = await load(0)
    return Response.json(value, { headers: { 'Cache-Control': 'public, max-age=30' } })
  } catch (err) {
    console.error('[status-summary]', err instanceof Error ? err.message : err)
    return Response.json({ level: 'unknown', firing: [] } satisfies SiteStatus, { status: 503 })
  }
}

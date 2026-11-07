import type {
  MacroPreset,
  MacroPresetVersion,
  ThreadUsageRow,
} from './MacroPresetViewClient'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

async function json<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 30 } })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function loadPreset(rawRef: string): Promise<MacroPreset | null> {
  const trimmed = decodeURIComponent(rawRef).trim()
  if (!trimmed) return null
  const data = await json<{ preset: MacroPreset }>(
    /^\d+$/.test(trimmed)
      ? `${API}/api/macro-presets/${trimmed}`
      : `${API}/api/macro-presets/handle/${encodeURIComponent(trimmed.toLowerCase())}`,
  )
  return data?.preset ?? null
}

export interface PresetView {
  preset: MacroPreset
  versions: MacroPresetVersion[]
  selectedVersion: MacroPresetVersion | null
  threadUsage: ThreadUsageRow[]
}

export async function loadPresetView(rawRef: string, rawVersion?: string): Promise<PresetView | null> {
  const preset = await loadPreset(rawRef)
  if (!preset) return null

  const versions = (await json<MacroPresetVersion[]>(`${API}/api/macro-presets/${preset.id}/versions`)) ?? []

  const requested = rawVersion ? parseInt(decodeURIComponent(rawVersion), 10) : NaN
  const selectedNumber = Number.isFinite(requested) ? requested : versions[0]?.versionNumber

  const [selectedVersion, usage] = await Promise.all([
    selectedNumber != null
      ? json<MacroPresetVersion>(`${API}/api/macro-presets/${preset.id}/versions/${selectedNumber}`)
      : Promise.resolve(null),
    json<{ items: ThreadUsageRow[] }>(`${API}/api/macro-presets/${preset.id}/thread-usage?limit=10`),
  ])

  if (rawVersion && !selectedVersion) return null

  return { preset, versions, selectedVersion, threadUsage: usage?.items ?? [] }
}

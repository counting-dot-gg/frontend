import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MacroPresetViewClient from '../MacroPresetViewClient'
import { loadPreset, loadPresetView } from '../presetData'

export async function generateMetadata({ params }: {
  params: Promise<{ ref: string; version: string }>
}): Promise<Metadata> {
  const { ref, version } = await params
  const preset = await loadPreset(ref)
  if (!preset) return { title: 'Macro preset not found | counting.gg' }
  return {
    title: `${preset.name} v${version} | Macro presets | counting.gg`,
    description: preset.description || undefined,
  }
}

export default async function MacroPresetVersionPage({ params }: {
  params: Promise<{ ref: string; version: string }>
}) {
  const { ref, version } = await params
  const view = await loadPresetView(ref, version)
  if (!view) notFound()
  return <MacroPresetViewClient {...view} />
}

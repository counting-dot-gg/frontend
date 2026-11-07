import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import MacroPresetViewClient from './MacroPresetViewClient'
import { loadPreset, loadPresetView } from './presetData'

export async function generateMetadata({ params }: {
  params: Promise<{ ref: string }>
}): Promise<Metadata> {
  const { ref } = await params
  const preset = await loadPreset(ref)
  if (!preset) return { title: 'Macro preset not found | counting.gg' }
  return {
    title: `${preset.name} | Macro presets | counting.gg`,
    description: preset.description || undefined,
  }
}

export default async function MacroPresetPage({ params }: {
  params: Promise<{ ref: string }>
}) {
  const { ref } = await params
  const view = await loadPresetView(ref)
  if (!view) notFound()
  return <MacroPresetViewClient {...view} />
}

'use client'

import Link from 'next/link'
import { avatarUrl } from '@/lib/counterUtils'
import { triggerLabel } from '@/lib/macroUtils'

interface OwnerCounter {
  uuid: string
  username: string
  name: string
  color?: string
  discordId?: string
  avatar?: string
}

export interface MacroPreset {
  id: number
  name: string
  handle: string
  description?: string | null
  visibility: string
  createdAt: string
  updatedAt: string
  ownerCounter?: OwnerCounter
}

export interface MacroEntry {
  id: number
  triggerKey: string
  macroType: string
  payloadJson: Record<string, any> | null
}

export interface MacroPresetVersion {
  id: number
  versionNumber: number
  changeNote?: string | null
  createdAt: string
  entries?: MacroEntry[]
  createdByCounter?: OwnerCounter
}

export interface ThreadUsageRow {
  threadId: string
  threadName: string
  threadTitle: string
  appliesCount: number
  lastAppliedAt: string | null
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : d.toISOString().slice(0, 10)
}

function describePayload(macroType: string, payload: Record<string, any> | null): string {
  if (!payload) return macroType
  const { action, repeat, text, value } = payload
  const parts: string[] = []
  if (typeof action === 'string') parts.push(action)
  if (typeof text === 'string') parts.push(JSON.stringify(text))
  if (typeof value === 'string' || typeof value === 'number') parts.push(String(value))
  if (parts.length === 0) return JSON.stringify(payload)
  if (typeof repeat === 'number' && repeat > 1) parts.push(`×${repeat}`)
  return parts.join(' ')
}

export default function MacroPresetViewClient({ preset, versions, selectedVersion, threadUsage }: {
  preset: MacroPreset
  versions: MacroPresetVersion[]
  selectedVersion: MacroPresetVersion | null
  threadUsage: ThreadUsageRow[]
}) {
  const owner = preset.ownerCounter
  const entries = selectedVersion?.entries ?? []
  const isLatest = selectedVersion?.versionNumber === versions[0]?.versionNumber

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/macros" className="text-xs font-semibold text-primary hover:underline underline-offset-4">
          ← Macro presets
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{preset.name}</h1>
          {preset.visibility !== 'PUBLIC' && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {preset.visibility.toLowerCase()}
            </span>
          )}
        </div>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">/{preset.handle}</p>

        {preset.description && (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{preset.description}</p>
        )}

        {owner && (
          <div className="mt-4 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={owner.discordId && owner.avatar ? avatarUrl({ discordId: owner.discordId, avatar: owner.avatar }) : undefined}
              alt=""
              className="size-7 rounded-full bg-muted object-cover"
            />
            <Link
              href={`/counter/${encodeURIComponent(owner.username)}`}
              className="text-sm font-medium hover:underline underline-offset-4"
              style={{ color: owner.color || undefined }}
            >
              {owner.name || owner.username}
            </Link>
            <span className="text-xs text-muted-foreground">· updated {fmtDate(preset.updatedAt)}</span>
          </div>
        )}

        {versions.length > 0 && (
          <>
            <h2 className="mt-8 mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Version
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {versions.map(v => {
                const active = v.versionNumber === selectedVersion?.versionNumber
                return (
                  <Link
                    key={v.id}
                    href={`/macros/${encodeURIComponent(preset.handle)}/${v.versionNumber}`}
                    className={
                      'rounded-full border px-3 py-1 text-xs font-semibold transition-colors ' +
                      (active ? 'border-primary bg-primary text-white' : 'border-border hover:bg-muted')
                    }
                  >
                    v{v.versionNumber}
                  </Link>
                )
              })}
            </div>
            {selectedVersion && (
              <p className="mt-2 text-xs text-muted-foreground">
                v{selectedVersion.versionNumber} · {fmtDate(selectedVersion.createdAt)}
                {isLatest ? ' · latest' : ''}
                {selectedVersion.changeNote ? ` · ${selectedVersion.changeNote}` : ''}
              </p>
            )}
          </>
        )}

        <h2 className="mt-8 mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Macros{entries.length > 0 ? ` (${entries.length})` : ''}
        </h2>
        {entries.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            This version has no macro entries.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">Key</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} className="border-b border-border/60 last:border-b-0">
                    <td className="px-3 py-2">
                      <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {e.triggerKey === ' ' ? 'Space' : triggerLabel(e.triggerKey)}
                      </kbd>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{e.macroType}</td>
                    <td className="px-3 py-2 font-mono text-xs">{describePayload(e.macroType, e.payloadJson)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {threadUsage.length > 0 && (
          <>
            <h2 className="mt-8 mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Used in
            </h2>
            <ul className="space-y-1.5">
              {threadUsage.map(t => (
                <li
                  key={t.threadId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
                >
                  <Link
                    href={`/thread/${encodeURIComponent(t.threadName)}`}
                    className="text-sm font-medium hover:underline underline-offset-4"
                  >
                    {t.threadTitle || t.threadName}
                  </Link>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t.appliesCount} {t.appliesCount === 1 ? 'apply' : 'applies'}
                    {t.lastAppliedAt ? ` · last ${fmtDate(t.lastAppliedAt)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  )
}

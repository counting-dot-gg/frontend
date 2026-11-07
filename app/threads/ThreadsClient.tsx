'use client'

import { useState } from 'react'
import Link from 'next/link'

export interface ThreadCardData {
  id?: number
  uuid: string
  name: string
  title?: string
  shortDescription?: string
  category?: string
  locked?: boolean
  color1?: string
  color2?: string
}

function ThreadCard({ t }: { t: ThreadCardData }) {
  const c1 = t.color1?.trim() || '#3b82f6'
  const c2 = t.color2?.trim() || c1

  return (
    <Link
      href={`/thread/${encodeURIComponent(t.name)}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
    >
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(to right, ${c1}, ${c2})` }} />
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-sm font-bold leading-snug">{t.title || t.name}</h3>
        {t.shortDescription && (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-3">
            {t.shortDescription}
          </p>
        )}
        <span className="mt-auto pt-3 font-mono text-[11px] text-muted-foreground">
          /{t.name}
        </span>
      </div>
    </Link>
  )
}

export default function ThreadsClient({ grouped, categories, total }: {
  grouped: Record<string, ThreadCardData[]>
  categories: string[]
  total: number
}) {
  const [active, setActive] = useState(categories[0] ?? '')

  if (total === 0) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Threads</h1>
          <p className="text-sm text-muted-foreground">
            No threads found: the API didn&apos;t return anything. Try reloading.
          </p>
        </div>
      </main>
    )
  }

  const shown = grouped[active] ?? []

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Threads</h1>
        <p className="text-sm text-muted-foreground mb-6">
        </p>

        <div
          role="tablist"
          aria-label="Thread categories"
          className="mb-6 flex gap-1 overflow-x-auto border-b border-border pb-px"
        >
          {categories.map((cat) => {
            const isActive = cat === active
            return (
              <button
                key={cat}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(cat)}
                className={
                  'shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2 text-sm font-semibold transition-colors ' +
                  (isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground')
                }
              >
                {cat}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {grouped[cat].length}
                </span>
              </button>
            )
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => (
            <ThreadCard key={t.uuid || t.name} t={t} />
          ))}
        </div>
      </div>
    </main>
  )
}

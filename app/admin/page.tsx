import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/adminGuard'

export const metadata: Metadata = {
  title: 'Admin | counting.gg',
}

const SECTIONS: { href: string; title: string; blurb: string; ready: boolean }[] = [
  { href: '/admin/approve', title: 'Approve users', blurb: 'Review pending registrations: approve, verify, or deny.', ready: true },
  { href: '/admin/counters', title: 'Counters', blurb: 'Edit any account: profile, roles, XP, money, cosmetics.', ready: true },
  { href: '/admin/threads', title: 'Threads', blurb: 'Create threads and edit their rules and settings.', ready: true },
  { href: '/admin/system_message', title: 'Send system message', blurb: 'Broadcast a message to every thread.', ready: true },
  { href: '/admin/features', title: 'Experimental features', blurb: 'Turn features on or off for everyone, without a deploy. Admins keep access either way.', ready: true },
  { href: '/admin/achievements', title: 'Award achievements', blurb: 'Grant an achievement to a counter.', ready: true },
  { href: '/admin/new_item', title: 'New item', blurb: 'Add an item to the shop.', ready: true },
  { href: '/admin/stats', title: 'Stats', blurb: 'Regenerate stats: one day, one counter, missing days, or everything. Replaces the STAT_INIT env vars.', ready: true },
  { href: '/admin/discord_roles', title: 'Discord roles', blurb: 'Backfill level and rank roles in the main server.', ready: true },
  { href: '/rank/admin', title: 'Rank admin', blurb: 'Season and rank administration.', ready: true },
]

export default async function AdminPage() {
  await requireAdmin()

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Admin</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Site administration. Every action here is also enforced server-side.
        </p>

        <div className="grid gap-3">
          {SECTIONS.map(({ href, title, blurb, ready }) =>
            ready ? (
              <Link
                key={href}
                href={href}
                className="group rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{title}</span>
                  <span className="text-muted-foreground transition-transform group-hover:translate-x-0.5">→</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{blurb}</p>
              </Link>
            ) : (
              <div
                key={href}
                className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-3.5 opacity-60"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{title}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    not ported
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{blurb}</p>
              </div>
            ),
          )}
        </div>
      </div>
    </main>
  )
}

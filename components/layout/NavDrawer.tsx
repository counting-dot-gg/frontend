'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  Hash, Home, BookOpen, BarChart2, Users, Trophy, Tag, ShoppingBag,
  Gavel, Search, Smile, ShieldCheck, Shuffle, Type, Gift, MessageSquare, Clock, Activity,
} from 'lucide-react'
import { LEVEL_COLOR, useSiteStatus } from '@/lib/siteStatus'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '/',             label: 'Home',         icon: Home },
  { href: '/threads',      label: 'Threads',      icon: Hash },
  { href: '/stats',        label: 'Stats',        icon: BarChart2 },
  { href: '/counters',     label: 'Counters',     icon: Users },
  { href: '/achievements', label: 'Achievements', icon: Trophy },
  { href: '/rank',         label: 'Rank',         icon: Tag },
  { href: '/shop',         label: 'Shop',         icon: ShoppingBag },
  { href: '/post-finder',  label: 'Post Finder',  icon: Search },
  { href: '/uuid',         label: 'UUID to Time', icon: Clock },
  { href: '/emotes',       label: 'Emotes',       icon: Smile },
  { href: '/shuffle',      label: 'Number Shuffle', icon: Shuffle },
  { href: '/lrwoed',       label: 'lrwoed',       icon: Type },
  { href: '/rewards',      label: 'XP Rewards',   icon: Gift },
  { href: '/rules',        label: 'Rules',        icon: Gavel },
  { href: '/about',        label: 'About',        icon: BookOpen },
  { href: '/feedback',     label: 'Feedback',     icon: MessageSquare },
]

export interface NavDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: { counter?: { roles?: string[] } } | null
}

export default function NavDrawer({ open, onOpenChange, user }: NavDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="px-4 py-4 border-b border-border/60">
          <SheetTitle className="text-left">
            <Image src="/logo/cgg-128.png" alt="counting.gg" width={228} height={128} className="h-6 w-auto" />
          </SheetTitle>
          <BuildStamp />
        </SheetHeader>
        <nav className="flex flex-col py-2">
          {navLinks.filter(l => !('adminOnly' in l) || user?.counter?.roles?.includes('admin')).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => onOpenChange(false)}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-muted-foreground',
                'hover:text-foreground hover:bg-muted/50 transition-colors',
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          ))}

          <div className="mx-4 my-2 border-t border-border/60" />
          <StatusLink onNavigate={() => onOpenChange(false)} />

          {user?.counter?.roles?.includes('admin') && (
            <>
              <div className="mx-4 my-2 border-t border-border/60" />
              <Link
                href="/admin"
                onClick={() => onOpenChange(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-muted-foreground',
                  'hover:text-foreground hover:bg-muted/50 transition-colors',
                )}
              >
                <ShieldCheck className="size-4 shrink-0" />
                Admin
              </Link>
            </>
          )}
        </nav>
        {!user && (
          <div className="absolute bottom-4 left-4 right-4">
            <Button asChild className="w-full" size="sm">
              <a href={process.env.NEXT_PUBLIC_LOGIN ?? '/api/auth/login'}>Login with Discord</a>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function StatusLink({ onNavigate }: { onNavigate: () => void }) {
  const { level, firing } = useSiteStatus()
  return (
    <Link
      href="/status"
      onClick={onNavigate}
      className="flex flex-col gap-1 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
    >
      <span className="flex items-center gap-3">
        <Activity className="size-4 shrink-0" style={{ color: LEVEL_COLOR[level] }} />
        Status
      </span>
      {firing.map(f => (
        <span key={f.title} className="flex items-center gap-2 pl-7 text-xs">
          <span className="size-1.5 shrink-0 rounded-full" style={{ background: LEVEL_COLOR[f.severity] }} />
          <span className="min-w-0 flex-1 truncate text-foreground">{f.title}</span>
          {f.since !== null && <span className="tabular-nums" suppressHydrationWarning>{elapsed(f.since)}</span>}
        </span>
      ))}
    </Link>
  )
}

function elapsed(since: number): string {
  const mins = Math.max(0, Math.round((Date.now() - since) / 60000))
  return mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`
}

function BuildStamp() {
  const built = process.env.NEXT_PUBLIC_BUILD_TIME
  if (!built) return null
  const at = new Date(built)
  const mins = Math.max(0, Math.round((Date.now() - at.getTime()) / 60000))
  const ago = mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.round(mins / 60)}h ago` : `${Math.round(mins / 1440)}d ago`
  const slot = (process.env.NEXT_PUBLIC_BUILD_SLOT || '').replace(/^\./, '')
  return (
    <p className="text-left text-[11px] text-muted-foreground tabular-nums" suppressHydrationWarning>
      built {at.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {ago}{slot ? ` · ${slot}` : ''}
    </p>
  )
}

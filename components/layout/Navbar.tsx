'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useState, useEffect, useSyncExternalStore } from 'react'
import { Menu, Hash, LogIn, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { cn } from '@/lib/utils'
import { subscribeChatPanel, readChatPanel, readChatPanelServer, requestOpenChat } from '@/lib/chatPanel'
import type { MiscSettings } from '@/lib/types'
import { useThreadColors } from '@/app/providers'

const NavDrawer = dynamic(() => import('./NavDrawer'), { ssr: false })
const NavUserMenu = dynamic(() => import('./NavUserMenu'))
const ThreadPicker = dynamic(() => import('@/components/thread/ThreadPicker'), { ssr: false })

interface NavbarProps {
  user?: { username?: string; counter?: { avatarUrl?: string; username?: string; emoji?: string; roles?: string[] }; unreadMentionCount?: number } | null
  miscSettings?: MiscSettings | null
}

export function Navbar({ user, miscSettings }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [panelsMounted, setPanelsMounted] = useState(false)
  const pathname = usePathname()
  const { color1, color2 } = useThreadColors()

  useEffect(() => {
    if (panelsMounted) return
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    }).requestIdleCallback
    if (typeof ric === 'function') {
      const id = ric(() => setPanelsMounted(true), { timeout: 3000 })
      const cancel = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback
      return () => { if (typeof cancel === 'function') cancel(id) }
    }
    const t = setTimeout(() => setPanelsMounted(true), 1500)
    return () => clearTimeout(t)
  }, [panelsMounted])

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } finally {
      window.location.assign('/')
    }
  }

  const headerStyle = color1 && color2
    ? { background: `linear-gradient(to right, ${color1}, ${color2})` }
    : undefined

  return (
    <>
      <ThreadPicker open={pickerOpen} onClose={() => setPickerOpen(false)} initialMiscSettings={miscSettings ?? undefined} username={user?.counter?.username ?? user?.username} />

      <header
        className={cn(
          'sticky top-0 z-50 w-full overflow-x-clip border-b border-border/60 backdrop-blur-md',
          !headerStyle && 'bg-primary',
        )}
        style={headerStyle}
      >
        <div className="navbar-row relative flex h-16 items-center px-3 gap-2 text-white">

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 relative size-11 text-white hover:bg-white/15 hover:text-white"
            onClick={() => { setPanelsMounted(true); setMenuOpen(true) }}
            aria-label="Open menu"
          >
            <Menu className="size-[26px]" />
            {!!user?.unreadMentionCount && (
              <span className="absolute top-1 right-1 size-2 rounded-full bg-destructive" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 size-11 text-white hover:bg-white/15 hover:text-white"
            onClick={() => { setPanelsMounted(true); setPickerOpen(v => !v) }}
            aria-label="Thread picker"
            data-thread-picker
          >
            <Hash className="size-[26px]" />
          </Button>

          <div className="flex-1 min-w-0" />

          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ pointerEvents: 'none' }}
          >
            <Link
              href="/"
              onClick={(e) => { if (pathname === '/') e.preventDefault() }}
              className="hover:opacity-80 transition-opacity"
              style={{ pointerEvents: 'auto' }}
            >
              <Image
                src="/logo/cgg-128.png"
                alt="counting.gg"
                width={228}
                height={128}
                className="navbar-logo h-10 w-auto max-w-full"
                priority
              />
            </Link>
          </div>

          <ChatOpener />

          <div className="shrink-0">
            {user ? (
              <NavUserMenu user={user} onLogout={logout} />
            ) : (
              <Button variant="ghost" size="sm" asChild className="text-white hover:bg-white/15 hover:text-white">
                <a href={process.env.NEXT_PUBLIC_LOGIN ?? '/api/auth/login'} className="flex items-center gap-1.5">
                  <LogIn className="size-5" />
                  <span className="text-sm font-medium">Login</span>
                </a>
              </Button>
            )}
          </div>
        </div>
      </header>

      {panelsMounted && (
        <NavDrawer open={menuOpen} onOpenChange={setMenuOpen} user={user} />
      )}
    </>
  )
}

function ChatOpener() {
  const panel = useSyncExternalStore(subscribeChatPanel, readChatPanel, readChatPanelServer)
  if (!panel.hidden) return null
  return (
    <Button
      variant="ghost"
      size="icon"
      className="shrink-0 relative size-11 text-white hover:bg-white/15 hover:text-white"
      onClick={() => requestOpenChat()}
      aria-label={panel.unread > 0 ? `Open chat, ${panel.unread} unread` : 'Open chat'}
    >
      <MessageSquare className="size-[26px]" />
      {panel.unread > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-lg bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
          {panel.unread > 50 ? '50+' : panel.unread}
        </span>
      )}
    </Button>
  )
}

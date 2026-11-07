'use client'

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import { getSocket } from '@/lib/socket'
import { appendCachedPost } from '@/lib/threadPostCache'
import { avatarUrl as counterAvatarUrl } from '@/lib/counterUtils'
import { registerEmotes, type EmoteEntry } from '@/lib/emotes'
import { Toaster } from '@/lib/toast'
import { installRateLimitNotice } from '@/lib/rateLimitNotice'
import type { PostRow } from '@/components/thread/ThreadView'

let emotesRegistered = false

interface ThreadColors {
  color1: string | null
  color2: string | null
}

interface ThreadColorContextValue extends ThreadColors {
  setThreadColors: (colors: ThreadColors | null) => void
}

const ThreadColorContext = createContext<ThreadColorContextValue | null>(null)

export function useThreadColors() {
  const ctx = useContext(ThreadColorContext)
  if (!ctx) throw new Error('useThreadColors must be used within Providers')
  return ctx
}

interface ThreadNavContextValue {
  isThreadViewMounted: boolean
  setThreadViewMounted: (mounted: boolean) => void
  pendingNav: string | null
  requestThreadNav: (threadName: string) => void
  consumeThreadNav: () => void
}

const ThreadNavContext = createContext<ThreadNavContextValue | null>(null)

export function useThreadNav() {
  const ctx = useContext(ThreadNavContext)
  if (!ctx) throw new Error('useThreadNav must be used within Providers')
  return ctx
}

function useBackgroundPostCache() {
  useEffect(() => {
    const socket = getSocket()
    const onPost = (data: { post: any; counter: any }) => {
      const { post: p, counter: c } = data
      if (!p?.thread) return
      const row: PostRow = {
        uuid: p.uuid,
        rawText: p.rawText,
        countContent: p.countContent,
        rawCount: p.rawCount,
        comment: p.comment,
        isValidCount: p.isValidCount,
        stricken: p.stricken,
        timestamp: p.timestamp,
        timeSinceLastPost: p.timeSinceLastPost,
        authorUUID: p.authorUUID,
        authorUsername: c?.username ?? 'unknown',
        authorName: c?.name ?? c?.username ?? 'unknown',
        authorColor: c?.color ?? '#888888',
        authorEmoji: c?.emoji,
        authorAvatarUrl: c ? counterAvatarUrl({ discordId: c.discordId, avatar: c.avatar }) : undefined,
        reactions: p.reactions ?? undefined,
      }
      appendCachedPost(p.thread, row)
    }
    socket.on('post', onPost)
    return () => { socket.off('post', onPost) }
  }, [])
}

export function Providers({ children, initialColors, initialEmotes }: {
  children: React.ReactNode
  initialColors?: ThreadColors
  initialEmotes?: EmoteEntry[]
}) {
  if (initialEmotes && initialEmotes.length > 0 && !emotesRegistered) {
    emotesRegistered = true
    registerEmotes(initialEmotes)
  }

  const [colors, setColors] = useState<ThreadColors>(initialColors ?? { color1: null, color2: null })

  const setThreadColors = useCallback((next: ThreadColors | null) => {
    setColors(next ?? { color1: null, color2: null })
  }, [])

  const colorValue = useMemo(
    () => ({ ...colors, setThreadColors }),
    [colors, setThreadColors],
  )

  const [isThreadViewMounted, setThreadViewMounted] = useState(false)
  const [pendingNav, setPendingNav] = useState<string | null>(null)

  const requestThreadNav = useCallback((threadName: string) => {
    setPendingNav(threadName)
  }, [])
  const consumeThreadNav = useCallback(() => {
    setPendingNav(null)
  }, [])

  const navValue = useMemo(
    () => ({ isThreadViewMounted, setThreadViewMounted, pendingNav, requestThreadNav, consumeThreadNav }),
    [isThreadViewMounted, pendingNav, requestThreadNav, consumeThreadNav],
  )

  useBackgroundPostCache()

  useEffect(() => { installRateLimitNotice() }, [])

  return (
    <ThreadColorContext.Provider value={colorValue}>
      <ThreadNavContext.Provider value={navValue}>
        {children}
        <Toaster />
      </ThreadNavContext.Provider>
    </ThreadColorContext.Provider>
  )
}

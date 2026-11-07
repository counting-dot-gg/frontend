'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { subscribeChatPanel, readOpenNonce } from '@/lib/chatPanel'
import type { SessionUser } from '@/lib/types'

const SiteChat = dynamic(() => import('./SiteChat'), { ssr: false })

export default function SiteChatMount({ user }: { user?: SessionUser | null }) {
  const visibleByDefault = (user?.userPrefs?.pref_chat_default ?? 'Hidden') !== 'Hidden'

  const [mounted, setMounted] = useState(false)
  const [openOnMount, setOpenOnMount] = useState(false)

  useEffect(() => {
    let seen = readOpenNonce()
    return subscribeChatPanel(() => {
      const n = readOpenNonce()
      if (n === seen) return
      seen = n
      setOpenOnMount(true)
      setMounted(true)
    })
  }, [])

  useEffect(() => {
    if (mounted) return
    if (visibleByDefault) { setMounted(true); return }

    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    }).requestIdleCallback

    if (typeof ric === 'function') {
      const id = ric(() => setMounted(true), { timeout: 3000 })
      const cancel = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback
      return () => { if (typeof cancel === 'function') cancel(id) }
    }
    const t = setTimeout(() => setMounted(true), 1500)
    return () => clearTimeout(t)
  }, [mounted, visibleByDefault])

  if (!mounted) return null
  return <SiteChat user={user} initialOpen={openOnMount} />
}

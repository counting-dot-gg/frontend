'use client'

import { useEffect, useRef } from 'react'
import { getSocket } from '@/lib/socket'
import { notify } from '@/lib/toast'
import { confettiBurst } from '@/lib/confetti'

export default function RewardNotifications({ username }: { username?: string | null }) {
  const seenVersionRef = useRef<string | null>(null)

  useEffect(() => {
    const socket = getSocket()

    const onAchievement = (a: { name?: string; description?: string }) => {
      notify(`Achievement unlocked: ${a?.name ?? '???'}`, {
        kind: 'success',
        icon: '🏆',
        detail: a?.description,
        ttl: 8000,
        href: username ? `/counter/${username}` : '/achievements',
      })
      confettiBurst()
    }

    const onItem = (data: { item?: { name?: string; category?: string } }) => {
      const item = data?.item
      notify(`New ${item?.category ?? 'item'} unlocked: ${item?.name ?? '???'}`, {
        kind: 'success',
        icon: '🎁',
        detail: 'Equip it in your preferences.',
        ttl: 8000,
        href: '/prefs',
      })
      confettiBurst()
    }

    const onNewInventory = (data: { newItem?: any; teamUnlock?: boolean; unlocker?: { name?: string } }) => {
      const name = data?.newItem?.name ?? data?.newItem?.item?.name ?? 'something'
      notify(
        data?.teamUnlock
          ? `${data?.unlocker?.name ?? 'A teammate'} unlocked ${name} for the team`
          : `You found ${name}`,
        { kind: 'success', icon: '📦', ttl: 7000, href: '/inventory' },
      )
    }

    const onPopupMessage = (message: unknown) => {
      if (typeof message !== 'string' || !message) return
      notify(message, { kind: 'error', ttl: 7000 })
    }

    const onForcePageNav = (data: { forcePageNav?: string }) => {
      if (data?.forcePageNav) window.location.href = data.forcePageNav
    }

    const onSiteVersion = (version: unknown) => {
      if (typeof version !== 'string' || !version) return
      if (seenVersionRef.current === null) {
        seenVersionRef.current = version
        return
      }
      if (seenVersionRef.current === version) return
      seenVersionRef.current = version
      notify('counting.gg was updated', {
        kind: 'info',
        icon: '🔄',
        detail: 'Refresh to pick up the new version.',
        ttl: 0,
      })
    }

    socket.on('achievement', onAchievement)
    socket.on('item', onItem)
    socket.on('new_inventory', onNewInventory)
    socket.on('popupMessage', onPopupMessage)
    socket.on('forcePageNav', onForcePageNav)
    socket.on('site_version', onSiteVersion)

    return () => {
      socket.off('achievement', onAchievement)
      socket.off('item', onItem)
      socket.off('new_inventory', onNewInventory)
      socket.off('popupMessage', onPopupMessage)
      socket.off('forcePageNav', onForcePageNav)
      socket.off('site_version', onSiteVersion)
    }
  }, [username])

  return null
}

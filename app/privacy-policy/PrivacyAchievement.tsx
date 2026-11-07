'use client'

import { useEffect } from 'react'
import { getSocket } from '@/lib/socket'

export default function PrivacyAchievement() {
  useEffect(() => {
    const socket = getSocket()
    if (socket.connected) {
      socket.emit('privacyPolicy')
      return
    }
    socket.once('connect', () => socket.emit('privacyPolicy'))
  }, [])

  return null
}

'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { getSocket } from '@/lib/socket'
import { ClientHealth } from '@/lib/clientHealth'

export default function ClientHealthBeacon() {
  const path = usePathname()
  const pathRef = useRef(path)
  pathRef.current = path
  useEffect(() => {
    const h = new ClientHealth(getSocket(), () => pathRef.current ?? '/')
    h.start()
    return () => h.stop()
  }, [])
  return null
}

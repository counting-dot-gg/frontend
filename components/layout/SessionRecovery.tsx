'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { API } from '@/lib/apiBase'

export default function SessionRecovery({ isLoggedIn }: { isLoggedIn: boolean }) {
  const router = useRouter()
  const attempted = useRef(false)

  useEffect(() => {
    if (isLoggedIn || attempted.current) return
    attempted.current = true

    try {
      if (sessionStorage.getItem('cgg_session_recovery') === 'done') return
      sessionStorage.setItem('cgg_session_recovery', 'done')
    } catch {
    }

    fetch(`${API}/api/auth/status`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.user) router.refresh()
      })
      .catch(() => {
      })
  }, [isLoggedIn, router])

  return null
}

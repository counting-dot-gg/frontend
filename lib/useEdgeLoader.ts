'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { wasRateLimitedRecently } from './rateLimitNotice'

const IDLE_COOLDOWN_MS = 1200
const RATE_LIMIT_COOLDOWN_MS = 5000

export function useEdgeLoader({
  root,
  edge,
  margin = 600,
  enabled,
  exhausted,
  onLoad,
}: {
  root: RefObject<HTMLElement | null>
  edge: 'top' | 'bottom'
  margin?: number
  enabled: boolean
  exhausted: boolean
  onLoad: () => Promise<void>
}): { loading: boolean } {
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)
  const cooldownUntilRef = useRef(0)

  const onLoadRef = useRef(onLoad)
  const enabledRef = useRef(enabled)
  const exhaustedRef = useRef(exhausted)
  const marginRef = useRef(margin)
  useEffect(() => {
    onLoadRef.current = onLoad
    enabledRef.current = enabled
    exhaustedRef.current = exhausted
    marginRef.current = margin
  })

  const pump = useCallback(async () => {
    const el = root.current
    if (!el) return
    if (loadingRef.current || !enabledRef.current || exhaustedRef.current) return
    if (Date.now() < cooldownUntilRef.current) return

    const distance =
      edge === 'top'
        ? el.scrollTop
        : el.scrollHeight - el.scrollTop - el.clientHeight
    if (distance > marginRef.current) return

    const heightBefore = el.scrollHeight
    const scrollTopBefore = el.scrollTop
    loadingRef.current = true
    setLoading(true)
    try {
      await onLoadRef.current()
    } catch {
    } finally {
      loadingRef.current = false
      setLoading(false)
    }

    requestAnimationFrame(() => {
      const now = root.current
      if (now && now.scrollHeight > heightBefore) {
        if (edge === 'top') {
          now.scrollTop = scrollTopBefore + (now.scrollHeight - heightBefore)
        }
        cooldownUntilRef.current = 0
        void pump()
      } else {
        cooldownUntilRef.current =
          Date.now() + (wasRateLimitedRecently() ? RATE_LIMIT_COOLDOWN_MS : IDLE_COOLDOWN_MS)
      }
    })
  }, [root, edge])

  useEffect(() => {
    const el = root.current
    if (!el) return

    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        void pump()
      })
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    void pump()

    return () => {
      el.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [root, pump, enabled, exhausted])

  return { loading }
}

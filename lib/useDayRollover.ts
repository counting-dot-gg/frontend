'use client'

import { useEffect, useState } from 'react'
import { onDayRollover, relabelHourBars } from '@/lib/hourBar'

export function useDayRollover(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => onDayRollover(() => setTick(t => t + 1)), [])
  return tick
}

export function useHourBarRelabel(ref: { current: Element | null }): void {
  useEffect(() => {
    relabelHourBars(ref.current)
    return onDayRollover(() => relabelHourBars(ref.current))
  }, [ref])
}

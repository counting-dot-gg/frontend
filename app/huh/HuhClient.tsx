'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSocket } from '@/lib/socket'

const THROTTLE_MS = 100

const MIN_SCALE = 100
const MAX_SCALE = 1100

export default function HuhClient() {
  const [presses, setPresses] = useState(0)
  const [rockCount, setRockCount] = useState(0)
  const [viewers, setViewers] = useState(1)
  const [scale, setScale] = useState(MIN_SCALE)

  const reverse = useRef(false)
  const lastPress = useRef(0)

  useEffect(() => {
    const socket = getSocket()
    if (!socket.connected) socket.connect()

    const join = () => socket.emit('watchRock')
    const onWatchers = (n: number) => setViewers(n)
    const onCount = (n: number) => setRockCount(n)

    socket.on('connect', join)
    socket.on('watcher_count', onWatchers)
    socket.on('rock_count', onCount)
    if (socket.connected) join()

    return () => {
      socket.off('connect', join)
      socket.off('watcher_count', onWatchers)
      socket.off('rock_count', onCount)
    }
  }, [])

  const press = useCallback(() => {
    const now = performance.now()
    if (now < lastPress.current + THROTTLE_MS) return
    lastPress.current = now

    getSocket().emit('rock')
    setPresses(p => p + 1)
    setScale(prev => {
      if (prev + 1 >= MAX_SCALE) reverse.current = true
      else if (prev - 1 <= MIN_SCALE) reverse.current = false
      return reverse.current ? prev - 1 : prev + 1
    })
  }, [])

  return (
    <div
      style={{
        height: 'calc(100vh - 65px)',
        maxHeight: 'calc(100vh - 65px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: 16,
        background: 'url("https://i.imgur.com/ByxzxU4.jpg") center / cover no-repeat',
      }}
    >
      <button
        onClick={press}
        style={{
          scale: `${scale}%`,
          height: 'fit-content',
          padding: '8px 22px',
          borderRadius: 6,
          border: 'none',
          background: '#1976d2',
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '0.03em',
          cursor: 'pointer',
          boxShadow: '0 3px 8px rgb(var(--shadow-rgb) / 0.4)',
          whiteSpace: 'nowrap',
        }}
      >
        {presses > 0 ? `Ok (${presses.toLocaleString()})` : 'Ok'}
      </button>

      {presses > 0 && rockCount > 0 && (
        <div style={{
          position: 'absolute', bottom: 14, left: 0, right: 0, zIndex: 999,
          textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#fff',
          textShadow: '0 1px 3px rgb(var(--shadow-rgb) / 0.9)', fontVariantNumeric: 'tabular-nums',
          pointerEvents: 'none',
        }}>
          {rockCount.toLocaleString()}
          {viewers > 1 && (
            <span style={{ fontWeight: 400, opacity: 0.8 }}> · {viewers.toLocaleString()} here</span>
          )}
        </div>
      )}
    </div>
  )
}

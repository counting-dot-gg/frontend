'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { Socket } from 'socket.io-client'
import type { LatencySample } from './LatencyChart'
import { latencySnapshot } from '@/lib/latencyTelemetry'

export type { LatencySample }

const LatencyChart = dynamic(() => import('./LatencyChart'), { ssr: false })

const MAX_SAMPLES = 100
const FPS = 10

interface LatencyChartHostProps {
  socket: Socket | null
}

export default function LatencyChartHost({ socket }: LatencyChartHostProps) {
  const bufferRef = useRef<LatencySample[]>([])
  const [samples, setSamples] = useState<LatencySample[]>([])

  const versionRef = useRef(0)
  const flushedRef = useRef(-1)

  const panelRef = useRef<HTMLDivElement>(null)
  const visibleRef = useRef(false)
  useEffect(() => {
    const el = panelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') { visibleRef.current = true; return }
    const io = new IntersectionObserver(entries => {
      visibleRef.current = entries.some(e => e.isIntersecting)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const registerSample = useCallback((post: any) => {
    const total: number | undefined = typeof post.processingLatency === 'number' ? post.processingLatency : undefined
    if (total == null) return
    const schedulingMs: number = post.schedulingMs ?? 0
    const dbReadMs: number = post.dbReadMs ?? 0
    const dbWriteMs: number = post.dbWriteMs ?? 0
    const preBroadcastMs: number = post.preBroadcastMs ?? 0
    const rawOtherMs: number = typeof post.otherMs === 'number' ? post.otherMs : Math.max(0, total - schedulingMs - dbReadMs - dbWriteMs)
    const otherMs: number = Math.max(0, rawOtherMs - preBroadcastMs)
    const sample: LatencySample = { schedulingMs, dbReadMs, dbWriteMs, preBroadcastMs, otherMs }
    bufferRef.current = [...bufferRef.current, sample].slice(-MAX_SAMPLES)
    versionRef.current += 1
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      if (!visibleRef.current || versionRef.current === flushedRef.current) return
      flushedRef.current = versionRef.current
      setSamples([...bufferRef.current])
    }, 1000 / FPS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!socket) return
    const onPost = (data: { post: any }) => registerSample(data.post)
    socket.on('post', onPost)
    return () => { socket.off('post', onPost) }
  }, [socket, registerSample])

  const [diag, setDiag] = useState({ ...latencySnapshot })
  useEffect(() => {
    const id = setInterval(() => setDiag({ ...latencySnapshot }), 2000)
    return () => clearInterval(id)
  }, [])

  const elsewhere = Math.max(0, diag.roundTripP50 - diag.processingP50 - diag.pingP50)

  return (
    <div ref={panelRef} style={{ marginTop: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Latency</div>
      {diag.samples > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--ink-3)', marginBottom: 8 }}>
          <span>network (ping) <strong style={{ color: 'var(--ink-2)' }}>{diag.pingP50}ms</strong> / p95 {diag.pingP95}ms</span>
          <span>server <strong style={{ color: 'var(--ink-2)' }}>{diag.processingP50}ms</strong></span>
          <span title="Round trip minus network minus server: queueing, or a browser too busy to notice the reply.">
            elsewhere <strong style={{ color: elsewhere > 100 ? 'var(--danger)' : 'var(--ink-2)' }}>{elsewhere}ms</strong>
          </span>
          <span title="Main-thread long tasks. High means the reply arrived on time and the browser was busy.">
            browser blocked <strong style={{ color: diag.blockedMsPerMin > 5000 ? 'var(--danger)' : 'var(--ink-2)' }}>{diag.blockedMsPerMin}ms/min</strong>
          </span>
          <span style={{ color: diag.transport === 'websocket' ? 'var(--ink-3)' : 'var(--danger)' }}>
            {diag.transport}
          </span>
        </div>
      )}
      {samples.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Waiting for posts…</div>
      ) : (
        <LatencyChart samples={samples} />
      )}
    </div>
  )
}

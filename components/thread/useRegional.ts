'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { Socket } from 'socket.io-client'
import {
  attachSocket, configureRegional, confirmPost, postQueued, displayOwner, forgetThread, lastVpsPing, ownerOf, reconcile, recordVpsPing,
  refusePost, regionalPing, snapshot, stalePending, subscribe,
  type ThreadOwner,
} from '@/lib/regional'

const VPS_PING_WINDOW = 5
const PING_REPORT_MS = 30_000
const STATUS_CHECK_MS = 3_000
const STALE_AFTER_MS = 4_000

export interface Regional {
  owner: ThreadOwner | null
  ping: number | null
  vpsPing: number | null
  refusal: string | null
  pick: (region: string) => void
  cancel: () => void
}

const noOwner = () => null

export function useRegional(socket: Socket | null, threadName: string): Regional {
  useSyncExternalStore(subscribe, snapshot, snapshot)
  const owner = useSyncExternalStore(subscribe, () => displayOwner(threadName), noOwner)
  const vpsPing = useSyncExternalStore(subscribe, lastVpsPing, noOwner)
  const [refusal, setRefusal] = useState<string | null>(null)

  useEffect(() => {
    if (!socket) return
    attachSocket(socket)
    configureRegional({
      reporter: sample => socket.emit('regional_sample', sample),
      onUnreachable: (thread, region) => socket.emit('thread_region_unreachable', { thread_name: thread, region }),
    })
    const rtts: number[] = []
    let lastReport = 0
    const onOwner = (o: ThreadOwner) => {
      if (o?.thread_name !== threadName) return
      if (!o.moving) setRefusal(null)
    }
    const onRefused = (m: { thread_name?: string; reason?: string }) => {
      if (m?.thread_name === threadName && m.reason) setRefusal(m.reason)
    }
    const onMoved = (m: { thread_name?: string; post_hash?: string }) => {
      if (m?.thread_name === threadName) refusePost(threadName, m.post_hash, null)
    }
    const onPost = (m: { post?: { post_hash?: string } }) => confirmPost(m?.post?.post_hash)
    const onRejected = (m: { post_hash?: string }) => confirmPost(m?.post_hash)
    const onQueued = (m: { post_hash?: string }) => postQueued(m?.post_hash)
    const onPong = (m: { t?: unknown }) => {
      if (typeof m?.t !== 'number') return
      const rtt = Date.now() - m.t
      if (rtt < 0 || rtt > 60_000) return
      rtts.push(rtt)
      if (rtts.length > VPS_PING_WINDOW) rtts.shift()
      const ms = Math.round([...rtts].sort((a, b) => a - b)[Math.floor(rtts.length / 2)])
      recordVpsPing(ms)
      if (Date.now() - lastReport >= PING_REPORT_MS && ownerOf(threadName)?.movable) {
        lastReport = Date.now()
        socket.emit('regional_sample', { kind: 'ping', region: 'vps', ms, thread: threadName })
      }
    }
    let connectedAt = Date.now()
    const onStatus = (m: { thread_name?: string; known?: string[] }) => {
      if (m?.thread_name === threadName) reconcile(threadName, m.known ?? [], connectedAt)
    }
    const checkStatus = () => {
      if (!socket.connected) return
      const posts = stalePending(threadName, STALE_AFTER_MS)
      if (posts.length > 0) socket.emit('post_status', { thread_name: threadName, posts })
    }
    const statusTimer = setInterval(checkStatus, STATUS_CHECK_MS)
    const onConnect = () => {
      connectedAt = Date.now()
      pingNow()
      checkStatus()
    }
    const pingNow = () => socket.volatile.emit('latency_ping', { t: Date.now() })
    socket.on('thread_owner', onOwner)
    socket.on('thread_region_refused', onRefused)
    socket.on('post_moved', onMoved)
    socket.on('post', onPost)
    socket.on('post_rejected', onRejected)
    socket.on('post_queued', onQueued)
    socket.on('latency_pong', onPong)
    socket.on('post_status', onStatus)
    socket.on('connect', onConnect)
    if (socket.connected) pingNow()
    return () => {
      socket.off('thread_owner', onOwner)
      socket.off('thread_region_refused', onRefused)
      socket.off('post_moved', onMoved)
      socket.off('post', onPost)
      socket.off('post_rejected', onRejected)
      socket.off('post_queued', onQueued)
      socket.off('latency_pong', onPong)
      socket.off('post_status', onStatus)
      socket.off('connect', onConnect)
      clearInterval(statusTimer)
      forgetThread(threadName)
    }
  }, [socket, threadName])

  const pick = useCallback(
    (region: string) => {
      setRefusal(null)
      socket?.emit('thread_region', { thread_name: threadName, region })
    },
    [socket, threadName],
  )

  const cancel = useCallback(() => {
    socket?.emit('thread_region_cancel', { thread_name: threadName })
  }, [socket, threadName])

  const remote = !!owner?.region && !owner.moving
  return { owner, ping: remote ? regionalPing(threadName) ?? vpsPing : vpsPing, vpsPing, refusal, pick, cancel }
}

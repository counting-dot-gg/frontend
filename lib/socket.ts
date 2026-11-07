import { io, Socket } from 'socket.io-client'
import { notify } from './toast'
import { getDevicePerf } from './devicePerf'

let _socket: Socket | null = null

export function getSocket(): Socket {
  if (_socket) return _socket

  const host = process.env.NEXT_PUBLIC_SOCKET_HOST || 'http://localhost:3001'
  const onLocalhost = typeof window !== 'undefined'
    && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  const url = onLocalhost
    ? process.env.NEXT_PUBLIC_SOCKET_LOCAL || 'http://localhost:8804'
    : typeof window !== 'undefined'
      ? host.replace(/localhost|127\.0\.0\.1/, window.location.hostname)
      : host

  _socket = io(url, {
    withCredentials: true,
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 300,
    reconnectionDelayMax: 2000,
    transports: ['websocket', 'polling'],
  })

  _socket.on('connect', () => {
    if (!getDevicePerf().liveRank) _socket?.emit('rank_live', false)
  })

  _socket.on('rate_limited', () => {
    notify('Throttled', {
      kind: 'warn',
      detail: 'You’re sending too fast. That one didn’t go through.',
      dedupeKey: 'rate_limited',
    })
  })

  _socket.on('connect_error', (err) => {
    if (err.message !== 'too_many_connections') return
    notify('Too many connections', {
      kind: 'error',
      detail: 'Too many tabs or devices on your network are connected. Retrying…',
      dedupeKey: 'too_many_connections',
      ttl: 16_000,
    })
    setTimeout(() => _socket?.connect(), 15_000)
  })

  return _socket
}

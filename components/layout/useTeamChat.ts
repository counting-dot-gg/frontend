'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSocket } from '@/lib/socket'

export interface TeamChatMessage {
  id: string
  gameId: number
  teamId: number | null
  scope?: 'team' | 'game'
  authorUuid: string
  authorUsername: string
  authorColor: string
  authorAvatar: string
  authorDiscordId: string
  authorTeamId?: number
  authorTeamName?: string
  text: string
  timestamp: number
}

export type ChatScope = 'team' | 'game'

export interface RoomChat {
  scope: ChatScope
  available: boolean
  name: string
  messages: TeamChatMessage[]
  unread: number
  error: string | null
  send: (text: string) => boolean
  sending: boolean
  markRead: () => void
}

const SEND_COOLDOWN_MS = 1000

const isGame = (m: TeamChatMessage) => m.scope === 'game' || m.teamId == null

export function useTeamChat(isLoggedIn: boolean, tab: string): { team: RoomChat; game: RoomChat } {
  const [teamAvailable, setTeamAvailable] = useState(false)
  const [teamMessages, setTeamMessages] = useState<TeamChatMessage[]>([])
  const [teamUnread, setTeamUnread] = useState(0)
  const [gameAvailable, setGameAvailable] = useState(false)
  const [gameMessages, setGameMessages] = useState<TeamChatMessage[]>([])
  const [gameUnread, setGameUnread] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const lastSend = useRef(0)
  const [sending, setSending] = useState(false)
  const gameId = useRef<number | null>(null)
  const tabRef = useRef(tab)
  useEffect(() => { tabRef.current = tab }, [tab])

  useEffect(() => {
    if (!isLoggedIn) return
    const socket = getSocket()
    if (!socket.connected) socket.connect()

    const clear = () => {
      setTeamAvailable(false)
      setTeamMessages([])
      setGameAvailable(false)
      setGameMessages([])
    }

    const onActive = ({ gameId: id }: { gameId: number | null }) => {
      gameId.current = id
      if (id == null) { clear(); return }
      socket.emit('bingo_chat_open', { gameId: id })
    }

    const onState = (data: {
      available: boolean
      messages?: TeamChatMessage[]
      game?: { available: boolean; messages?: TeamChatMessage[] }
    }) => {
      setTeamAvailable(!!data.available)
      setTeamMessages(data.available ? data.messages ?? [] : [])
      setTeamUnread(0)
      setGameAvailable(!!data.game?.available)
      setGameMessages(data.game?.available ? data.game.messages ?? [] : [])
      setGameUnread(0)
    }

    const onMessage = (msg: TeamChatMessage) => {
      if (isGame(msg)) {
        setGameMessages(prev => [...prev, msg])
        if (tabRef.current !== 'game') setGameUnread(n => n + 1)
      } else {
        setTeamMessages(prev => [...prev, msg])
        if (tabRef.current !== 'team') setTeamUnread(n => n + 1)
      }
    }

    const onError = ({ error: err }: { error: string }) => {
      setError(err)
      window.setTimeout(() => setError(null), 2500)
    }

    const refresh = () => { socket.emit('bingo_active') }
    let lastShape = ''
    const onGameUpdate = ({ payload }: { payload?: { game?: { status?: string }; members?: { counter?: { uuid?: string }; teamId?: number; status?: string }[] } }) => {
      const shape = `${payload?.game?.status}|${(payload?.members ?? []).map(m => `${m.counter?.uuid}:${m.teamId}:${m.status}`).join(',')}`
      if (shape === lastShape) return
      lastShape = shape
      refresh()
    }

    socket.on('bingo_active', onActive)
    socket.on('bingo_chat_state', onState)
    socket.on('bingo_chat_message', onMessage)
    socket.on('bingo_chat_error', onError)
    socket.on('bingo_game_update', onGameUpdate)
    socket.on('bingo_game_ended', refresh)
    socket.on('connect', refresh)

    socket.emit('bingo_active')

    return () => {
      socket.off('bingo_active', onActive)
      socket.off('bingo_chat_state', onState)
      socket.off('bingo_chat_message', onMessage)
      socket.off('bingo_chat_error', onError)
      socket.off('bingo_game_update', onGameUpdate)
      socket.off('bingo_game_ended', refresh)
      socket.off('connect', refresh)
      socket.emit('bingo_chat_leave')
    }
  }, [isLoggedIn])

  const send = useCallback((scope: ChatScope, text: string): boolean => {
    const body = text.trim()
    if (!body || gameId.current == null) return false
    const now = Date.now()
    if (now - lastSend.current < SEND_COOLDOWN_MS) return false
    lastSend.current = now
    setSending(true)
    window.setTimeout(() => setSending(false), SEND_COOLDOWN_MS)
    getSocket().emit('bingo_chat_send', { gameId: gameId.current, scope, text: body })
    return true
  }, [])

  const sendTeam = useCallback((text: string) => send('team', text), [send])
  const sendGame = useCallback((text: string) => send('game', text), [send])
  const markTeamRead = useCallback(() => setTeamUnread(0), [])
  const markGameRead = useCallback(() => setGameUnread(0), [])

  return {
    team: {
      scope: 'team', available: teamAvailable, name: 'Team', messages: teamMessages,
      unread: teamUnread, error, send: sendTeam, sending, markRead: markTeamRead,
    },
    game: {
      scope: 'game', available: gameAvailable, name: 'Game', messages: gameMessages,
      unread: gameUnread, error, send: sendGame, sending, markRead: markGameRead,
    },
  }
}

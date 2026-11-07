'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getSocket } from '@/lib/socket'
import type { BingoGameState, BingoLobbyData, BingoLobbyGame, BingoSquare } from '@/lib/bingo'

export interface UseBingo {
  lobby: BingoLobbyData | null
  game: BingoGameState | null
  activeGameId: number | null
  activeKnown: boolean
  error: string | null
  pending: boolean
  lastUnlock: { index: number; unlockSeq: number } | null
  openGame: (gameId: number) => void
  closeGame: () => void
  send: (event: string, data?: Record<string, unknown>) => void
  clearError: () => void
  dismissFinished: () => void
}

const UNSEEN_KEY = 'bingo:finished-unseen'
function readUnseen(): number | null {
  try { const v = Number(localStorage.getItem(UNSEEN_KEY)); return Number.isInteger(v) && v > 0 ? v : null } catch { return null }
}
function writeUnseen(id: number | null) {
  try { if (id == null) localStorage.removeItem(UNSEEN_KEY); else localStorage.setItem(UNSEEN_KEY, String(id)) } catch {}
}

let listTimer: ReturnType<typeof setTimeout> | null = null
let listWatchers = 0
function requestList() {
  if (listTimer) return
  listTimer = setTimeout(() => {
    listTimer = null
    getSocket().emit('bingo_list')
  }, 150)
}
function watchList(): () => void {
  listWatchers++
  requestList()
  return () => {
    listWatchers--
    if (listWatchers === 0) getSocket().emit('bingo_list_leave')
  }
}

let lastFollowed: BingoGameState | null = null
const followedListeners = new Set<() => void>()

export function useFollowedGame(): BingoGameState | null {
  return useSyncExternalStore(
    cb => { followedListeners.add(cb); return () => { followedListeners.delete(cb) } },
    () => lastFollowed,
    () => null,
  )
}

if (typeof window !== 'undefined') {
  try { localStorage.removeItem('bingo:followed'); localStorage.removeItem('features') } catch {}
}

export function useBingo(enabled: boolean, { gameId: pinnedId = null, follow = true, list = true }: { gameId?: number | null; follow?: boolean; list?: boolean } = {}): UseBingo {
  const [lobby, setLobby] = useState<BingoLobbyData | null>(null)
  const [game, setGame] = useState<BingoGameState | null>(null)
  const [activeGameId, setActiveGameId] = useState<number | null>(null)
  const [activeKnown, setActiveKnown] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [lastUnlock, setLastUnlock] = useState<{ index: number; unlockSeq: number } | null>(null)

  const openGameId = useRef<number | null>(null)
  const joinedGameId = useRef<number | null>(null)
  const restoring = useRef<number | null>(null)
  const checking = useRef<number | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!enabled || !follow || pinnedId != null) return
    if (lastFollowed !== game) {
      lastFollowed = game
      followedListeners.forEach(f => f())
    }
  }, [enabled, follow, pinnedId, game])


  useEffect(() => {
    if (!enabled) return
    const socket = getSocket()
    if (!socket.connected) socket.connect()

    const onLobby = (data: BingoLobbyData) => {
      if (!mounted.current) return
      setLobby(data)
      setActiveGameId(data?.myActiveGameId ?? null)
    }

    const onGame = (payload: BingoGameState & { error?: string }) => {
      if (!mounted.current) return
      if (payload?.error) {
        if (restoring.current != null) { restoring.current = null; writeUnseen(null); return }
        if (checking.current != null) {
          checking.current = null
          joinedGameId.current = null
          openGameId.current = null
          setGame(null)
          return
        }
        setError(payload.error)
        return
      }
      restoring.current = null
      if (checking.current != null && payload?.game?.id === checking.current) {
        checking.current = null
        if (payload.game.status !== 'finished') {
          joinedGameId.current = null
          openGameId.current = null
          setGame(null)
          return
        }
      }
      if (follow && pinnedId == null && payload?.game?.status === 'finished') writeUnseen(payload.game.id)
      if (openGameId.current != null && payload?.game?.id !== openGameId.current) return
      setGame(payload)
    }

    const onGameUpdate = ({ gameId, payload }: { gameId: number; payload: BingoGameState }) => {
      if (!mounted.current) return
      if (openGameId.current !== gameId) return
      if (follow && pinnedId == null && payload?.game?.status === 'finished') writeUnseen(gameId)
      setGame(payload)
    }

    const onActive = ({ gameId }: { gameId: number | null }) => {
      if (!mounted.current) return
      setActiveGameId(gameId ?? null)
      setActiveKnown(true)
      if (gameId == null && pinnedId == null) {
        setGame(prev => {
          if (prev && prev.game.status !== 'finished' && follow) {
            checking.current = prev.game.id
            getSocket().emit('bingo_game', { gameId: prev.game.id })
            return prev
          }
          joinedGameId.current = null
          openGameId.current = null
          return prev?.game.status === 'finished' ? prev : null
        })
      }
    }

    const onSquareDelta = ({ gameId, squares }: { gameId: number; squares: BingoSquare[] }) => {
      if (!mounted.current || openGameId.current !== gameId || !squares?.length) return
      const byId = new Map(squares.map(q => [q.id, q]))
      setGame(prev => (prev && prev.game.id === gameId
        ? { ...prev, squares: prev.squares.map(q => byId.get(q.id) ?? q) }
        : prev))
    }

    const onListUpdate = () => { if (list) requestList() }

    const onLobbySquares = ({ gameId, squares, winningLines }: { gameId: number; squares: BingoSquare[]; winningLines?: BingoLobbyGame['winningLines'] }) => {
      if (!mounted.current || !squares?.length) return
      const byId = new Map(squares.map(q => [q.id, q]))
      setLobby(prev => {
        if (!prev?.activeGames.some(g => g.id === gameId)) return prev
        return {
          ...prev,
          activeGames: prev.activeGames.map(g => g.id !== gameId ? g : {
            ...g,
            squares: g.squares.map(q => {
              const n = byId.get(q.id)
              return n ? { ...q, ...n, threadName: q.threadName ?? n.threadName, threadTitle: q.threadTitle ?? n.threadTitle } : q
            }),
            winningLines: winningLines ?? g.winningLines,
          }),
        }
      })
    }

    const onSquareUnlocked = (data: { gameId: number; unlockSeq: number; index?: number; squareIndex?: number }) => {
      if (!mounted.current || openGameId.current !== data.gameId) return
      const index = data.index ?? data.squareIndex
      if (typeof index === 'number') setLastUnlock({ index, unlockSeq: data.unlockSeq })
    }

    const onGameEnded = ({ gameId }: { gameId: number }) => {
      if (!mounted.current || openGameId.current !== gameId) return
      socket.emit('bingo_game', { gameId })
      socket.emit('bingo_active')
      if (list) requestList()
    }

    const onActionResult = ({ result, error: err }: { action: string; result?: { gameId?: number }; error?: string }) => {
      if (!mounted.current) return
      setPending(false)
      if (err) {
        setError(/coming soon|not implemented/i.test(err) ? 'Bingo isn’t available yet.' : err)
        return
      }
      setError(null)
      const newId = result?.gameId
      if (typeof newId === 'number' && (pinnedId == null || newId === pinnedId)) {
        joinedGameId.current = newId
        openGameId.current = newId
        setActiveGameId(newId)
        socket.emit('bingo_game', { gameId: newId })
      }
      socket.emit('bingo_active')
      if (list) requestList()
    }

    socket.on('bingo_list', onLobby)
    socket.on('bingo_game', onGame)
    socket.on('bingo_game_update', onGameUpdate)
    socket.on('bingo_square_delta', onSquareDelta)
    socket.on('bingo_active', onActive)
    socket.on('bingo_list_update', onListUpdate)
    socket.on('bingo_lobby_squares', onLobbySquares)
    socket.on('bingo_square_unlocked', onSquareUnlocked)
    socket.on('bingo_game_ended', onGameEnded)
    socket.on('bingo_action_result', onActionResult)

    const onReconnect = () => {
      joinedGameId.current = null
      if (pinnedId != null) {
        joinedGameId.current = pinnedId
        socket.emit('bingo_game', { gameId: pinnedId })
      } else if (follow && openGameId.current != null) {
        joinedGameId.current = openGameId.current
        socket.emit('bingo_game', { gameId: openGameId.current })
      }
      socket.emit('bingo_active')
      if (list) requestList()
    }
    socket.on('connect', onReconnect)

    if (pinnedId != null) {
      joinedGameId.current = pinnedId
      openGameId.current = pinnedId
      socket.emit('bingo_game', { gameId: pinnedId })
    } else if (follow) {
      const unseen = readUnseen()
      if (unseen != null) {
        restoring.current = unseen
        joinedGameId.current = unseen
        openGameId.current = unseen
        socket.emit('bingo_game', { gameId: unseen })
      }
    }
    const unwatchList = list ? watchList() : () => {}
    socket.emit('bingo_active')

    return () => {
      unwatchList()
      socket.off('connect', onReconnect)
      socket.off('bingo_list', onLobby)
      socket.off('bingo_game', onGame)
      socket.off('bingo_game_update', onGameUpdate)
      socket.off('bingo_square_delta', onSquareDelta)
      socket.off('bingo_active', onActive)
      socket.off('bingo_list_update', onListUpdate)
      socket.off('bingo_lobby_squares', onLobbySquares)
      socket.off('bingo_square_unlocked', onSquareUnlocked)
      socket.off('bingo_game_ended', onGameEnded)
      socket.off('bingo_action_result', onActionResult)
    }
  }, [enabled, pinnedId, follow, list])

  useEffect(() => {
    if (!enabled || !follow || pinnedId != null || activeGameId == null) return
    if (joinedGameId.current === activeGameId) return
    if (readUnseen() !== activeGameId) writeUnseen(null)
    joinedGameId.current = activeGameId
    openGameId.current = activeGameId
    getSocket().emit('bingo_game', { gameId: activeGameId })
  }, [enabled, follow, pinnedId, activeGameId])

  const openGame = useCallback((gameId: number) => {
    joinedGameId.current = gameId
    openGameId.current = gameId
    setGame(null)
    setError(null)
    getSocket().emit('bingo_game', { gameId })
  }, [])

  const dismissFinished = useCallback(() => {
    writeUnseen(null)
    setGame(prev => (prev?.game.status === 'finished' ? null : prev))
    joinedGameId.current = null
    openGameId.current = null
  }, [])

  const closeGame = useCallback(() => {
    joinedGameId.current = null
    openGameId.current = null
    setGame(null)
    requestList()
  }, [])

  const send = useCallback((event: string, data?: Record<string, unknown>) => {
    setPending(true)
    setError(null)
    getSocket().emit(event, data ?? {})
    window.setTimeout(() => { if (mounted.current) setPending(false) }, 4000)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { lobby, game, activeGameId, activeKnown, error, pending, lastUnlock, openGame, closeGame, send, clearError, dismissFinished }
}

export function sortLobby(games: BingoLobbyGame[]): BingoLobbyGame[] {
  const rank: Record<string, number> = { lobby: 0, running: 1, finished: 2 }
  return [...games].sort((a, b) =>
    (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || b.players - a.players || b.id - a.id,
  )
}

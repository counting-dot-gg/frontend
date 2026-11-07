'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getSocket } from '@/lib/socket'
import { encodeShuffleResult, type ShuffleResult } from '@/lib/shuffleShare'

const ANIMATION_DURATION = 500
const NAVBAR_HEIGHT = 65
const MIN_SIZE = 2
const MAX_SIZE = 20
const ROWS_PER_PAGE = 10

interface PastGame { seed: string; gameStatus: string; size: number; score: number }

function NumberAnimator({ number, startRange, endRange, duration }: {
  number: number; startRange: number; endRange: number; duration: number
}) {
  const [animated, setAnimated] = useState(number)

  useEffect(() => {
    const startTime = Date.now()
    const id = setInterval(() => {
      const elapsed = Date.now() - startTime
      if (elapsed < duration) {
        setAnimated(Math.floor((elapsed / duration) * (endRange - startRange + 1) + startRange))
      } else {
        setAnimated(number)
        clearInterval(id)
      }
    }, 16)
    return () => clearInterval(id)
  }, [number, startRange, endRange, duration])

  return <>{animated}</>
}

function possibleIndices(moves: number[], n: number): number[] {
  const out: number[] = []
  for (let i = 0; i < moves.length; i++) {
    if (moves[i] !== 0) continue
    let ok = true
    for (let j = i - 1; j >= 0 && ok; j--) {
      if (moves[j] !== 0 && n < moves[j]) ok = false
    }
    for (let k = i + 1; k < moves.length && ok; k++) {
      if (moves[k] !== 0 && n > moves[k]) ok = false
    }
    if (ok) out.push(i)
  }
  return out
}

function rainbow(count: number, opacity = 1): string[] {
  const step = 360 / Math.max(1, count)
  return Array.from({ length: count }, (_, i) => `hsl(${i * step}, 100%, 50%, ${opacity})`)
}

function rainbowEmoji(count: number): string[] {
  const palette = [
    { emoji: '❤️', hue: 0 }, { emoji: '🧡', hue: 30 }, { emoji: '💛', hue: 60 },
    { emoji: '💚', hue: 120 }, { emoji: '💙', hue: 210 }, { emoji: '💜', hue: 270 },
    { emoji: '💗', hue: 330 },
  ]
  const step = 360 / Math.max(1, count)
  return Array.from({ length: count }, (_, i) => {
    const hue = i * step
    return palette.reduce((prev, curr) =>
      Math.abs(curr.hue - hue) < Math.abs(prev.hue - hue) ? curr : prev,
    ).emoji
  })
}

function useSetting<T>(key: string, initial: T): [T, (v: T) => void] {
  const [current, setCurrent] = useState<T>(initial)
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key)
      if (item != null) setCurrent(JSON.parse(item))
    } catch {}
  }, [key])
  const set = useCallback((v: T) => {
    setCurrent(v)
    try { window.localStorage.setItem(key, JSON.stringify(v)) } catch {}
  }, [key])
  return [current, set]
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      marginLeft: 8, padding: '1px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700,
      border: '1px solid currentColor', opacity: 0.7, verticalAlign: 'middle',
    }}>
      {children}
    </span>
  )
}

function Modal({ open, onClose, children }: {
  open: boolean; onClose: () => void; children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1300, background: 'rgb(var(--shadow-rgb) / 0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)', maxHeight: '85vh', overflowY: 'auto',
          background: 'var(--card, #1a1a1a)', color: 'var(--card-foreground, #e8ecf5)',
          border: '1px solid rgb(var(--ink-rgb) / 0.15)', borderRadius: 12,
          padding: 20, boxShadow: '0 24px 60px rgb(var(--shadow-rgb) / 0.55)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export default function ShuffleClient({
  isLoggedIn, username, initialSeed, sharedResult, initialSize,
}: {
  isLoggedIn: boolean
  username?: string
  initialSeed: string | null
  sharedResult: ShuffleResult | null
  initialSize: number | null
}) {
  const [preferredGameSize, setPreferredGameSize] = useSetting<number>('preferredGameSize', 10)
  const [sizeInput, setSizeInput] = useState('')

  const [gameSize, setGameSize] = useState(initialSize ?? sharedResult?.size ?? 10)
  const [seedId, setSeedId] = useState<string | undefined>(initialSeed ?? sharedResult?.seed ?? undefined)
  const [dateStr, setDateStr] = useState('')
  const [gameStatus, setGameStatus] = useState('Loading...')
  const [scoreData, setScoreData] = useState<number[]>([])
  const [highScore, setHighScore] = useState(0)
  const [highScoreSeed, setHighScoreSeed] = useState('')
  const [gameHistory, setGameHistory] = useState<PastGame[]>([])
  const [page, setPage] = useState(0)

  const [numbers, setNumbers] = useState<number[]>(() => Array(10).fill(0))
  const [numbersCopy, setNumbersCopy] = useState<number[]>(() => Array(10).fill(0))
  const [score, setScore] = useState(0)
  const [currentNumber, setCurrentNumber] = useState(-1)
  const [currentNumberCopy, setCurrentNumberCopy] = useState(-1)
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const [rulesOpen, setRulesOpen] = useState(true)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [newGameOpen, setNewGameOpen] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [clipboardText, setClipboardText] = useState('')
  const [clipboardFallbackOpen, setClipboardFallbackOpen] = useState(false)

  const seedRef = useRef<string | undefined>(seedId)
  const sizeRef = useRef(preferredGameSize)
  useEffect(() => { sizeRef.current = preferredGameSize }, [preferredGameSize])

  const timers = useRef<number[]>([])
  const later = useCallback((fn: () => void, ms: number) => {
    if (ms <= 0) { fn(); return }
    timers.current.push(window.setTimeout(fn, ms))
  }, [])

  const startGame = useCallback((seed_id?: string) => {
    setIsCopied(false)
    setClipboardFallbackOpen(false)
    getSocket().emit('number_shuffle', { isDaily: false, size: sizeRef.current, seed_id })
  }, [])

  const handleSave = useCallback((index: number) => {
    if (index < 0) return
    setRulesOpen(false)
    getSocket().emit('number_shuffle', { newMoveSpot: index, seed_id: seedRef.current })
  }, [])

  useEffect(() => {
    const socket = getSocket()

    const onGame = (data: any) => {
      setIsAnimationPlaying(true)
      const movesCopy = [...(data.moves ?? [])]
      setNumbers(movesCopy)
      setNumbersCopy(movesCopy)
      setCurrentNumberCopy(data.randomNumber ?? -1)

      const settleDelay =
        (data.gameStatus === 'in_progress' || data.fresh_loss) && data.score > 0
          ? ANIMATION_DURATION + 50
          : 0

      later(() => {
        setGameSize(data.size)
        setCurrentNumber(data.randomNumber ?? -1)
        if (data.gameStatus !== 'in_progress' && data.gameStatus !== 'won' && data.fresh_loss) {
          later(() => setGameStatus(data.gameStatus), 1000)
        } else {
          setGameStatus(data.gameStatus)
        }
        setSeedId(data.seed_id)
        seedRef.current = data.seed_id
        if (!data.day && data.seed_id) {
          const url = new URL(window.location.href)
          url.searchParams.set('seed', data.seed_id)
          url.searchParams.delete('r')
          window.history.replaceState(null, '', url)
        }
        if (data.highScore !== undefined) setHighScore(data.highScore)
        if (data.highScoreSeed !== undefined) setHighScoreSeed(data.highScoreSeed)
        setDateStr(data.day ?? '')
        setScore(data.score)
        setScoreData(Array.isArray(data.all_scores) ? data.all_scores : [])
        setSelectedIndex(-1)
        setIsAnimationPlaying(false)
      }, settleDelay)
    }

    const onGames = (rows: PastGame[]) => setGameHistory(Array.isArray(rows) ? rows : [])

    const onConnect = () => {
      socket.emit('number_shuffle', {
        isDaily: seedRef.current === undefined,
        size: sizeRef.current,
        seed_id: seedRef.current,
      })
      socket.emit('number_shuffle_games')
    }

    socket.on('number_shuffle', onGame)
    socket.on('number_shuffle_games', onGames)
    socket.on('connect', onConnect)
    if (socket.connected) onConnect()
    else socket.connect()

    return () => {
      socket.off('number_shuffle', onGame)
      socket.off('number_shuffle_games', onGames)
      socket.off('connect', onConnect)
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [later])

  const legalRef = useRef<number[]>([])
  const selectedRef = useRef(-1)

  useEffect(() => {
    const anyModalOpen = optionsOpen || historyOpen || newGameOpen
    if (gameStatus === 'Loading...' || anyModalOpen) return
    const playing = gameStatus === 'in_progress'

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return

      if (!playing) {
        if (e.key === 'n' || e.key === 'N') { e.preventDefault(); startGame() }
        else if (e.key === 'c' || e.key === 'C') { e.preventDefault(); copyRef.current() }
        return
      }

      if (e.key === 'Enter' || e.key === ' ') {
        if (selectedRef.current !== -1) { e.preventDefault(); handleSave(selectedRef.current) }
        return
      }
      if (!/^[0-9]$/.test(e.key)) return
      const index = e.key === '0' ? 9 : Number(e.key) - 1
      if (index >= numbersCopy.length || !legalRef.current.includes(index)) return

      e.preventDefault()
      const next = [...numbers]
      next[index] = currentNumber
      setNumbersCopy(next)
      setSelectedIndex(index)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gameStatus, optionsOpen, historyOpen, newGameOpen, numbers, numbersCopy.length, currentNumber, handleSave, startGame])

  const legal = useMemo(
    () => (currentNumber > 0 ? possibleIndices(numbers, currentNumber) : []),
    [numbers, currentNumber],
  )
  useEffect(() => { legalRef.current = legal }, [legal])
  useEffect(() => { selectedRef.current = selectedIndex }, [selectedIndex])


  const colors = useMemo(() => rainbow(numbersCopy.length), [numbersCopy.length])
  const colorsFaded = useMemo(() => rainbow(numbersCopy.length, 0.35), [numbersCopy.length])
  const placedCount = numbers.filter(n => n !== 0).length

  const shareUrl = useMemo(() => {
    if (!seedId) return null
    const q = new URLSearchParams({
      r: encodeShuffleResult({ score: placedCount, size: gameSize, seed: seedId }),
    })
    q.set('seed', seedId)
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://counting.gg'
    return `${origin}/shuffle?${q}`
  }, [seedId, placedCount, gameSize, dateStr, username])

  const copyRef = useRef<() => void>(() => {})

  const copyToClipboard = async () => {
    const emojis = rainbowEmoji(numbersCopy.length)
      .map((e, i) => (i < placedCount ? e : '🖤'))
      .join('')
    const full = `Number Shuffle ${placedCount}/${gameSize}${dateStr ? ` (${dateStr})` : ' (Freeplay)'} ${emojis}   \n${shareUrl ?? 'https://counting.gg/shuffle'}`
    setClipboardText(full)

    const isMobile = /android|iphone|ipad|ipod|webos/i.test(navigator.userAgent) && !/firefox/i.test(navigator.userAgent)
    if (isMobile && navigator.share) {
      try { await navigator.share({ text: full }); setIsCopied(true); return }
      catch { setClipboardFallbackOpen(true) }
    }
    try { await navigator.clipboard.writeText(full); setIsCopied(true) }
    catch { setClipboardFallbackOpen(true) }
  }

  copyRef.current = copyToClipboard

  const newGameCheck = () => {
    if (gameStatus === 'in_progress') setNewGameOpen(true)
    else startGame()
  }

  const commitSize = (raw: string) => {
    if (!/^\d+$/.test(raw)) return
    const n = parseInt(raw, 10)
    if (n >= MIN_SIZE && n <= MAX_SIZE) setPreferredGameSize(n)
  }

  const histogram = useMemo(
    () => scoreData.map((count, s) => ({ score: s, count: Number(count) || 0 })),
    [scoreData],
  )

  const loading = gameStatus === 'Loading...'
  const inProgress = gameStatus === 'in_progress'
  const won = gameStatus === 'won'
  const showResults = !loading && !inProgress
  const ladderHeight = `calc(100vh - ${NAVBAR_HEIGHT}px)`

  return (
    <div style={{
      display: 'flex',
      height: ladderHeight,
      maxHeight: ladderHeight,
      overflow: 'hidden',
      color: 'var(--foreground, #e8ecf5)',
    }}>
      <div style={{
        flex: '1 1 50%', minWidth: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '0 8px 12px',
        minHeight: 0, overflowY: 'auto',
      }}>
        <button
          onClick={() => setRulesOpen(o => !o)}
          style={{
            width: '100%', padding: '10px 8px', background: 'transparent', border: 'none',
            borderBottom: '1px solid rgb(var(--ink-rgb) / 0.12)', color: 'inherit',
            fontSize: '1.35rem', cursor: 'pointer', textAlign: 'center',
          }}
        >
          Number Shuffle {rulesOpen ? '▴' : '▾'}
        </button>
        {rulesOpen && (
          <div style={{ padding: '10px 4px', fontSize: 13, lineHeight: 1.7, textAlign: 'center', opacity: 0.85 }}>
            <div>{gameSize} random numbers between 1 and 1000.</div>
            <div>Place each one into a slot on the right.</div>
            <div>Order the numbers from smallest to largest.</div>
            <div>Once you place a number, you cannot move it.</div>
            <div>The game ends when there are no more possible moves.</div>
            <div style={{ marginTop: 8, opacity: 0.7 }}>
              Keys <strong>1–9</strong> and <strong>0</strong> (slot 10) pick a slot; <strong>Enter</strong> shuffles.
            </div>
          </div>
        )}

        <div style={{
          marginTop: 18, width: '100%', textAlign: 'center',
          fontSize: 'clamp(2.5rem, 11vw, 6rem)', fontWeight: 300, lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {currentNumber > 0
            ? <NumberAnimator number={currentNumberCopy} startRange={1} endRange={1000} duration={ANIMATION_DURATION} />
            : won ? 'W' : ''}
        </div>

        {!loading && inProgress && selectedIndex === -1 && (
          <div style={{
            marginTop: 10, width: '100%', textAlign: 'center',
            fontSize: 14, lineHeight: 1.5, opacity: 0.85,
          }}>
            Tap a <strong>dashed</strong> slot to place this number
            <span style={{ display: 'block', fontSize: 12, opacity: 0.6, marginTop: 2 }}>
              Double-click a slot to place it straight away
            </span>
          </div>
        )}

        {!loading && inProgress && (
          <button
            onClick={() => handleSave(selectedIndex)}
            disabled={selectedIndex === -1}
            style={{
              ...btnFilled,
              width: '95%', flex: '1 1 auto',
              minHeight: 96, maxHeight: 260, margin: '12px 0 16px',
              fontSize: 'clamp(1.5rem, 5vw, 2.75rem)', letterSpacing: '0.02em',
              opacity: selectedIndex === -1 ? 0.4 : 1,
              cursor: selectedIndex === -1 ? 'not-allowed' : 'pointer',
            }}
          >
            {selectedIndex === -1 ? 'Pick a slot first' : 'Place & Next'}
          </button>
        )}

        {showResults && (
          <div style={{ width: '95%', marginTop: 'auto', marginBottom: 16 }}>
            <div style={{ textAlign: 'center', fontSize: '1.15rem', fontWeight: 800, marginBottom: 4 }}>
              {won ? 'You won!' : 'You lost!'} You scored {placedCount} points!
            </div>
            {isLoggedIn ? (
              <p
                onClick={() => { if (highScoreSeed) startGame(highScoreSeed) }}
                style={{
                  textAlign: 'center', margin: '0 0 10px', fontSize: 13, opacity: 0.8,
                  cursor: highScoreSeed ? 'pointer' : 'default',
                }}
                title={highScoreSeed ? 'Replay your best run’s seed' : undefined}
              >
                High score: {highScore}/{gameSize}
              </p>
            ) : (
              <p style={{ textAlign: 'center', margin: '0 0 10px', fontSize: 13, opacity: 0.8 }}>
                Sign in to track your high score!
              </p>
            )}

            <button onClick={copyToClipboard} style={{ ...btnFilled, width: '100%', minHeight: 42 }}>
              {isCopied ? 'Copied!' : 'Copy to Clipboard'} <Kbd>C</Kbd>
            </button>

            {clipboardFallbackOpen && (
              <textarea
                readOnly
                autoFocus
                onFocus={e => e.currentTarget.select()}
                value={clipboardText}
                style={{
                  width: '100%', marginTop: 10, minHeight: 80, padding: 8, borderRadius: 8,
                  background: 'rgb(var(--ink-rgb) / 0.06)', border: '1px solid rgb(var(--ink-rgb) / 0.15)',
                  color: 'inherit', fontSize: 12, resize: 'vertical',
                }}
              />
            )}

            {histogram.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Every score on this seed</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={histogram} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--ink-rgb) / 0.08)" />
                    <XAxis dataKey="score" tick={{ fontSize: 9, fill: '#888' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: '#888' }} width={26} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface-raised)', border: '1px solid rgb(var(--ink-rgb) / 0.12)', borderRadius: 6, fontSize: 12 }}
                      formatter={(v) => [String(v), 'games']}
                      labelFormatter={l => `Score ${l}`}
                    />
                    <Bar dataKey="count" isAnimationActive={false}>
                      {histogram.map(h => (
                        <Cell key={h.score} fill={h.score === placedCount ? 'var(--gold)' : 'var(--primary, #f97316)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: showResults ? 0 : 'auto', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {!loading && (
            <button onClick={newGameCheck} style={{ ...btnFilled, width: '95%', minHeight: 42, marginBottom: 10 }}>
              New Game{!inProgress && <Kbd>N</Kbd>}
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, width: '95%', marginBottom: 10 }}>
            <button onClick={() => { setSizeInput(String(preferredGameSize)); setOptionsOpen(true) }} style={{ ...btnGhost, flex: 1, minHeight: 40 }}>
              Options
            </button>
            <button onClick={() => { setPage(0); setHistoryOpen(true) }} style={{ ...btnGhost, flex: 1, minHeight: 40 }}>
              History
            </button>
          </div>
          {dateStr && (
            <div style={{
              width: '100%', padding: '8px 4px', textAlign: 'center', fontSize: 13,
              background: 'rgb(var(--ink-rgb) / 0.06)', borderRadius: 8,
            }}>
              Daily Challenge {dateStr}
            </div>
          )}
        </div>
      </div>

      <div style={{
        flex: '1 1 50%', minWidth: 0, display: 'flex', flexDirection: 'column',
        height: ladderHeight, position: 'sticky', top: NAVBAR_HEIGHT,
      }}>
        {numbersCopy.map((number, index) => {
          const placed = numbers[index] !== 0
          const playable = !isAnimationPlaying && legal.includes(index)
          return (
            <div
              key={index}
              style={{
                display: 'flex', flex: '1 1 0', minHeight: 0,
                opacity: placed || playable ? 1 : 0.25,
                transition: 'opacity 0.2s',
              }}
            >
              <div style={{
                flex: '0 0 44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: colors[index], color: '#fff', fontSize: 12,
                textShadow: '0px 0px 3px black, 0px 0px 3px black',
              }}>
                {index + 1}
              </div>
              <div
                onClick={() => {
                  if (currentNumber > 0 && number === 0 && playable) {
                    const next = [...numbers]
                    next[index] = currentNumber
                    setNumbersCopy(next)
                    setSelectedIndex(index)
                    if (legal.length === 1) handleSave(index)
                  }
                }}
                onDoubleClick={() => {
                  if (currentNumber > 0 && number === 0 && playable) {
                    handleSave(index)
                  }
                }}
                style={{
                  flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', textShadow: '0px 0px 3px black, 0px 0px 3px black',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: `min(${25 / Math.max(1, gameSize)}rem, 5rem, 12vw)`,
                  background: placed ? colors[index] : playable ? colorsFaded[index] : colors[index],
                  border: placed
                    ? '2px solid transparent'
                    : playable
                    ? '2px dashed rgb(var(--ink-rgb) / 0.8)'
                    : `2px solid ${colors[index]}`,
                  outline: selectedIndex === index ? '3px solid #fff' : 'none',
                  outlineOffset: -3,
                  cursor: placed ? 'default' : playable ? 'pointer' : 'not-allowed',
                }}
              >
                {number !== 0 ? (
                  number
                ) : playable && currentNumber > 0 && selectedIndex === -1 ? (
                  <span style={{ opacity: 0.45 }}>{currentNumber}</span>
                ) : (
                  ''
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Modal open={optionsOpen} onClose={() => setOptionsOpen(false)}>
        <h2 style={{ textAlign: 'center', fontSize: '1.5rem', margin: '0 0 16px', fontWeight: 800 }}>Options</h2>
        <label style={{ display: 'block', fontSize: 13, opacity: 0.7, marginBottom: 6 }}>
          Game Size ({MIN_SIZE} to {MAX_SIZE})
        </label>
        <input
          type="number"
          inputMode="numeric"
          min={MIN_SIZE}
          max={MAX_SIZE}
          step={1}
          value={sizeInput}
          onChange={e => { setSizeInput(e.target.value); commitSize(e.target.value) }}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 15,
            background: 'rgb(var(--ink-rgb) / 0.06)', border: '1px solid rgb(var(--ink-rgb) / 0.15)',
            color: 'inherit', colorScheme: 'dark',
          }}
        />
        <div style={{ fontSize: 12, opacity: 0.55, marginTop: 6 }}>
          Currently {preferredGameSize}. Takes effect on your next new game.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={() => { setOptionsOpen(false); newGameCheck() }} style={{ ...btnFilled, flex: 1, minHeight: 42 }}>
            New Game
          </button>
          <button onClick={() => setOptionsOpen(false)} style={{ ...btnGhost, flex: 1, minHeight: 42 }}>
            Close
          </button>
        </div>
      </Modal>

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)}>
        <h2 style={{ textAlign: 'center', fontSize: '1.5rem', margin: '0 0 16px', fontWeight: 800 }}>History</h2>
        {gameHistory.length === 0 ? (
          <p style={{ textAlign: 'center', opacity: 0.6, fontSize: 14 }}>
            {isLoggedIn ? 'No games yet.' : 'Sign in to keep a history of your games.'}
          </p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgb(var(--ink-rgb) / 0.12)' }}>
                    <th style={hTh}>Game Status</th>
                    <th style={hTh}>Size</th>
                    <th style={hTh}>Score</th>
                    <th style={hTh}>Start Game</th>
                  </tr>
                </thead>
                <tbody>
                  {gameHistory.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE).map((g, i) => (
                    <tr key={`${g.seed}_${i}`} style={{ borderBottom: '1px solid rgb(var(--ink-rgb) / 0.05)' }}>
                      <td style={hTd}>{g.gameStatus}</td>
                      <td style={hTd}>{g.size}</td>
                      <td style={hTd}>{g.score}</td>
                      <td style={hTd}>
                        <button
                          onClick={() => { startGame(g.seed); setHistoryOpen(false) }}
                          title="Play this seed"
                          style={{ ...btnGhost, padding: '4px 10px', minHeight: 0 }}
                        >
                          ▶
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 10, fontSize: 12 }}>
              <span style={{ opacity: 0.6 }}>
                {page * ROWS_PER_PAGE + 1}–{Math.min((page + 1) * ROWS_PER_PAGE, gameHistory.length)} of {gameHistory.length}
              </span>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ ...btnGhost, padding: '4px 10px', minHeight: 0, opacity: page === 0 ? 0.4 : 1 }}>‹</button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * ROWS_PER_PAGE >= gameHistory.length}
                style={{ ...btnGhost, padding: '4px 10px', minHeight: 0, opacity: (page + 1) * ROWS_PER_PAGE >= gameHistory.length ? 0.4 : 1 }}
              >›</button>
            </div>
          </>
        )}
        <button onClick={() => setHistoryOpen(false)} style={{ ...btnGhost, width: '100%', minHeight: 40, marginTop: 14 }}>
          Close
        </button>
      </Modal>

      <Modal open={newGameOpen} onClose={() => setNewGameOpen(false)}>
        <h2 style={{ textAlign: 'center', fontSize: '1.35rem', margin: '0 0 18px', fontWeight: 800 }}>
          Are you sure? Your game is still in progress!
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { startGame(); setNewGameOpen(false) }} style={{ ...btnFilled, flex: 1, minHeight: 42 }}>
            New Game
          </button>
          <button onClick={() => setNewGameOpen(false)} style={{ ...btnGhost, flex: 1, minHeight: 42 }}>
            Close
          </button>
        </div>
      </Modal>
    </div>
  )
}

const btnFilled: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, border: 'none',
  background: 'var(--primary, #f97316)', color: '#fff', fontWeight: 700, cursor: 'pointer',
}

const btnGhost: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
  border: '1px solid rgb(var(--ink-rgb) / 0.18)', background: 'transparent', color: 'inherit',
}

const hTh: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', fontSize: 11, opacity: 0.6, fontWeight: 600 }
const hTd: React.CSSProperties = { padding: '6px 8px' }

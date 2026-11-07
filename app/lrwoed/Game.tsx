'use client'

import { useEffect, useRef, useState } from 'react'
import moment from 'moment-timezone'
import dictionary from '@/lib/lrwoed/dictionary.json'
import { Clue, clue, describeClue, violation } from '@/lib/lrwoed/clue'
import { decode } from '@/lib/lrwoed/base64'
import { getRandomNonDictionaryWord } from '@/lib/lrwoed/target'
import { describeSeed, dictionarySet, Difficulty, gameName, getSeed, speak, urlParam } from '@/lib/lrwoed/util'
import { getSocket } from '@/lib/socket'
import { Keyboard } from './Keyboard'
import { Row, RowState } from './Row'

enum GameState {
  Playing,
  Won,
  Lost,
}

interface GameProps {
  maxGuesses: number
  hidden: boolean
  difficulty: Difficulty
  colorBlind: boolean
  keyboardLayout: string
}

const minLength = 4
const defaultLength = 5
const maxLength = 11
const limitLength = (n: number) => (n >= minLength && n <= maxLength ? n : defaultLength)

function useLocalStorage<T>(key: string, initial: T): [T, (value: T | ((t: T) => T)) => void] {
  const [current, setCurrent] = useState<T>(initial)

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key)
      if (item) setCurrent(JSON.parse(item))
    } catch {}
  }, [key])

  const setSetting = (value: T | ((t: T) => T)) => {
    try {
      const v: any = value instanceof Function ? (value as (t: T) => T)(current) : value
      setCurrent(v)
      for (let i = 0; i < localStorage.length; i++) {
        const bum = localStorage.key(i)
        if (bum == null) continue
        if (bum.includes('lrwoed')) {
          if (+bum.split('-')[2] !== +key.split('-')[2]) {
            localStorage.removeItem(bum)
            i--
          }
        }
      }
      if (key.includes('lrwoed-hint')) {
        if (
          typeof v === 'string' &&
          (v.includes('Too short') || v.includes('valid words') || v.includes('copied to clipboard'))
        ) {
          return
        }
      }
      window.localStorage.setItem(key, JSON.stringify(v))
    } catch {}
  }
  return [current, setSetting]
}

function parseUrlLength(): number {
  const lengthParam = urlParam('length')
  if (!lengthParam) return defaultLength
  return limitLength(Number(lengthParam))
}

function parseUrlGameNumber(): number {
  const gameParam = urlParam('game')
  if (!gameParam) return 1
  const gameNumber = Number(gameParam)
  return gameNumber >= 1 && gameNumber <= 1000 ? gameNumber : 1
}

function getDaysDiff(): number {
  return moment().diff(moment.tz('2023-05-30', moment.tz.guess()), 'days')
}

export default function Game({ isLoggedIn, ...props }: { isLoggedIn: boolean } & GameProps) {
  const [daysDiff] = useState(getDaysDiff)
  const [seed] = useState(getSeed)
  const [{ initChallenge, challengeError }] = useState(() => {
    let init = ''
    let err = false
    try {
      init = decode(urlParam('challenge') ?? '').toLowerCase()
    } catch (e) {
      console.warn(e)
      err = true
    }
    if (init && !dictionarySet.has(init)) {
      init = ''
      err = true
    }
    return { initChallenge: init, challengeError: err }
  })

  const stateStorageKey = 'lrwoed-result-' + daysDiff
  const guessesStorageKey = 'lrwoed-guesses-' + daysDiff
  const hintStorageKey = 'lrwoed-hint-' + daysDiff

  const [gameState, setGameState] = useLocalStorage<GameState>(stateStorageKey, GameState.Playing)
  const [guesses, setGuesses] = useLocalStorage<string[]>(guessesStorageKey, new Array(0))
  const [currentGuess, setCurrentGuess] = useState<string>('')
  const [challenge] = useState<string>(initChallenge)
  const [wordLength, setWordLength] = useState(initChallenge ? initChallenge.length : parseUrlLength())
  const [gameNumber, setGameNumber] = useState(parseUrlGameNumber())
  const [freshGameEnd, setFreshGameEnd] = useState(false)
  const [target, setTarget] = useState(() => getRandomNonDictionaryWord(seed))
  const [hint, setHint] = useLocalStorage<string>(
    hintStorageKey,
    challengeError ? `Invalid challenge string, playing random game.` : `Make your first guess!`,
  )

  const currentSeedParams = () => `?seed=${seed}&length=${wordLength}&game=${gameNumber}`

  useEffect(() => {
    if (seed) {
      window.history.replaceState({}, document.title, window.location.pathname + currentSeedParams())
    }
  }, [wordLength, gameNumber])

  const tableRef = useRef<HTMLTableElement>(null)

  async function share(copiedHint: string, text?: string) {
    const body = text ? text : ''
    if (/android|iphone|ipad|ipod|webos/i.test(navigator.userAgent) && !/firefox/i.test(navigator.userAgent)) {
      try {
        await navigator.share({ text: body })
        return
      } catch (e) {
        console.warn('navigator.share failed:', e)
      }
    }
    try {
      await navigator.clipboard.writeText(body)
      setHint(copiedHint)
      return
    } catch (e) {
      console.warn('navigator.clipboard.writeText failed:', e)
    }
    setHint(copiedHint)
  }

  const onKey = (key: string) => {
    if (gameState !== GameState.Playing) return
    if (guesses.length === props.maxGuesses) return
    if (/^[a-z]$/i.test(key)) {
      setCurrentGuess((guess) => (guess + key.toLowerCase()).slice(0, wordLength))
      tableRef.current?.focus()
      setHint('')
    } else if (key === 'Backspace') {
      setCurrentGuess((guess) => guess.slice(0, -1))
      setHint('')
    } else if (key === 'Enter') {
      if (currentGuess.length !== wordLength) {
        setHint('Too short')
        return
      }
      if ((dictionary as string[]).includes(currentGuess)) {
        setHint('Not valid words allowed')
        return
      }
      for (const g of guesses) {
        const c = clue(g, target)
        const feedback = violation(props.difficulty, c, currentGuess)
        if (feedback) {
          setHint(feedback)
          return
        }
      }
      setGuesses((guesses) => guesses.concat([currentGuess]))
      setCurrentGuess('')

      const gameOver = (verbed: string) => `You ${verbed}! The answer was ${target.toUpperCase()}. `

      if (currentGuess === target) {
        setHint(gameOver('won'))
        setGameState(GameState.Won)
        setFreshGameEnd(true)
      } else if (guesses.length + 1 === props.maxGuesses) {
        setHint(gameOver('lost'))
        setGameState(GameState.Lost)
        setFreshGameEnd(true)
      } else {
        setHint('')
        speak(describeClue(clue(currentGuess, target)))
      }
    }
  }

  useEffect(() => {
    if (!freshGameEnd) return
    if (gameState === GameState.Playing || !isLoggedIn) return
    const socket = getSocket()
    const payload = {
      score: gameState === GameState.Won ? guesses.length : 0,
      props: {
        maxGuesses: props.maxGuesses,
        difficulty: props.difficulty,
        colorBlind: props.colorBlind,
        keyboardLayout: props.keyboardLayout,
      },
    }
    if (socket.connected) socket.emit('lrwoedScore', payload)
    else {
      socket.once('connect', () => socket.emit('lrwoedScore', payload))
      socket.connect()
    }
  }, [freshGameEnd])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        onKey(e.key)
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [currentGuess, gameState, guesses, target, wordLength])

  const letterInfo = new Map<string, Clue>()
  const tableRows = Array(props.maxGuesses)
    .fill(undefined)
    .map((_, i) => {
      const guess = [...guesses, currentGuess][i] ?? ''
      const cluedLetters = clue(guess, target)
      const lockedIn = i < guesses.length
      if (lockedIn) {
        for (const { clue, letter } of cluedLetters) {
          if (clue === undefined) break
          const old = letterInfo.get(letter)
          if (old === undefined || clue > old) {
            letterInfo.set(letter, clue)
          }
        }
      }
      return (
        <Row
          key={i}
          wordLength={wordLength}
          rowState={lockedIn ? RowState.LockedIn : i === guesses.length ? RowState.Editing : RowState.Pending}
          cluedLetters={cluedLetters}
        />
      )
    })

  return (
    <div className="Game" style={{ display: props.hidden ? 'none' : 'block' }}>
      <div className="Game-options" />
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
      <table className="Game-rows" tabIndex={0} aria-label="Table of guesses" ref={tableRef}>
        <tbody>{tableRows}</tbody>
      </table>
      </div>
      <p
        role="alert"
        style={{
          userSelect: /https?:/.test(hint) ? 'text' : 'none',
          whiteSpace: 'pre-wrap',
        }}
      >
        {hint || ` `}
      </p>
      <Keyboard layout={props.keyboardLayout} letterInfo={letterInfo} onKey={onKey} />
      <div className="Game-seed-info">
        {challenge
          ? 'playing a challenge game'
          : seed
            ? `${describeSeed(seed)}: length ${wordLength}, game ${gameNumber}`
            : `playing today's game (${daysDiff})`}
      </div>
      <p>
        {gameState !== GameState.Playing && (
          <button
            onClick={() => {
              const emoji = props.colorBlind ? ['⬛', '🟦', '🟧'] : ['⬛', '🟨', '🟩']
              const score = gameState === GameState.Lost ? 'X' : guesses.length
              share(
                'Result copied to clipboard!',
                `${gameName} ${daysDiff} ${score}/${props.maxGuesses}\n` +
                  guesses
                    .map((guess) =>
                      clue(guess, target)
                        .map((c) => emoji[c.clue ?? 0])
                        .join(''),
                    )
                    .join('\n') +
                  `\nhttps://counting.gg/lrwoed`,
              )
            }}
          >
            Copy results
          </button>
        )}
      </p>
    </div>
  )
}

import { teamColor as palette } from '@/lib/bingo'

export interface BingoMember {
  userUuid: string
  username: string
  displayName: string
  avatar: string
  discordId?: string | null
  color?: string | null
  teamId: number | null
  teamName: string | null
  role: string
}

export interface BingoTeam {
  id: number
  name: string
  key?: string
}

export interface BingoSquare {
  id: number
  index: number
  isUnlocked: boolean
  mostRecentUnlockerTeamId: number | null
  mostRecentUnlockerUserUuid: string | null
  challengeType?: string
  target?: number | string | null
  rank?: string | null
  threadUuid?: string | null
  threadName?: string | null
  threadTitle?: string | null
  params?: Record<string, unknown> | null
  scoreToBeat?: number
  progressValue?: number
  mostRecentUnlockAt?: number | string | null
}

export interface BingoGameView {
  id: number
  host: string
  status: string
  rank: string
  players: number
  startedAt: string
  finishedAt: string
  members: BingoMember[]
  teams: BingoTeam[]
  squares: BingoSquare[]
  winnerTeamId?: number | null
  winReason?: WinReason | null
  mode?: string
  timeLimitSeconds?: number
  winnerAt?: number | string | null
  winningLines?: Array<{ teamId: number; line: number[] }>
}

export type WinReason = 'bingo' | 'forfeit' | 'squares'

export function outcomeText(winner: string | null | undefined, reason: WinReason | null | undefined): string {
  if (!winner) return 'No winner'
  if (reason === 'bingo') return `${winner} got bingo`
  if (reason === 'forfeit') return `${winner} won by forfeit`
  if (reason === 'squares') return `${winner} won on squares`
  return `${winner} won`
}

export const NEUTRAL_SQUARE = 'rgb(var(--ink-rgb) / 0.07)'

export function teamColor(name: string | null | undefined): string {
  return name ? palette(name.toLowerCase()).fill : 'var(--ink-3)'
}

export interface BingoScore extends BingoTeam {
  squares: number
}

export interface BingoResult {
  scores: BingoScore[]
  winner: BingoScore | null
  outcome: string
  durationMs: number | null
}

export function scoreGame(game: BingoGameView): BingoResult {
  const counts = new Map<number, number>()
  for (const sq of game.squares) {
    if (!sq.isUnlocked || sq.mostRecentUnlockerTeamId == null) continue
    counts.set(
      sq.mostRecentUnlockerTeamId,
      (counts.get(sq.mostRecentUnlockerTeamId) ?? 0) + 1,
    )
  }

  const scores = game.teams
    .map(t => ({ ...t, squares: counts.get(t.id) ?? 0 }))
    .sort((a, b) => b.squares - a.squares)

  const started = Number(game.startedAt)
  const finished = Number(game.finishedAt)
  const durationMs =
    Number.isFinite(started) && Number.isFinite(finished) && finished > started
      ? finished - started
      : null

  const winner = scores.find(s => s.id === game.winnerTeamId) ?? null
  return {
    scores,
    winner,
    outcome: outcomeText(winner?.name, game.winReason),
    durationMs,
  }
}

export function bingoGamePath(gameId: number): string {
  return `/bingo/${gameId}`
}

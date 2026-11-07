import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { scoreGame, type BingoGameView } from '@/lib/bingoResult'
import GameDetailClient from './GameDetailClient'
import BingoClient from '../BingoClient'
import { getSession } from '@/lib/session'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

async function getGame(gameId: string): Promise<BingoGameView | null> {
  const id = Number(gameId)
  if (!Number.isInteger(id) || id <= 0) return null
  try {
    const res = await fetch(`${API}/api/bingo/${id}`, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ gameId: string }> },
): Promise<Metadata> {
  const { gameId } = await params
  const game = await getGame(gameId)
  if (!game) return { title: 'Bingo game | counting.gg' }

  const outcome = game.status === 'finished' ? scoreGame(game).outcome : 'In progress'

  return {
    title: `Bingo #${game.id} | counting.gg`,
    description: `${outcome}. A ${game.rank} bingo game hosted by ${game.host} with ${game.players} players.`,
  }
}

export default async function BingoGamePage(
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params
  const game = await getGame(gameId)
  if (!game) notFound()

  if (game.status === 'finished') return <GameDetailClient game={game} />
  const session = await getSession()
  return (
    <BingoClient
      gameId={game.id}
      meUuid={session?.counter?.uuid ?? session?.uuid ?? null}
      isAdmin={!!session?.counter?.roles?.includes('admin')}
    />
  )
}

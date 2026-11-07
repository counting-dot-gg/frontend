'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BingoBoard from '@/components/bingo/BingoBoard'
import BingoComplete from '@/components/bingo/BingoComplete'
import type { AdminBrush } from '@/components/bingo/BingoAdminPanel'
import BingoLobby from '@/components/bingo/BingoLobby'
import BingoRail from '@/components/bingo/BingoRail'
import { useBingo } from '@/components/bingo/useBingo'
import type { BingoLobbyGame } from '@/lib/bingo'

export default function BingoClient({ meUuid, isAdmin, gameId }: {
  meUuid: string | null
  isAdmin: boolean
  gameId?: number
}) {
  const router = useRouter()
  const bingo = useBingo(true, { gameId: gameId ?? null, follow: false })
  const { lobby, game, activeGameId, error, pending, lastUnlock, send, clearError, dismissFinished } = bingo
  const openGame = (id: number) => router.push(`/bingo/${id}`)
  const closeGame = () => router.push('/bingo')

  useEffect(() => {
    if (gameId == null && game) router.push(`/bingo/${game.game.id}`)
  }, [gameId, game, router])

  const [brush, setBrush] = useState<AdminBrush>(null)
  const [ackedGameId, setAckedGameId] = useState<number | null>(null)
  const [codeFor, setCodeFor] = useState<BingoLobbyGame | null>(null)
  const [code, setCode] = useState('')

  const handleJoin = (target: BingoLobbyGame) => {
    if (target.joinMode === 'code') { setCodeFor(target); setCode(''); return }
    send('bingo_join', { gameId: target.id })
  }

  return (
    <div style={{
      maxWidth: game ? 1180 : 640,
      margin: '0 auto',
      padding: '20px 14px 60px',
      transition: 'max-width 0.25s ease',
    }}>
      <header style={{ marginBottom: 18, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: '-0.01em' }}>Bingo</h1>
        <a href="/bingo/completed" style={{ fontSize: 13, color: '#f97316', fontWeight: 700, textDecoration: 'none' }}>
          Past games →
        </a>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
            padding: '10px 12px', borderRadius: 9, fontSize: 13,
            background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.35)',
            color: '#dc2626',
          }}
        >
          <span style={{ flex: 1 }}>{error}</span>
          <button
            type="button"
            onClick={clearError}
            style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {game && game.game.status === 'finished' && ackedGameId !== game.game.id && (
        <BingoComplete
          state={game}
          meUuid={meUuid}
          onDismiss={() => setAckedGameId(game.game.id)}
        />
      )}

      {gameId != null && !game && !error && (
        <p style={{ fontSize: 14, opacity: 0.6 }}>Loading game #{gameId}…</p>
      )}

      {gameId != null && !game && error && (
        <button type="button" onClick={closeGame} style={{
          padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'transparent', fontWeight: 700, cursor: 'pointer',
        }}>
          Back to games
        </button>
      )}

      {gameId != null && game ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 260px',
            gap: 20,
            alignItems: 'start',
          }}
          className="bingo-layout"
        >
          <style>{`
            @media (max-width: 860px) {
              .bingo-layout { grid-template-columns: minmax(0, 1fr) !important; }
            }
          `}</style>

          <BingoBoard
            state={game}
            lastUnlock={lastUnlock}
            density="large"
            meUuid={meUuid}
            onSquareClick={isAdmin && brush ? index =>
              send('bingo_admin_square', { gameId: game.game.id, index, teamId: brush.teamId })
              : undefined}
          />
          <BingoRail
            state={game}
            meUuid={meUuid}
            isAdmin={isAdmin}
            brush={brush}
            onBrushChange={setBrush}
            pending={pending}
            send={send}
            onLeaveView={closeGame}
          />
        </div>
      ) : gameId == null && (
        <>
          {activeGameId != null && (
            <button type="button" onClick={() => openGame(activeGameId)} style={{
              width: '100%', marginBottom: 14, padding: '12px 14px', borderRadius: 10,
              border: '1px solid var(--primary)', background: 'transparent',
              color: 'var(--primary)', fontWeight: 800, fontSize: 14, cursor: 'pointer', textAlign: 'left',
            }}>
              View active lobby
            </button>
          )}
          <BingoLobby
            lobby={lobby}
            pending={pending}
            onCreate={() => send('bingo_create', { allowJoin: true })}
            isAdmin={isAdmin}
            activeGameId={activeGameId}
            onJoin={handleJoin}
            onOpen={openGame}
          />

          {codeFor && (
            <div style={{
              marginTop: 14, padding: 12, borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--card)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                Game #{codeFor.id} needs a join code
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && code.trim()) {
                      send('bingo_join', { gameId: codeFor.id, joinCode: code.trim() })
                      setCodeFor(null)
                    }
                  }}
                  placeholder="Code"
                  autoFocus
                  style={{
                    flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 7,
                    border: '1px solid var(--border)', background: 'var(--background)',
                    color: 'var(--foreground)', fontSize: 14,
                  }}
                />
                <button
                  type="button"
                  disabled={!code.trim() || pending}
                  onClick={() => { send('bingo_join', { gameId: codeFor.id, joinCode: code.trim() }); setCodeFor(null) }}
                  style={{
                    padding: '8px 16px', borderRadius: 7, border: 'none',
                    background: 'var(--primary)', color: 'var(--primary-foreground)',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Join
                </button>
                <button
                  type="button"
                  onClick={() => setCodeFor(null)}
                  style={{
                    padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--muted-foreground)',
                    fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

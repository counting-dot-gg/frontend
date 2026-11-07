'use client'

import { useCallback, useMemo, useState } from 'react'
import BingoBoard from '@/components/bingo/BingoBoard'
import { BOARD_SIZE, bingoLines, teamColor } from '@/lib/bingo'
import type { BingoGameState, BingoSquare, BoardDensity } from '@/lib/bingo'

const TEAMS = [
  { id: 1, key: 'wave', name: 'Wave', locked: false },
  { id: 2, key: 'blaze', name: 'Blaze', locked: false },
  { id: 3, key: 'radiant', name: 'Radiant', locked: false },
]

const TEMPLATES: Array<Pick<BingoSquare, 'challengeType' | 'target' | 'params'> & { thread?: string }> = [
  { challengeType: 'thread_counts', target: 1000, params: null, thread: 'main' },
  { challengeType: 'split_under_ms', target: 3, params: { maxMs: 4200 }, thread: 'main' },
  { challengeType: 'get_under_ms', target: 1, params: { maxMs: 1500 }, thread: 'main' },
  { challengeType: 'accuracy_rate', target: 1, params: { minAccuracyPercent: 95 } },
  { challengeType: 'roll', target: 1, params: { direction: 'over', threshold: 0.999 } },
  { challengeType: 'lrwoed_score', target: 1, params: { maxScore: 4 } },
  { challengeType: 'number_shuffle_win', target: 1, params: { minSize: 5 } },
  { challengeType: 'counts_in_day', target: 12500, params: null, thread: 'main' },
  { challengeType: 'count_attempts', target: 250, params: null, thread: 'test' },
  { challengeType: 'bars_within_ms', target: 2, params: { maxMs: 60000 }, thread: 'main' },
]

function rng(seed: number) {
  let s = seed || 1
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

interface SimConfig {
  seed: number
  claimedPct: number
  progressPct: number
  winnerTeamId: number
  showBests: boolean
}

function buildSquares(cfg: SimConfig): BingoSquare[] {
  const rand = rng(cfg.seed)
  const squares: BingoSquare[] = []

  for (let i = 0; i < BOARD_SIZE; i++) {
    const t = TEMPLATES[i % TEMPLATES.length]
    const claimed = rand() * 100 < cfg.claimedPct
    const teamId = TEAMS[Math.floor(rand() * TEAMS.length)].id

    const hasProgress = !claimed && rand() * 100 < cfg.progressPct
    const progressValue = claimed
      ? t.target
      : hasProgress
        ? Math.max(1, Math.floor(t.target * rand() * 0.9))
        : 0

    let scoreToBeat: number | undefined
    if (cfg.showBests && !claimed && hasProgress) {
      if (t.challengeType.endsWith('_ms')) scoreToBeat = Number(t.params?.maxMs ?? 5000) * (1 + rand() * 0.4)
      else if (t.challengeType === 'accuracy_rate') scoreToBeat = 80 + rand() * 15
      else if (t.challengeType === 'roll') scoreToBeat = 0.9 + rand() * 0.09
      else if (t.challengeType === 'lrwoed_score') scoreToBeat = 5 + Math.floor(rand() * 4)
      else if (t.challengeType === 'number_shuffle_win') scoreToBeat = 3 + Math.floor(rand() * 3)
    }

    squares.push({
      id: i + 1,
      index: i,
      challengeType: t.challengeType,
      rank: 'bronze',
      threadUuid: t.thread ? `sim-thread-${t.thread}` : null,
      threadName: t.thread ?? null,
      threadTitle: t.thread ? `${t.thread[0].toUpperCase()}${t.thread.slice(1)} Thread` : null,
      target: t.target,
      params: t.params,
      scoreToBeat,
      progressValue,
      isUnlocked: claimed,
      mostRecentUnlockerTeamId: claimed ? teamId : undefined,
      mostRecentUnlockAt: claimed ? 1 : undefined,
    })
  }

  if (cfg.winnerTeamId) {
    const line = bingoLines()[Math.floor(rng(cfg.seed + 7)() * 12)]
    for (const idx of line) {
      squares[idx] = {
        ...squares[idx],
        isUnlocked: true,
        progressValue: squares[idx].target,
        scoreToBeat: undefined,
        mostRecentUnlockerTeamId: cfg.winnerTeamId,
        mostRecentUnlockAt: 1,
      }
    }
  }

  return squares
}

export default function BingoSimClient() {
  const [density, setDensity] = useState<BoardDensity>('compact')
  const [cfg, setCfg] = useState<SimConfig>({
    seed: 1, claimedPct: 35, progressPct: 60, winnerTeamId: 0, showBests: true,
  })
  const [unlock, setUnlock] = useState<{ index: number; unlockSeq: number } | null>(null)
  const [seq, setSeq] = useState(0)
  const [overrides, setOverrides] = useState<Record<number, number>>({})

  const squares = useMemo(() => {
    const base = buildSquares(cfg)
    for (const [idx, teamId] of Object.entries(overrides)) {
      const i = Number(idx)
      base[i] = {
        ...base[i],
        isUnlocked: true,
        progressValue: base[i].target,
        scoreToBeat: undefined,
        mostRecentUnlockerTeamId: teamId,
        mostRecentUnlockAt: 1,
      }
    }
    return base
  }, [cfg, overrides])

  const state: BingoGameState = useMemo(() => ({
    game: {
      id: 0,
      hostUserUuid: 'sim',
      status: cfg.winnerTeamId ? 'finished' : 'running',
      mode: 'bingo',
      rank: 'bronze',
      allowJoin: true,
      joinMode: 'free',
      joinCode: null,
      timeLimitSeconds: 3600,
      minTimeSeconds: null,
      createdAt: 0, startedAt: 0, endsAt: 0, graceEndsAt: 0, finishedAt: 0,
      winnerUserUuid: null,
      winnerTeamId: cfg.winnerTeamId || null,
      winnerAt: null,
      winnerTeamSize: null,
      winnerUsername: null,
      winningLines: cfg.winnerTeamId
        ? bingoLines()
            .filter(line => line.every(i => squares[i]?.mostRecentUnlockerTeamId === cfg.winnerTeamId))
            .map(line => ({ teamId: cfg.winnerTeamId, line }))
        : [],
    },
    members: [],
    teams: TEAMS,
    teamSwapMode: 'open',
    squares,
  }), [cfg, squares])

  const flash = useCallback((index?: number) => {
    const target = index ?? Math.floor(Math.random() * BOARD_SIZE)
    setSeq(n => {
      const next = n + 1
      setUnlock({ index: target, unlockSeq: next })
      return next
    })
  }, [])

  const playWin = useCallback((teamId: number) => {
    const line = bingoLines()[0]
    setCfg(c => ({ ...c, winnerTeamId: 0 }))
    setOverrides({})
    line.forEach((idx, step) => {
      window.setTimeout(() => {
        setOverrides(prev => ({ ...prev, [idx]: teamId }))
        flash(idx)
        if (step === line.length - 1) {
          window.setTimeout(() => setCfg(c => ({ ...c, winnerTeamId: teamId })), 450)
        }
      }, step * 700)
    })
  }, [flash])

  const resetBoard = useCallback(() => {
    setOverrides({})
    setCfg(c => ({ ...c, winnerTeamId: 0 }))
  }, [])


  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 14px 60px' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Bingo simulator</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.65 }}>
          Local only. No game is created and nothing is saved.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: 20, alignItems: 'start' }} className="sim-layout">
        <style>{`@media (max-width: 860px) { .sim-layout { grid-template-columns: minmax(0,1fr) !important; } }`}</style>

        <div style={{
          maxWidth: density === 'mini' ? 220 : density === 'compact' ? 380 : '100%',
        }}>
          <BingoBoard
            state={state}
            lastUnlock={unlock}
            density={density}
          />
          <p style={{ fontSize: 11, opacity: 0.5, marginTop: 8 }}>
            {density === 'mini' && 'Mini: colour and claim only.'}
            {density === 'compact' && 'Compact: width-capped to match the About tab sidebar.'}
            {density === 'large' && 'Large: full width, as on /bingo.'}
          </p>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Group label="Density">
            <Row>
              {(['mini', 'compact', 'large'] as BoardDensity[]).map(d => (
                <Chip key={d} active={density === d} onClick={() => setDensity(d)}>{d}</Chip>
              ))}
            </Row>
          </Group>

          <Group label={`Claimed: ${cfg.claimedPct}%`}>
            <input
              type="range" min={0} max={100} value={cfg.claimedPct}
              onChange={e => setCfg(c => ({ ...c, claimedPct: +e.target.value }))}
              style={{ width: '100%' }}
            />
          </Group>

          <Group label={`In progress: ${cfg.progressPct}%`}>
            <input
              type="range" min={0} max={100} value={cfg.progressPct}
              onChange={e => setCfg(c => ({ ...c, progressPct: +e.target.value }))}
              style={{ width: '100%' }}
            />
          </Group>

          <Group label="Records">
            <Row>
              <Chip active={cfg.showBests} onClick={() => setCfg(c => ({ ...c, showBests: !c.showBests }))}>
                {cfg.showBests ? 'Best scores on' : 'Best scores off'}
              </Chip>
            </Row>
          </Group>

          <Group label="Winning line">
            <Row>
              <Chip active={cfg.winnerTeamId === 0} onClick={resetBoard}>None</Chip>
              {TEAMS.map(t => (
                <Chip
                  key={t.id}
                  active={cfg.winnerTeamId === t.id}
                  color={teamColor(t.key).fill}
                  onClick={() => setCfg(c => ({ ...c, winnerTeamId: t.id }))}
                >
                  {t.name}
                </Chip>
              ))}
            </Row>
          </Group>

          <Group label="Animations">
            <Row>
              <Chip onClick={() => flash()}>Flash a square</Chip>
              <Chip onClick={resetBoard}>Clear</Chip>
            </Row>
            <Row>
              {TEAMS.map(t => (
                <Chip key={t.id} color={teamColor(t.key).fill} onClick={() => playWin(t.id)}>
                  {t.name} wins
                </Chip>
              ))}
            </Row>
          </Group>

          <Group label={`Board seed: ${cfg.seed}`}>
            <Row>
              <Chip onClick={() => setCfg(c => ({ ...c, seed: c.seed + 1 }))}>Reroll</Chip>
              <Chip onClick={() => setCfg(c => ({ ...c, seed: 1 }))}>Reset</Chip>
            </Row>
          </Group>
        </aside>
      </div>
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase',
        opacity: 0.55, marginBottom: 6,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>{children}</div>
}

function Chip({ children, active, color, onClick }: {
  children: React.ReactNode
  active?: boolean
  color?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        border: `1px solid ${active ? (color ?? 'var(--primary)') : 'var(--border)'}`,
        background: active ? (color ?? 'var(--primary)') : 'transparent',
        color: active ? '#fff' : (color ?? 'var(--muted-foreground)'),
      }}
    >
      {children}
    </button>
  )
}

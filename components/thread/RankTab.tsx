'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import {
  type ChallengeLog, type ThreadRankRow, type RankUpdatedDelta,
  type RankLeaderboardSocketEntry, type RankLeaderboardInitialPayload,
  type RankName,
  type RankUpEvent,
  divFloor, divCeil, getCompletionSummary, getChallengeTitle, getProgressLabel, CHALLENGE_BAR_COLOR,
} from '@/lib/rankUtils'
import { RankProgressCard } from '@/components/rank/RankProgressCard'
import { RankLadder } from '@/components/rank/RankLadder'
import { challengeTypeOrder } from '@/lib/rankUtils'
import { loadRankUps, loadScope } from '@/lib/rankCache'
import { ChainSteps } from '@/components/rank/ChainSteps'
import { SpreadBreakdown } from '@/components/rank/SpreadBreakdown'
import { RankLeaderboardMini, type LeaderboardEntry } from '@/components/rank/RankLeaderboardMini'
import { ChallengeCompletionWrapper } from '@/components/rank/ChallengeCompletionWrapper'
import { ThreadCountsChallengeCard } from '@/components/rank/ThreadCountsChallengeCard'
import { SpeedChallengeCard } from '@/components/rank/SpeedChallengeCard'
import { AccuracyMeter } from '@/components/rank/AccuracyMeter'
import { BigProgressBar } from '@/components/rank/BigProgressBar'

import { API } from '@/lib/apiBase'

type ChallengeSlot = {
  key: string
  challengeId: string
  phase: 'progress' | 'completing'
  data: ChallengeLog
  entering: boolean
  firstAppearance: boolean
}

function isFirstAppearance(log: ChallengeLog): boolean {
  return log.entranceSeenAt == null
}

function mergeDelta(existing: ChallengeLog[], deltaLogs: ChallengeLog[], wantCompleted: boolean): ChallengeLog[] {
  const deltaIds = new Set(deltaLogs.map((l) => l.id))
  const kept = existing.filter((l) => !deltaIds.has(l.id))
  const toAdd = deltaLogs.filter((l) => (l.completedAt != null) === wantCompleted)
  return [...kept, ...toAdd]
}

function toLeaderboardEntry(e: RankLeaderboardSocketEntry): LeaderboardEntry {
  return {
    counterUuid: e.counterUuid, username: e.username, name: e.name,
    avatar: e.avatar, discordId: e.discordId, color: e.color,
    rank: e.rank, division: e.division, gg: e.gg, ggTotal: e.ggTotal,
  }
}

const slotOrder = (s: ChallengeSlot) => challengeTypeOrder(s.data?.type)

function dedupeProgress(slots: ChallengeSlot[]): ChallengeSlot[] {
  const seen = new Set<string>()
  const out = slots.filter((s) => {
    if (s.phase !== 'progress') return true
    if (seen.has(s.challengeId)) return false
    seen.add(s.challengeId)
    return true
  })
  return out.length === slots.length ? slots : out
}

function useChallengeSlots(
  progress: ChallengeLog[],
  completions: ChallengeLog[],
  onEntering: (log: ChallengeLog) => void,
) {
  const [slots, setSlots] = useState<ChallengeSlot[]>([])
  const seenCompletedLogIdsRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    let next = slots
    let changed = false

    for (const log of completions) {
      if (seenCompletedLogIdsRef.current.has(log.id)) continue
      seenCompletedLogIdsRef.current.add(log.id)
      changed = true
      const idx = next.findIndex((s) => s.challengeId === log.challengeId)
      if (idx >= 0) {
        const updated = [...next]
        updated[idx] = { ...updated[idx], phase: 'completing', data: log }
        next = updated
      } else {
        if (isFirstAppearance(log)) onEntering(log)
        next = [...next, {
          key: `slot-${log.id}`, challengeId: log.challengeId,
          phase: 'completing', data: log, entering: false, firstAppearance: isFirstAppearance(log),
        }]
      }
    }

    if (!next.some((s) => s.phase === 'completing')) {
      for (const inProgress of progress) {
        if (next.some((s) => s.challengeId === inProgress.challengeId && s.phase === 'progress')) continue
        const firstAppearance = isFirstAppearance(inProgress)
        const entering = firstAppearance && inProgress.progress > 0
        if (firstAppearance) onEntering(inProgress)
        next = [...next, {
          key: inProgress.challengeId, challengeId: inProgress.challengeId,
          phase: 'progress', data: inProgress, entering, firstAppearance,
        }]
        changed = true
      }
    }

    next = next.map((s) => {
      if (s.phase !== 'progress') return s
      const fresh = progress.find((l) => l.challengeId === s.challengeId)
      if (!fresh || fresh === s.data) return s
      changed = true
      return { ...s, data: fresh }
    })
    const deduped = dedupeProgress(next)
    if (deduped !== next) changed = true

    if (changed) setSlots(deduped)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, completions, slots])

  const finishAnimation = (key: string) => {
    setSlots((prev) => prev.filter((s) => s.key !== key))
  }

  const markEntranceAnimated = (key: string) => {
    setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, entering: false } : s)))
  }

  const reset = () => {
    setSlots([])
    seenCompletedLogIdsRef.current = new Set()
  }

  const seedSeenCompletions = (completionIds: number[]) => {
    seenCompletedLogIdsRef.current = new Set(completionIds)
  }

  const setSlotsDirect = (initial: ChallengeSlot[]) => setSlots(initial)

  const ordered = useMemo(() => [...slots].sort((a, b) => slotOrder(a) - slotOrder(b)), [slots])

  return { slots: ordered, setSlotsDirect, finishAnimation, markEntranceAnimated, reset, seedSeenCompletions }
}

function useCountdown(availableAt: number): string {
  const [remaining, setRemaining] = useState(() => Math.max(0, availableAt - Date.now()))
  useEffect(() => {
    if (remaining <= 0) return
    const id = setInterval(() => {
      const ms = Math.max(0, availableAt - Date.now())
      setRemaining(ms)
      if (ms <= 0) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [availableAt])

  const totalSeconds = Math.ceil(remaining / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function LockedChallengeCard({ ch }: { ch: ChallengeLog }) {
  const countdown = useCountdown(Number(ch.availableAt!))
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px', borderRadius: 6, backgroundColor: 'rgb(var(--ink-rgb) / 0.04)',
      opacity: 0.7, gap: 8, border: '1px solid rgb(var(--ink-rgb) / 0.08)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#ccc' }}>
          {getChallengeTitle(ch)}
        </span>
        <span style={{ fontSize: '0.75rem', color: '#888' }}>
          Available in {countdown}
        </span>
      </div>
      <span style={{ fontSize: '0.75rem', color: '#888', whiteSpace: 'nowrap' }}>
        +{ch.ggReward} GG
      </span>
    </div>
  )
}

function renderChallengeCard(
  key: string,
  ch: ChallengeLog,
  isComplete: boolean,
  isAnimating: boolean,
  onAnimationDone: () => void,
  entranceAnimate?: boolean,
  onEntranceAnimationDone?: () => void,
  firstAppearance?: boolean,
) {
  const isAccuracy = ch.type === 'accuracy_rate'
  const isSpeed = ch.type === 'split_under_ms' || ch.type === 'get_under_ms' || ch.type === 'bars_within_ms'
  const windowSize = ch.params?.windowSize ?? ch.target
  const minAccuracyPct = ch.params?.minAccuracyPercent ?? 100
  const displayGgReward = isComplete ? Math.round(ch.ggAwarded || ch.ggReward) : ch.ggReward
  const summary = isComplete || isAnimating ? getCompletionSummary(ch) : undefined

  if (isSpeed && ch.params?.maxMs != null) {
    return (
      <ChallengeCompletionWrapper
        key={key} challengeId={key} ggReward={displayGgReward}
        completedCount={isComplete ? 1 : 0} isComplete={isComplete}
        rank={ch.rank} sequencePosition={ch.sequencePosition} sequenceTotal={ch.sequenceTotal}
        onAnimationDone={onAnimationDone} forcePlay={isAnimating} summary={summary} firstAppearance={firstAppearance}
      >
        {(anim) => (
          <SpeedChallengeCard
            type={ch.type as 'split_under_ms' | 'get_under_ms' | 'bars_within_ms'}
            maxMs={ch.params!.maxMs} target={ch.target} progress={ch.progress}
            hidden={anim} entranceAnimate={entranceAnimate} onEntranceAnimationDone={onEntranceAnimationDone}
          />
        )}
      </ChallengeCompletionWrapper>
    )
  }

  if (isAccuracy) {
    return (
      <ChallengeCompletionWrapper
        key={key} challengeId={key} ggReward={displayGgReward}
        completedCount={isComplete ? 1 : 0} isComplete={isComplete}
        rank={ch.rank} sequencePosition={ch.sequencePosition} sequenceTotal={ch.sequenceTotal}
        onAnimationDone={onAnimationDone} forcePlay={isAnimating} summary={summary} firstAppearance={firstAppearance}
      >
        {() => (
          <AccuracyMeter window={ch.accuracyWindow} windowSize={windowSize} minAccuracyPercent={minAccuracyPct} />
        )}
      </ChallengeCompletionWrapper>
    )
  }

  return (
    <ThreadCountsChallengeCard
      key={key} challengeId={key} type={ch.type} params={ch.params}
      ggReward={displayGgReward} progress={ch.progress} target={ch.target}
      isComplete={isComplete} completedCount={isComplete ? 1 : 0}
      rank={ch.rank} sequencePosition={ch.sequencePosition} sequenceTotal={ch.sequenceTotal}
      onAnimationDone={onAnimationDone} forcePlay={isAnimating} summary={summary}
      entranceAnimate={entranceAnimate} onEntranceAnimationDone={onEntranceAnimationDone}
      firstAppearance={firstAppearance}
    />
  )
}

interface RankTabProps {
  threadName: string
  threadUUID?: string
  threadTitle?: string
  socket: Socket | null
  username?: string
  isLoggedIn: boolean
}

const REPLAY_BAR_DURATION_MS = 3000

type ChallengeLogWithChainKey = ChallengeLog & { chainKey: string }

type ReplayStep =
  | { kind: 'bar'; log: ChallengeLogWithChainKey; fromProgress: number }
  | { kind: 'completion'; log: ChallengeLogWithChainKey }
  | { kind: 'rankup'; event: RankUpEvent }

const RANKUP_LANE = '__rankup__'

function laneKeyFor(step: ReplayStep): string {
  return step.kind === 'rankup' ? RANKUP_LANE : step.log.chainKey
}

function buildReplayLanes(
  completions: ChallengeLogWithChainKey[],
  rankUps: RankUpEvent[],
): Record<string, ReplayStep[]> {
  const completionSteps = completions.map(log => ({
    at: Number(log.completedAt ?? 0),
    step: { kind: 'bar' as const, log, fromProgress: 0 },
  }))
  const rankUpSteps = rankUps.map(event => ({
    at: Number(event.createdAt),
    step: { kind: 'rankup', event } as ReplayStep,
  }))

  const lanes: Record<string, ReplayStep[]> = {}
  for (const entry of [...completionSteps, ...rankUpSteps].sort((a, b) => a.at - b.at)) {
    const key = laneKeyFor(entry.step)
    ;(lanes[key] ??= []).push(entry.step)
  }
  return lanes
}

function useRankReplay(username: string | undefined, isMounted: React.RefObject<boolean>) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'done'>('idle')
  const [lanes, setLanes] = useState<Record<string, ReplayStep[]>>({})
  const [current, setCurrent] = useState<Record<string, ReplayStep>>({})
  const playedAnythingRef = useRef(false)

  const markSeen = (path: string) => {
    if (!username) return
    fetch(`${API}/api/rank/replay/${encodeURIComponent(username)}/${path}`, {
      method: 'POST', credentials: 'include',
    }).catch(() => {})
  }

  const start = (completions: ChallengeLogWithChainKey[], rankUps: RankUpEvent[]) => {
    const built = buildReplayLanes(completions, rankUps)
    if (Object.keys(built).length === 0) {
      playedAnythingRef.current = false
      setStatus('done')
      return
    }
    playedAnythingRef.current = true
    setLanes(built)
    setStatus('playing')
  }

  const enqueueRankUps = (rankUps: RankUpEvent[]) => {
    if (rankUps.length === 0) return
    playedAnythingRef.current = true
    setLanes(prev => {
      const existing = prev[RANKUP_LANE] ?? []
      const steps: ReplayStep[] = rankUps.map(event => ({ kind: 'rankup' as const, event }))
      return { ...prev, [RANKUP_LANE]: [...existing, ...steps] }
    })
    setStatus(prev => (prev === 'playing' ? prev : 'playing'))
  }

  useEffect(() => {
    if (status !== 'playing') return
    const laneKeys = Array.from(new Set([...Object.keys(lanes), ...Object.keys(current)]))
    if (laneKeys.length === 0) { setStatus('done'); return }

    const nextLanes = { ...lanes }
    const nextCurrent = { ...current }
    let changed = false
    for (const key of laneKeys) {
      if (nextCurrent[key] != null) continue
      const queue = nextLanes[key]
      if (!queue || queue.length === 0) { delete nextLanes[key]; continue }
      const [next, ...rest] = queue
      nextCurrent[key] = next
      if (rest.length > 0) nextLanes[key] = rest
      else delete nextLanes[key]
      changed = true
    }
    if (changed) {
      setLanes(nextLanes)
      setCurrent(nextCurrent)
    } else if (Object.keys(nextCurrent).length === 0 && Object.keys(nextLanes).length === 0) {
      setStatus('done')
    }
  }, [status, lanes, current])

  const onBarDone = (laneKey: string) => {
    setCurrent(prev => {
      const step = prev[laneKey]
      if (!step || step.kind !== 'bar') return prev
      return { ...prev, [laneKey]: { kind: 'completion', log: step.log } }
    })
  }

  const onCompletionDone = (laneKey: string, log: ChallengeLogWithChainKey) => {
    markSeen(`seen-completion/${log.id}`)
    if (!isMounted.current) return
    setCurrent(prev => {
      const { [laneKey]: _removed, ...rest } = prev
      return rest
    })
  }

  const onRankUpDone = (event: RankUpEvent) => {
    markSeen(`seen-rankup/${event.id}`)
    if (!isMounted.current) return
    setCurrent(prev => {
      const { [RANKUP_LANE]: _removed, ...rest } = prev
      return rest
    })
  }

  const skip = (laneKey: string) => {
    const step = current[laneKey]
    if (!step) return
    if (step.kind === 'bar') onBarDone(laneKey)
    else if (step.kind === 'completion') onCompletionDone(laneKey, step.log)
    else if (step.kind === 'rankup') onRankUpDone(step.event)
  }

  const reset = () => {
    setStatus('idle')
    setLanes({})
    setCurrent({})
  }

  return { status, current, start, enqueueRankUps, onBarDone, onCompletionDone, onRankUpDone, skip, reset, playedAnythingRef }
}

function ReplayBarStep({ startPct, log, onDone }: {
  startPct: number
  log: ChallengeLogWithChainKey
  onDone: () => void
}) {
  const [pct, setPct] = useState(startPct)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setPct(100))
    return () => cancelAnimationFrame(raf)
  }, [])
  const currentValue = (pct / 100) * log.target
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--ink-2)' }}>
        {getChallengeTitle(log)}
      </div>
      <BigProgressBar
        pct={pct}
        label={getProgressLabel(log, currentValue)}
        color={CHALLENGE_BAR_COLOR}
        replayDurationMs={REPLAY_BAR_DURATION_MS}
        onAnimationDone={onDone}
      />
    </div>
  )
}

export default function RankTab({ threadName, threadUUID, threadTitle, socket, username, isLoggedIn }: RankTabProps) {
  const [rankProgress, setRankProgress] = useState<ChallengeLog[]>([])
  const [rankCompletions, setRankCompletions] = useState<ChallengeLog[]>([])
  const [sitewideProgress, setSitewideProgress] = useState<ChallengeLog[]>([])
  const [sitewideCompletions, setSitewideCompletions] = useState<ChallengeLog[]>([])
  const [rankThreadRow, setRankThreadRow] = useState<ThreadRankRow | null>(null)
  const [sitewideRankRow, setSitewideRankRow] = useState<ThreadRankRow | null>(null)
  const [rankScopeTab, setRankScopeTab] = useState<'thread' | 'sitewide'>('thread')
  const [ladderOpen, setLadderOpen] = useState(false)
  const [openChain, setOpenChain] = useState<string | null>(null)

  const prefetchSeason = sitewideRankRow?.seasonId ?? rankThreadRow?.seasonId ?? null
  useEffect(() => {
    if (prefetchSeason == null) return
    void loadScope(null, prefetchSeason)
    if (threadUUID) void loadScope(threadUUID, prefetchSeason)
    if (username) {
      void loadRankUps(username, null, prefetchSeason)
      if (threadUUID) void loadRankUps(username, threadUUID, prefetchSeason)
    }
  }, [prefetchSeason, threadUUID, username])
  const rankScopeTabRef = useRef(rankScopeTab)
  rankScopeTabRef.current = rankScopeTab
  const [sitewideLeaderboard, setSitewideLeaderboard] = useState<LeaderboardEntry[]>([])
  const [threadLeaderboard, setThreadLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const loadedRef = useRef(false)
  const isMountedRef = useRef(true)
  const liveSinceFetchRef = useRef(new Map<string, LeaderboardEntry>())
  const hasWatchedSitewideRef = useRef(false)
  const fetchSeq = useRef(0)

  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  const markEntranceSeenImmediately = (log: ChallengeLog) => {
    if (!username) return
    fetch(`${API}/api/rank/replay/${username}/seen-entrance/${log.id}`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(console.error)
  }

  const markCompletionSeen = (logId: number) => {
    if (!username) return
    fetch(`${API}/api/rank/replay/${username}/seen-completion/${logId}`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(console.error)
  }

  const markRankUpSeen = (eventId: number) => {
    if (!username) return
    fetch(`${API}/api/rank/replay/${username}/seen-rankup/${eventId}`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(console.error)
  }

  const threadReplay = useRankReplay(username, isMountedRef)
  const sitewideReplay = useRankReplay(username, isMountedRef)

  const threadReplayingIds = useMemo(
    () => new Set(
      Object.values(threadReplay.current)
        .filter((s): s is Extract<ReplayStep, { kind: 'bar' | 'completion' }> => s.kind !== 'rankup')
        .map(s => s.log.challengeId),
    ),
    [threadReplay.current],
  )
  const sitewideReplayingIds = useMemo(
    () => new Set(
      Object.values(sitewideReplay.current)
        .filter((s): s is Extract<ReplayStep, { kind: 'bar' | 'completion' }> => s.kind !== 'rankup')
        .map(s => s.log.challengeId),
    ),
    [sitewideReplay.current],
  )

  const threadCompletionsForSlots = useMemo(
    () => rankCompletions.filter(l => !threadReplayingIds.has(l.challengeId)),
    [rankCompletions, threadReplayingIds],
  )
  const sitewideCompletionsForSlots = useMemo(
    () => sitewideCompletions.filter(l => !sitewideReplayingIds.has(l.challengeId)),
    [sitewideCompletions, sitewideReplayingIds],
  )

  const threadRankUpStep = threadReplay.current[RANKUP_LANE]
  const sitewideRankUpStep = sitewideReplay.current[RANKUP_LANE]
  const pendingRankUpThread = threadRankUpStep?.kind === 'rankup'
    ? { rank: threadRankUpStep.event.toRank, division: threadRankUpStep.event.toDivision }
    : null
  const pendingRankUpSitewide = sitewideRankUpStep?.kind === 'rankup'
    ? { rank: sitewideRankUpStep.event.toRank, division: sitewideRankUpStep.event.toDivision }
    : null

  const threadSlots = useChallengeSlots(rankProgress, threadCompletionsForSlots, markEntranceSeenImmediately)
  const sitewideSlots = useChallengeSlots(sitewideProgress, sitewideCompletionsForSlots, markEntranceSeenImmediately)

  const applyProfileData = (data: any) => {
    if (!threadUUID) return
    const ranks: ThreadRankRow[] = data?.ranks ?? []
    const challengeProgress: ChallengeLog[] = data.challengeProgress ?? []
    const recentCompletions: ChallengeLog[] = data.recentCompletions ?? []
    const threadProg = challengeProgress.filter((l) => l.threadUuid === threadUUID)
    const threadComp = recentCompletions.filter((l) => l.threadUuid === threadUUID)
    const sitewideProg = challengeProgress.filter((l) => l.threadUuid == null)
    const sitewideComp = recentCompletions.filter((l) => l.threadUuid == null)

    threadSlots.seedSeenCompletions(threadComp.map((l: ChallengeLog) => l.id))
    threadSlots.setSlotsDirect(threadProg.map((l: ChallengeLog) => {
      const fa = isFirstAppearance(l)
      if (fa) markEntranceSeenImmediately(l)
      return { key: l.challengeId, challengeId: l.challengeId, phase: 'progress' as const, data: l, entering: fa && l.progress > 0, firstAppearance: fa }
    }))
    setRankProgress(threadProg)
    setRankCompletions(threadComp)
    setRankThreadRow(ranks.find((r) => r.threadUuid === threadUUID) ?? null)

    sitewideSlots.seedSeenCompletions(sitewideComp.map((l: ChallengeLog) => l.id))
    sitewideSlots.setSlotsDirect(sitewideProg.map((l: ChallengeLog) => {
      const fa = isFirstAppearance(l)
      if (fa) markEntranceSeenImmediately(l)
      return { key: l.challengeId, challengeId: l.challengeId, phase: 'progress' as const, data: l, entering: fa && l.progress > 0, firstAppearance: fa }
    }))
    setSitewideProgress(sitewideProg)
    setSitewideCompletions(sitewideComp)
    setSitewideRankRow(ranks.find((r) => r.threadUuid == null) ?? null)
  }

  const fetchProfile = () => {
    if (!username) return
    const seq = ++fetchSeq.current
    setLoading(true)
    fetch(`${API}/api/rank/counter/${username}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(data => {
        if (!isMountedRef.current || seq !== fetchSeq.current) return
        applyProfileData(data)
        setLoaded(true)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        if (isMountedRef.current && seq === fetchSeq.current) setLoading(false)
      })
  }

  const fetchedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    setRankProgress([]); setRankCompletions([])
    setSitewideProgress([]); setSitewideCompletions([])
    setRankThreadRow(null); setSitewideRankRow(null)
    setLoaded(false); setLoading(false)
    threadSlots.reset(); sitewideSlots.reset()
    threadReplay.reset(); sitewideReplay.reset()
    loadedRef.current = false
    hasWatchedSitewideRef.current = false
    if (username && isLoggedIn) {
      const key = `${threadName}|${username}`
      if (fetchedKeyRef.current !== key) {
        fetchedKeyRef.current = key
        loadedRef.current = true
        fetchProfile()
        fetchReplayBacklog()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadName, username])

  const fetchReplayBacklog = () => {
    if (!username) return
    const seq = fetchSeq.current
    const scoped = threadUUID ? `?threadUuid=${encodeURIComponent(threadUUID)}` : ''
    fetch(`${API}/api/rank/replay/${encodeURIComponent(username)}${scoped}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(data => {
        if (!isMountedRef.current || seq !== fetchSeq.current) return
        const completions: ChallengeLogWithChainKey[] = data.unseenCompletions ?? []
        const rankUps: RankUpEvent[] = data.unseenRankUps ?? []
        threadReplay.start(
          completions.filter(l => l.threadUuid === threadUUID),
          rankUps.filter(e => e.threadUuid === threadUUID),
        )
        sitewideReplay.start(
          completions.filter(l => l.threadUuid == null),
          rankUps.filter(e => e.threadUuid == null),
        )
      })
      .catch(() => {})
  }

  useEffect(() => {
    if (threadReplay.status === 'done' && threadReplay.playedAnythingRef.current) {
      threadReplay.playedAnythingRef.current = false
      fetchProfile()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadReplay.status])

  useEffect(() => {
    if (sitewideReplay.status === 'done' && sitewideReplay.playedAnythingRef.current) {
      sitewideReplay.playedAnythingRef.current = false
      fetchProfile()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitewideReplay.status])

  useEffect(() => {
    if (!socket) return
    const handler = (delta: RankUpdatedDelta) => {
      if (!loadedRef.current) return
      if (delta.threadUuid != null && delta.threadUuid !== threadUUID) return

      const threadDelta = [...delta.progress, ...delta.completions].filter((l) => l.threadUuid === threadUUID)
      const sitewideDelta = [...delta.progress, ...delta.completions].filter((l) => l.threadUuid == null)

      if (threadDelta.length > 0) {
        setRankProgress((prev) => mergeDelta(prev, threadDelta, false))
        setRankCompletions((prev) => mergeDelta(prev, threadDelta, true))
      }
      if (delta.threadRank) setRankThreadRow(delta.threadRank)

      if (sitewideDelta.length > 0) {
        setSitewideProgress((prev) => mergeDelta(prev, sitewideDelta, false))
        setSitewideCompletions((prev) => mergeDelta(prev, sitewideDelta, true))
      }
      if (delta.sitewideRank) setSitewideRankRow(delta.sitewideRank)

      const threadRankUps = delta.rankUpEvents.filter((e) => e.threadUuid === threadUUID)
      if (threadRankUps.length > 0) threadReplay.enqueueRankUps(threadRankUps)
      const sitewideRankUps = delta.rankUpEvents.filter((e) => e.threadUuid == null)
      if (sitewideRankUps.length > 0) sitewideReplay.enqueueRankUps(sitewideRankUps)
    }
    socket.on('rank_updated', handler)
    return () => { socket.off('rank_updated', handler) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, threadUUID])

  useEffect(() => {
    if (!socket) return
    const handleInitial = (payload: RankLeaderboardInitialPayload) => {
      if (!isMountedRef.current) return
      const entries = payload.entries.map(toLeaderboardEntry)
      if (payload.threadUuid === null) setSitewideLeaderboard(entries)
      else if (payload.threadUuid === threadUUID) setThreadLeaderboard(entries)
    }
    const handleUpdated = (entry: RankLeaderboardSocketEntry) => {
      if (!isMountedRef.current) return
      const mapped = toLeaderboardEntry(entry)
      if (entry.threadUuid === null) {
        setSitewideLeaderboard((prev) => [...prev.filter((e) => e.counterUuid !== entry.counterUuid), mapped].sort((a, b) => b.ggTotal - a.ggTotal))
      } else if (entry.threadUuid === threadUUID) {
        liveSinceFetchRef.current.set(mapped.counterUuid, mapped)
        setThreadLeaderboard((prev) => [...prev.filter((e) => e.counterUuid !== entry.counterUuid), mapped].sort((a, b) => b.ggTotal - a.ggTotal))
      }
    }
    socket.on('rank_leaderboard_initial', handleInitial)
    socket.on('rank_leaderboard_updated', handleUpdated)
    return () => {
      socket.off('rank_leaderboard_initial', handleInitial)
      socket.off('rank_leaderboard_updated', handleUpdated)
    }
  }, [socket, threadUUID])

  useEffect(() => {
    if (!threadName) return
    let cancelled = false
    liveSinceFetchRef.current = new Map()
    fetch(`${API}/api/rank/thread/${encodeURIComponent(threadName)}?minGG=1`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !isMountedRef.current || !Array.isArray(data?.entries)) return
        const fetched: LeaderboardEntry[] = data.entries.map(toLeaderboardEntry)
        const byUuid = new Map(fetched.map((e) => [e.counterUuid, e]))
        for (const e of liveSinceFetchRef.current.values()) byUuid.set(e.counterUuid, e)
        setThreadLeaderboard([...byUuid.values()].sort((a, b) => b.ggTotal - a.ggTotal))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [threadName])

  useEffect(() => {
    if (rankScopeTab !== 'sitewide') return
    if (!socket) return
    if (hasWatchedSitewideRef.current) return
    hasWatchedSitewideRef.current = true
    socket.emit('watch_rank_sitewide')
  }, [rankScopeTab, socket])

  useEffect(() => {
    if (!socket) return
    const handleReconnect = () => {
      if (loadedRef.current && username) fetchProfile()
      if (rankScopeTabRef.current === 'sitewide') socket.emit('watch_rank_sitewide')
    }
    socket.on('reconnect', handleReconnect)
    return () => { socket.off('reconnect', handleReconnect) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, username])

  const hasThreadRank = rankThreadRow != null || (loaded && rankProgress.length > 0)
  const hasAnyRank = hasThreadRank || sitewideRankRow != null
  const activeSlots = rankScopeTab === 'thread' ? threadSlots : sitewideSlots
  const activeBoard = rankScopeTab === 'thread' ? threadLeaderboard : sitewideLeaderboard
  const activeReplay = rankScopeTab === 'thread' ? threadReplay : sitewideReplay

  const renderReplay = (replay: typeof threadReplay) =>
    Object.entries(replay.current).map(([laneKey, step]) => {
      if (step.kind === 'rankup') return null

      const skippable = (key: string, node: React.ReactNode) => (
        <div
          key={key}
          onClick={() => replay.skip(laneKey)}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); replay.skip(laneKey) }
          }}
          title="Click to skip"
          style={{ cursor: 'pointer' }}
        >
          {node}
        </div>
      )

      if (step.kind === 'bar') {
        const { log, fromProgress } = step
        const pct = log.target > 0 ? Math.min(100, Math.round((fromProgress / log.target) * 100)) : 0
        return skippable(
          `replay-bar-${log.id}`,
          <ReplayBarStep
            startPct={pct}
            log={log}
            onDone={() => replay.onBarDone(laneKey)}
          />,
        )
      }
      return skippable(
        `replay-completion-${step.log.id}`,
        renderChallengeCard(
          `replay-completion-inner-${step.log.id}`,
          step.log,
          true,
          true,
          () => replay.onCompletionDone(laneKey, step.log),
        ),
      )
    })

  const renderSlotList = (
    slotList: ChallengeSlot[],
    finishAnimation: (key: string) => void,
    markEntranceAnimated: (key: string) => void,
  ) =>
    slotList.map((slot) => {
      if (slot.phase === 'progress' && slot.data.availableAt != null && Number(slot.data.availableAt) > Date.now()) {
        return <LockedChallengeCard key={slot.key} ch={slot.data} />
      }
      const isCompleting = slot.phase === 'completing'
      const card = renderChallengeCard(
        slot.key, slot.data, isCompleting, isCompleting,
        () => {
          if (isCompleting) markCompletionSeen(slot.data.id)
          finishAnimation(slot.key)
        },
        slot.entering,
        () => markEntranceAnimated(slot.key),
        slot.firstAppearance,
      )
      if (isCompleting) return card
      const open = openChain === slot.key
      return (
        <div key={slot.key}>
          <div
            role="button"
            tabIndex={0}
            aria-expanded={open}
            onClick={() => setOpenChain(open ? null : slot.key)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenChain(open ? null : slot.key) } }}
            style={{ cursor: 'pointer' }}
          >
            {card}
          </div>
          {slot.data.type === 'thread_spread' && <SpreadBreakdown log={slot.data} />}
          {open && <ChainSteps log={slot.data} />}
        </div>
      )
    })

  if (!isLoggedIn) {
    return (
      <div style={{ padding: 16, fontSize: 13, color: '#666' }}>
        Log in to see your rank progress.
      </div>
    )
  }

  if (loading && !loaded) {
    return <div style={{ padding: 16, fontSize: 13, color: '#555' }}>Loading rank…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
      {hasAnyRank && (
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgb(var(--ink-rgb) / 0.08)' }}>
          {(['thread', 'sitewide'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setRankScopeTab(tab)}
              style={{
                padding: '4px 12px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: rankScopeTab === tab ? 700 : 400,
                color: rankScopeTab === tab ? 'var(--brand-ink)' : 'var(--ink-3)',
                borderBottom: rankScopeTab === tab ? '2px solid #f97316' : '2px solid transparent',
                marginBottom: -1, textTransform: 'capitalize',
              }}
            >
              {tab === 'thread' ? 'Thread' : 'Sitewide'}
            </button>
          ))}
        </div>
      )}

      {hasAnyRank && (
        <div
          role="button"
          tabIndex={0}
          aria-expanded={ladderOpen}
          onClick={() => setLadderOpen(v => !v)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLadderOpen(v => !v) } }}
          style={{ cursor: 'pointer' }}
        >
          {rankScopeTab === 'thread'
            ? hasThreadRank && rankThreadRow && (
              <RankProgressCard
                rank={rankThreadRow.rank} division={rankThreadRow.division} gg={rankThreadRow.gg}
                divFloor={divFloor(rankThreadRow.rank, rankThreadRow.division)}
                divCeil={divCeil(rankThreadRow.rank, rankThreadRow.division)}
                threadName={threadTitle ?? threadName}
                pendingRankUp={pendingRankUpThread}
                onRankUpAnimationDone={() => { if (threadRankUpStep?.kind === 'rankup') threadReplay.onRankUpDone(threadRankUpStep.event) }}
              />
            )
            : sitewideRankRow && (
              <RankProgressCard
                rank={sitewideRankRow.rank} division={sitewideRankRow.division} gg={sitewideRankRow.gg}
                divFloor={divFloor(sitewideRankRow.rank, sitewideRankRow.division)}
                divCeil={divCeil(sitewideRankRow.rank, sitewideRankRow.division)}
                threadName="Sitewide"
                pendingRankUp={pendingRankUpSitewide}
                onRankUpAnimationDone={() => { if (sitewideRankUpStep?.kind === 'rankup') sitewideReplay.onRankUpDone(sitewideRankUpStep.event) }}
              />
            )}
          {ladderOpen && (() => {
            const row = rankScopeTab === 'thread' ? rankThreadRow : sitewideRankRow
            return row ? <RankLadder rank={row.rank} division={row.division} gg={row.gg} username={username} scope={row.threadUuid} seasonId={row.seasonId} /> : null
          })()}
        </div>
      )}

      {Object.keys(activeReplay.current).length > 0 && (
        <div style={{ borderTop: '1px solid rgb(var(--ink-rgb) / 0.06)', paddingTop: 8 }}>
          {renderReplay(activeReplay)}
        </div>
      )}

      {activeSlots.slots.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ borderTop: '1px solid rgb(var(--ink-rgb) / 0.06)', paddingTop: 8 }}>
            {renderSlotList(activeSlots.slots, activeSlots.finishAnimation, activeSlots.markEntranceAnimated)}
          </div>
        </div>
      )}

      {activeSlots.slots.length === 0 && loaded && Object.keys(activeReplay.current).length === 0 && (
        <div style={{ fontSize: 12, color: '#555' }}>
          No challenges yet
        </div>
      )}

      {activeBoard.some((e) => e.ggTotal > 0) && (
        <div style={{ borderTop: '1px solid rgb(var(--ink-rgb) / 0.06)', paddingTop: 8 }}>
          <RankLeaderboardMini entries={activeBoard} meUsername={username} scope={rankScopeTab === 'thread' ? (threadUUID ?? null) : null} />
        </div>
      )}

      {loaded && !hasAnyRank && (
        <div style={{ fontSize: 12, color: '#555' }}>
          No rank progress yet
        </div>
      )}
    </div>
  )
}

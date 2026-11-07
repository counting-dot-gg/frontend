'use client'

import { useEffect, useRef, useState } from 'react'
import { getSocket } from '@/lib/socket'
import { pushFeat, readLatestFeat, subscribeFeats, useFeatsEnabled, type Feat, type FeatPerson } from '@/lib/feats'
import { requestOpenChat } from '@/lib/chatPanel'
import { RANK_LABELS, RANK_ORDER, type RankName } from '@/lib/rankUtils'
import { FeatLine } from './FeatsPanel'

const HOLD_MS = 5000
const HOLD_QUEUED_MS = 2500
const FADE_MS = 250

interface RankUpEvent {
  id?: number
  fromRank: RankName
  fromDivision: number
  toRank: RankName
  toDivision: number
}

export default function FeatTicker({ me, enabled }: { me: FeatPerson | null; enabled: boolean }) {
  const on = useFeatsEnabled(enabled)
  const meRef = useRef(me)
  useEffect(() => { meRef.current = me }, [me])
  const [shown, setShown] = useState<Feat | null>(null)
  const [visible, setVisible] = useState(false)
  const queue = useRef<Feat[]>([])
  const busy = useRef(false)
  const timers = useRef<number[]>([])

  useEffect(() => {
    if (!on) return
    const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
    const pump = () => {
      if (busy.current) return
      const next = queue.current.shift()
      if (!next) return
      busy.current = true
      setShown(next)
      later(() => setVisible(true), 20)
      later(() => {
        setVisible(false)
        later(() => {
          busy.current = false
          setShown(null)
          pump()
        }, FADE_MS)
      }, queue.current.length ? HOLD_QUEUED_MS : HOLD_MS)
    }

    let last = readLatestFeat()
    const unsubscribe = subscribeFeats(() => {
      const f = readLatestFeat()
      if (!f || f === last) return
      last = f
      queue.current.push(f)
      pump()
    })

    const socket = getSocket()

    const you = (): FeatPerson | null => {
      const m = meRef.current
      return m && { uuid: m.uuid, name: m.name, username: m.username, color: m.color, discordId: m.discordId, avatar: m.avatar }
    }

    const onLevelUp = (d: { level?: number | string }) => {
      if (d?.level == null) return
      pushFeat({ key: `level:${d.level}`, who: you(), text: `Level ${d.level}`, href: '/rewards' })
    }

    const onCelebration = (d: {
      message?: string; kind?: string; n?: number; threadName?: string; threadTitle?: string
      counter?: FeatPerson
    }) => {
      if (!d?.message) return
      const n = d.n?.toLocaleString()
      const text = d.kind === 'posts' ? `Post #${n}` : d.kind ? `Count #${n}` : d.message
      pushFeat({
        key: `celebration:${d.message}`,
        who: d.kind ? d.counter ?? null : null,
       
        text,
        where: d.kind === 'thread_counts' ? d.threadTitle : d.kind ? 'Sitewide' : undefined,
        href: d.threadName ? `/thread/${d.threadName}` : undefined,
      })
    }

    const onMilestone = (d: {
      kind?: string; n?: number; best?: number; ms?: number; threadName?: string; threadTitle?: string
    }) => {
      if (d?.kind === 'daily_best' && d.n) {
        pushFeat({ key: `daily:${new Date().toDateString()}`, who: you(), text: `New PB: ${d.n.toLocaleString()} counts` })
      } else if ((d?.kind === 'split_pb' || d?.kind === 'speed_pb') && d.ms && d.threadName) {
        pushFeat({
          key: `${d.kind}:${d.threadName}:${d.ms}`,
          who: you(),
          text: `New ${d.kind === 'split_pb' ? 'split' : 'speed'} PB: ${runTime(d.ms)}`,
          where: d.threadTitle ?? d.threadName,
          href: `/thread/${d.threadName}`,
        })
      }
    }

    const onCounterMilestone = (d: { kind?: string; n?: number; years?: number; counter?: FeatPerson }) => {
      const c = d?.counter
      if (!c?.uuid) return
      const href = c.username ? `/counter/${c.username}` : undefined
      if (d.kind === 'lifetime_counts' && d.n) {
        pushFeat({ key: `lifetime:${c.uuid}:${d.n}`, who: c, text: `${d.n.toLocaleString()} counts`, href })
      } else if (d.kind === 'anniversary' && d.years) {
        pushFeat({
          key: `anniversary:${c.uuid}:${new Date().getFullYear()}`, who: c,
          text: `${d.years} year${d.years === 1 ? '' : 's'} on counting.gg`, href,
        })
      }
    }

    const onThreadRecord = (d: {
      kind?: string; ms?: number; threadName?: string; threadTitle?: string; counters?: FeatPerson[]
    }) => {
      if (!d?.ms || !d.threadName || (d.kind !== 'split' && d.kind !== 'speed')) return
      pushFeat({
        key: `record:${d.kind}:${d.threadName}:${d.ms}`,
        who: d.counters ?? [],
        text: `New ${d.kind} record: ${runTime(d.ms)}`,
        where: d.threadTitle ?? d.threadName,
        href: `/thread/${d.threadName}`,
      })
    }

    const onJoined = (d: { counter?: FeatPerson }) => {
      if (!d?.counter?.uuid) return
      pushFeat({ key: `joined:${d.counter.uuid}`, who: d.counter, text: 'joined', href: d.counter.username ? `/counter/${d.counter.username}` : undefined })
    }

    const onRankUpdated = (d: { threadName?: string | null; threadTitle?: string | null; rankUpEvents?: RankUpEvent[] }) => {
      for (const e of d?.rankUpEvents ?? []) {
        const up = RANK_ORDER.indexOf(e.toRank) - RANK_ORDER.indexOf(e.fromRank) || e.toDivision - e.fromDivision
        if (up <= 0 || !RANK_LABELS[e.toRank] || (e.toRank === 'bronze' && e.toDivision === 1)) continue
        const div = e.toRank === 'peak' ? '' : ` ${'I'.repeat(e.toDivision)}`
        pushFeat({
          key: `rank:${e.id ?? `${d.threadName}:${e.toRank}:${e.toDivision}`}`,
          who: you(),
          rank: { rank: e.toRank, division: e.toDivision },
          text: `${RANK_LABELS[e.toRank]}${div}`,
          where: d.threadName ? d.threadTitle ?? d.threadName : 'Sitewide',
          href: d.threadName ? `/thread/${d.threadName}` : undefined,
        })
      }
    }

    socket.on('levelUp', onLevelUp)
    socket.on('celebration', onCelebration)
    socket.on('milestone', onMilestone)
    socket.on('rank_updated', onRankUpdated)
    socket.on('counter_joined', onJoined)
    socket.on('counter_milestone', onCounterMilestone)
    socket.on('thread_record', onThreadRecord)
    return () => {
      unsubscribe()
      timers.current.forEach(clearTimeout)
      socket.off('levelUp', onLevelUp)
      socket.off('celebration', onCelebration)
      socket.off('milestone', onMilestone)
      socket.off('rank_updated', onRankUpdated)
      socket.off('counter_joined', onJoined)
      socket.off('counter_milestone', onCounterMilestone)
      socket.off('thread_record', onThreadRecord)
    }
  }, [on])

  if (!shown || !on) return null
  return (
    <button
      onClick={() => requestOpenChat('feats')}
      style={{
        position: 'fixed', left: 12, bottom: 12, zIndex: 1450,
        display: 'flex', alignItems: 'center',
        maxWidth: 'min(460px, calc(100vw - 24px))', padding: '5px 14px 5px 6px', overflow: 'hidden',
        background: 'var(--surface-raised)', color: 'var(--ink-1)',
        border: '1px solid rgb(var(--ink-rgb) / 0.12)', borderRadius: 999,
        boxShadow: '0 4px 16px rgb(var(--shadow-rgb) / 0.25)',
        fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(8px)',
        transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
      }}
    >
      <FeatLine feat={shown} />
    </button>
  )
}

function runTime(ms: number): string {
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(3)}s`
  const m = Math.floor(s / 60)
  return `${m}:${(s - m * 60).toFixed(3).padStart(6, '0')}`
}

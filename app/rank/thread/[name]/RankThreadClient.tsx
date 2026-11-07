'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { RankIconBadge } from '@/components/rank/RankIconBadge'
import ThresholdLeaderboard, { type ThresholdKind } from '@/components/rank/ThresholdLeaderboard'
import { RANK_ORDER, formatClockTime, getChallengeTitle, type RankName } from '@/lib/rankUtils'
import { avatarUrl } from '@/lib/counterUtils'

export interface LeaderboardEntry {
  counterUuid: string
  username: string
  name: string
  avatar?: string
  discordId?: string
  color?: string
  rank: RankName
  division: 1 | 2 | 3
  gg: number
  ggTotal: number
}

export interface RankChallenge {
  id: string
  type: string
  rank: RankName
  target: number
  ggReward: number
  params: Record<string, any> | null
}

export interface VolumeBucket { bucket: string | number; count: number }

function VolumeHistogram({ data }: { data: VolumeBucket[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="mt-2">
      <p className="mb-1 text-[11px] text-muted-foreground">
        Challenge completion volume (7-day buckets)
      </p>
      <div className="flex h-8 items-end gap-0.5">
        {data.map((d, i) => (
          <div
            key={i}
            title={`${d.bucket}: ${d.count}`}
            className="min-w-1 flex-1 rounded-t-sm bg-primary/70"
            style={{ height: `${Math.max(4, Math.round((d.count / max) * 32))}px` }}
          />
        ))}
      </div>
      <div className="mt-0.5 flex justify-between text-[11px] text-muted-foreground">
        <span>{String(data[0]?.bucket ?? '')}</span>
        <span>{String(data[data.length - 1]?.bucket ?? '')}</span>
      </div>
    </div>
  )
}

const PAGE = 50

export default function RankThreadClient({
  threadName, threadTitle, season, entries, challenges, volume,
}: {
  threadName: string
  threadTitle: string
  season: { id: number; name: string; endedAt: string | null } | null
  entries: LeaderboardEntry[]
  challenges: RankChallenge[]
  volume: VolumeBucket[]
}) {
  const [rankFilter, setRankFilter] = useState<RankName | null>(null)
  const [metric, setMetric] = useState<ThresholdKind>('split_under_ms')
  const [shown, setShown] = useState(PAGE)

  const ranksPresent = useMemo(
    () => Array.from(new Set(challenges.map(c => c.rank)))
      .sort((a, b) => RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b)),
    [challenges],
  )

  const filtered = rankFilter ? challenges.filter(c => c.rank === rankFilter) : challenges

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/rank" className="text-xs font-semibold text-primary hover:underline underline-offset-4">
          ← Rank
        </Link>

        <h1 className="mt-3 text-3xl font-bold tracking-tight">{threadTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {season
            ? <><strong className="text-foreground">{season.name}</strong>{season.endedAt == null ? ' · active' : ''}</>
            : 'No season data.'}
          {' · '}
          <Link href={`/thread/${encodeURIComponent(threadName)}`} className="text-primary hover:underline underline-offset-4">
            open thread
          </Link>
        </p>

        <h2 className="mt-8 mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Leaderboard
        </h2>
        {entries.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            {challenges.length === 0
              ? 'This thread has no rank challenges, so there is no leaderboard for it. Ranks are earned by completing challenges, and none have been set up here yet.'
              : 'No one has been ranked on this thread yet — the leaderboard fills in as counters are assigned challenges here.'}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="w-12 px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Counter</th>
                    <th className="px-3 py-2 font-semibold">Rank</th>
                    <th className="px-3 py-2 text-right font-semibold">GG (total)</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.slice(0, shown).map((e, i) => (
                    <tr key={e.counterUuid} className="border-b border-border/60 last:border-b-0 hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2">
                        <Link href={`/counter/${encodeURIComponent(e.username)}`} className="flex items-center gap-2 group">
                          {e.discordId && e.avatar && avatarUrl({ discordId: e.discordId, avatar: e.avatar }) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={avatarUrl({ discordId: e.discordId, avatar: e.avatar })}
                              alt=""
                              className="size-7 shrink-0 rounded-full bg-muted object-cover"
                            />
                          ) : (
                            <span className="size-7 shrink-0 rounded-full bg-muted" />
                          )}
                          <span
                            className="font-medium group-hover:underline underline-offset-4"
                            style={{ color: e.color ? `color-mix(in oklch, ${e.color} 60%, var(--foreground))` : undefined }}
                          >
                            {e.name || e.username}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <RankIconBadge rank={e.rank} division={e.division} size="mini" />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {e.ggTotal.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown < entries.length && (
              <button
                onClick={() => setShown(s => s + PAGE)}
                className="mt-3 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
              >
                Show more ({entries.length - shown} left)
              </button>
            )}
          </>
        )}

        <div className="mt-10 mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Leaderboards
          </h2>
          <select
            value={metric}
            onChange={e => setMetric(e.target.value as ThresholdKind)}
            aria-label="Leaderboard metric"
            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-primary transition-colors"
          >
            <option value="split_under_ms">Split speed</option>
            <option value="get_under_ms">Get speed</option>
            <option value="daily_counts">Best daily count</option>
          </select>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <ThresholdLeaderboard kind={metric} threadName={threadName} />
        </div>

        <div className="mt-10 mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Challenges
          </h2>
          {ranksPresent.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setRankFilter(null)}
                className={
                  'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ' +
                  (rankFilter == null ? 'border-primary bg-primary text-white' : 'border-border hover:bg-muted')
                }
              >
                All
              </button>
              {ranksPresent.map(r => (
                <button
                  key={r}
                  onClick={() => setRankFilter(r)}
                  className={
                    'rounded-full border px-2.5 py-1 text-xs font-semibold capitalize transition-colors ' +
                    (rankFilter === r ? 'border-primary bg-primary text-white' : 'border-border hover:bg-muted')
                  }
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>

        {challenges.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            No challenges configured for this thread.
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map(c => {
              const isSpeed = c.type === 'split_under_ms' || c.type === 'get_under_ms'
              const thresholdMs: number | null = c.params?.maxMs ?? null
              const verb = c.type === 'split_under_ms' ? 'split' : 'get'

              return (
                <li key={c.id} className="rounded-xl border border-border bg-card px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <RankIconBadge rank={c.rank} division={1} size="mini" />
                      {isSpeed && thresholdMs != null ? (
                        <span className="flex items-baseline gap-1.5">
                          <span className="text-xl font-bold leading-tight tabular-nums">
                            {formatClockTime(thresholdMs)}
                          </span>
                          <span className="text-xs text-muted-foreground">Count a {verb} in under</span>
                        </span>
                      ) : (
                        <span className="text-sm font-semibold">{getChallengeTitle(c as any)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground tabular-nums">×{c.target}</span>
                      <span className="text-sm font-bold text-primary tabular-nums">+{c.ggReward} GG</span>
                    </div>
                  </div>


                  {c.type === 'accuracy_rate' && c.params && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {c.params.minAccuracyPercent ?? 100}% accuracy over last {c.params.windowSize ?? 20} count attempts
                      {c.params.validationType ? ` (${c.params.validationType})` : ''}
                    </p>
                  )}

                  {c.type === 'thread_counts' && volume.length > 0 && <VolumeHistogram data={volume} />}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}

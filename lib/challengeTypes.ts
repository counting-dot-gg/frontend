import type { RankName } from './rankUtils'
import { RANK_ORDER } from './rankUtils'

export const LRWOED_PSEUDO_THREAD_UUID = '00000000-0000-0000-0000-000000000001'
export const NUMBER_SHUFFLE_PSEUDO_THREAD_UUID = '00000000-0000-0000-0000-000000000002'

export const PSEUDO_THREAD_LABELS: Record<string, string> = {
  [LRWOED_PSEUDO_THREAD_UUID]: 'lrwoed',
  [NUMBER_SHUFFLE_PSEUDO_THREAD_UUID]: 'Number Shuffle',
}

export const CHALLENGE_TYPES = [
  'thread_counts',
  'split_under_ms',
  'get_under_ms',
  'bars_within_ms',
  'roll',
  'lrwoed_score',
  'number_shuffle_win',
  'accuracy_rate',
  'counts_in_day',
  'count_attempts',
  'time_counting',
  'thread_breadth',
  'strict_counts',
  'gets_landed',
  'assists_landed',
  'thread_spread',
  'fast_gets',
  'lrwoed_days',
  'daily_shuffle_wins',
]

export const CHALLENGE_TYPE_NAMES: Record<string, string> = {
  thread_counts: 'Thread Counts',
  split_under_ms: 'Split Speed',
  get_under_ms: 'Get Speed',
  bars_within_ms: 'Bars Speed',
  roll: 'Dice Roll',
  lrwoed_score: 'lrwoed Score',
  number_shuffle_win: 'Number Shuffle',
  accuracy_rate: 'Accuracy Rate',
  counts_in_day: 'Daily Counts',
  count_attempts: 'Count Attempts',
  time_counting: 'Time Counting',
  thread_breadth: 'Thread Breadth',
  strict_counts: 'Non-Double Counts',
  gets_landed: 'Gets',
  assists_landed: 'Non-Double Assists',
  thread_spread: 'Thread Spread',
  fast_gets: 'Speedruns',
  lrwoed_days: 'Daily lrwoed Completions',
  daily_shuffle_wins: 'Daily Number Shuffle Wins',
  bingo_win: 'Bingo Win',
  bingo_complete_squares: 'Bingo Squares',
}

export function getPrettyTypeName(type: string): string {
  return (
    CHALLENGE_TYPE_NAMES[type] ??
    type
      .replace(/_/g, ' ')
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  )
}

export const SITEWIDE_ONLY_TYPES = new Set<string>([
  'thread_breadth',
  'strict_counts',
  'gets_landed',
  'assists_landed',
  'thread_spread',
  'fast_gets',
  'lrwoed_days',
  'daily_shuffle_wins',
])

export const THREAD_REQUIRED_TYPES = new Set([
  'split_under_ms',
  'get_under_ms',
  'bars_within_ms',
  'count_attempts',
  'roll',
  'lrwoed_score',
  'number_shuffle_win',
])

export const RANK_OPTIONS: RankName[] = RANK_ORDER

export type RankSeason = {
  id: number
  name: string
  startedAt: number
  endedAt: number | null
}

export type RankChallenge = {
  id: string
  type: string
  rank: RankName
  sequence: number
  ggReward: number
  rewardType: 'gg' | 'auto_jump'
  target: number
  params: Record<string, any> | null
  threadUuid: string | null
  bingoCategory: string | null
  seasonId: number
  clonedFromId: string | null
  baseReassignmentWaitMs: number | null
  createdAt: number
  completionCount?: number
  topCompleters?: Array<{
    counterUuid: string
    username: string
    name: string
    completedAt: number
    ggAwarded: number
  }>
}

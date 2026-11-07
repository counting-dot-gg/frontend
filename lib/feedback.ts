export type FeedbackKind = 'bug' | 'feature'
export type FeedbackStatus = 'open' | 'planned' | 'done' | 'declined'

export interface FeedbackAuthor {
  uuid: string
  username: string
  name: string
  color: string
  discordId: string
  avatar: string
  emoji: string | null
}

export interface FeedbackComment {
  id: number
  body: string | null
  deleted: boolean
  createdAt: number
  author: FeedbackAuthor
}

export interface FeedbackItem {
  id: number
  title: string
  body: string
  kind: FeedbackKind
  status: FeedbackStatus
  isPrivate: boolean
  score: number
  createdAt: number
  updatedAt: number
  resolvedAt: number
  staffNote: string | null
  author: FeedbackAuthor
  hasVoted: boolean
  commentCount: number
  comments?: FeedbackComment[]
}

export interface FeedbackList {
  items: FeedbackItem[]
  total: number
  offset: number
  limit: number
}

export const STATUS_META: Record<FeedbackStatus, { label: string; fill: string; ink: string }> = {
  open:     { label: 'Open',     fill: 'rgba(148,163,184,0.18)', ink: '#94a3b8' },
  planned:  { label: 'Planned',  fill: 'rgba(59,130,246,0.18)',  ink: '#60a5fa' },
  done:     { label: 'Done',     fill: 'rgba(34,197,94,0.18)',   ink: 'var(--success)' },
  declined: { label: 'Declined', fill: 'rgba(220,38,38,0.15)',   ink: 'var(--danger)' },
}

export const KIND_META: Record<FeedbackKind, {
  label: string
  prompt: string
  hint: string
}> = {
  bug: {
    label: 'Bug',
    prompt: 'Issue',
    hint: 'What is the issue? How did it happen?',
  },
  feature: {
    label: 'Feature',
    prompt: 'Idea',
    hint: 'Share your idea here!',
  },
}

import { API } from '@/lib/apiBase'

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api/feedback/${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.message || `Request failed (${res.status})`)
  }
  return res.json()
}

export const feedbackApi = {
  list: (params: Record<string, string> = {}) =>
    call<FeedbackList>(`list?${new URLSearchParams(params)}`),

  get: (id: number) => call<FeedbackItem>(`item/${id}`),

  create: (input: { title: string; body: string; kind: FeedbackKind; isPrivate: boolean }) =>
    call<FeedbackItem>('create', { method: 'POST', body: JSON.stringify(input) }),

  vote: (id: number) =>
    call<{ id: number; score: number; hasVoted: boolean }>(`vote/${id}`, { method: 'POST' }),

  comment: (id: number, body: string) =>
    call<FeedbackItem>(`comment/${id}`, { method: 'POST', body: JSON.stringify({ body }) }),

  deleteComment: (commentId: number) =>
    call<FeedbackItem>(`comment/${commentId}/delete`, { method: 'POST' }),

  moderate: (id: number, input: { status?: FeedbackStatus; isPrivate?: boolean; staffNote?: string }) =>
    call<FeedbackItem>(`moderate/${id}`, { method: 'POST', body: JSON.stringify(input) }),
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/New_York',
})

export function feedbackDate(timestamp: number | string): string {
  const ms = Number(timestamp)
  if (!Number.isFinite(ms) || ms <= 0) return ''
  return DATE_FMT.format(new Date(ms))
}

'use client'

import { useState, useCallback, useMemo } from 'react'
import BingoAboutPanel from '@/components/bingo/BingoAboutPanel'
import { renderLongform, hasVisibleProse } from '@/lib/markdown'
import type { Socket } from 'socket.io-client'
import dynamic from 'next/dynamic'
import { minXPForLevel } from '@/lib/levels'
import { notify } from '@/lib/toast'
import type { ActiveMacroRuntime } from '@/lib/macroRuntime'

const LatencyChartHost = dynamic(() => import('./LatencyChartHost'), { ssr: false })
const RollVisualizerHost = dynamic(() => import('./RollVisualizerHost'), { ssr: false })
const MacrosPanel = dynamic(() => import('./MacrosPanel'), { ssr: false })

import { API } from '@/lib/apiBase'

export interface ThreadInfo {
  uuid: string
  name: string
  title: string
  description: string
  rules: string
  threadOfTheDay: boolean
  countBans: string[]
  autoValidated: boolean
  allowDoublePosts: boolean
  resetOnMistakes: boolean
  validationType: string
  firstValidCount: string
  locked: boolean
  color1?: string
  color2?: string
  postBans: string[]
  updatableBy: string[]
  countsPerSplit?: number
  splitsPerGet?: number
  splitOffset?: number
}

interface AboutTabProps {
  thread: ThreadInfo | undefined
  userUUID?: string
  userXP?: number
  userRoles?: string[]
  isLoggedIn: boolean
  socket?: Socket | null
  onMacroRuntimeChange?: (runtime: ActiveMacroRuntime | null) => void
}

function Prose({ text }: { text: string }) {
  const html = useMemo(() => renderLongform(text), [text])
  return <div className="md-longform" dangerouslySetInnerHTML={{ __html: html }} />
}

function MiscInfo({ thread, children }: { thread: ThreadInfo; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '8px 10px',
          background: 'rgb(var(--ink-rgb) / 0.04)', border: 'none', borderRadius: 6,
          cursor: 'pointer', color: 'var(--ink-3)', fontSize: 13, textAlign: 'left',
        }}
      >
        <span>Info</span>
        <span style={{ fontSize: 11 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[
            ['Auto validated', thread.autoValidated.toString()],
            ['Double counting', thread.allowDoublePosts.toString()],
            ['Reset on mistakes', thread.resetOnMistakes.toString()],
            ['Validation type', thread.validationType],
            ['First count', thread.firstValidCount],
            ['UUID', thread.uuid],
          ].map(([label, val]) => (
            <span key={label} style={{ fontSize: 9, color: 'var(--ink-3)', fontFamily: 'monospace' }}>
              {label}: {val}
            </span>
          ))}
        </div>
      )}
      <div style={open ? undefined : { display: 'none' }}>{children}</div>
    </div>
  )
}

function CommunityNotes({
  thread, userXP, onUpdate,
}: {
  thread: ThreadInfo
  userXP?: number
  onUpdate: (newRules: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(thread.rules ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canEdit = (userXP ?? 0) >= minXPForLevel(20)

  const save = useCallback(async () => {
    if (!draft.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/thread/updateCommunityNotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ threadUUID: thread.uuid, update: draft }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      onUpdate(draft)
      setEditing(false)
    } catch (e: any) {
      setError(`Failed to save: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }, [draft, thread.uuid, onUpdate])

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>Notes</span>
        {canEdit && !editing && (
          <button onClick={() => { setDraft(thread.rules ?? ''); setEditing(true) }}
            style={iconBtn}>✎</button>
        )}
        {canEdit && editing && (
          <>
            <button onClick={save} disabled={saving}
              style={{ ...iconBtn, color: 'var(--success-ink)' }}>✓</button>
            <button onClick={() => { setEditing(false); setDraft(thread.rules ?? '') }}
              style={{ ...iconBtn, color: 'var(--danger)' }}>✕</button>
          </>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            maxLength={16384}
            rows={12}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgb(var(--ink-rgb) / 0.05)',
              border: '1px solid rgb(var(--ink-rgb) / 0.12)',
              borderRadius: 6, padding: '8px 10px',
              fontSize: 13, color: 'var(--ink-1)', outline: 'none',
              fontFamily: 'monospace', resize: 'vertical',
            }}
          />
          {error && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{error}</div>}
        </>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          {hasVisibleProse(thread.rules) ? (
            <Prose text={thread.rules} />
          ) : (
            <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>No notes yet.</span>
          )}
        </div>
      )}
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: '1px solid rgb(var(--ink-rgb) / 0.12)',
  borderRadius: 4, cursor: 'pointer', color: 'var(--ink-3)',
  fontSize: 14, padding: '2px 7px', lineHeight: 1.4,
}

export default function AboutTab({ thread, userUUID, userXP, userRoles, isLoggedIn, socket, onMacroRuntimeChange }: AboutTabProps) {
  const [localRules, setLocalRules] = useState<string | null>(null)
  const effectiveRules = localRules ?? thread?.rules ?? ''
  const effectiveThread = thread ? { ...thread, rules: effectiveRules } : undefined

  if (!thread) {
    return <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Loading…</div>
  }

  const isBanned = userUUID && thread.countBans?.includes(userUUID)

  return (
    <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>

      <BingoAboutPanel isLoggedIn={isLoggedIn} meUuid={userUUID ?? null} threadUuid={thread?.uuid ?? null} />

      {isBanned && (
        <div style={bannerStyle('#f97316')}>
          ⚠ You can no longer count in this thread. You can still post, but count attempts will be stricken.
        </div>
      )}

      {thread.threadOfTheDay && (
        <div style={{ marginBottom: 16, padding: '10px 12px', background: 'rgba(249,115,22,0.12)', borderRadius: 8, border: '1px solid rgba(249,115,22,0.3)' }}>
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 14 }}>🔥 Thread of the Day</div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
            Normal counts are worth twice as much XP today. Counting improves your odds in the daily lottery. Good luck!
          </div>
        </div>
      )}

      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>About</div>
      <div style={{ color: 'var(--ink-2)', marginBottom: 8 }}>
        {hasVisibleProse(thread.description) ? (
          <Prose text={thread.description} />
        ) : (
          <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>No description.</span>
        )}
      </div>

      {effectiveThread && (
        <CommunityNotes
          key={effectiveThread.uuid}
          thread={effectiveThread}
          userXP={isLoggedIn ? userXP : undefined}
          onUpdate={setLocalRules}
        />
      )}

      {(userRoles?.includes('mod') || userRoles?.includes('admin')) && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ModButton
            threadUUID={thread.uuid}
            action="modToggleThreadLock"
            label={thread.locked ? 'Unlock thread' : 'Lock thread'}
            done={thread.locked ? 'Thread unlocked' : 'Thread locked'}
          />
          <ModButton
            threadUUID={thread.uuid}
            action="modToggleSilentThreadLock"
            label={thread.locked ? 'Unlock (silent)' : 'Lock (silent)'}
            done={thread.locked ? 'Thread unlocked silently' : 'Thread locked silently'}
          />
        </div>
      )}

      <MacrosPanel threadUUID={thread.uuid} isLoggedIn={isLoggedIn} onRuntimeChange={onMacroRuntimeChange} />

      <RollVisualizerHost threadName={thread.name} socket={socket ?? null} />

      <MiscInfo thread={thread}>
        <LatencyChartHost socket={socket ?? null} />
      </MiscInfo>
    </div>
  )
}

function bannerStyle(color: string): React.CSSProperties {
  return {
    marginBottom: 12, padding: '8px 12px', fontSize: 12,
    background: `${color}18`, border: `1px solid ${color}55`,
    borderRadius: 6, color: 'var(--ink-1)',
  }
}

function ModButton({ threadUUID, action, label, done }: {
  threadUUID: string
  action: string
  label: string
  done: string
}) {
  const [busy, setBusy] = useState(false)
  const click = async () => {
    setBusy(true)
    try {
      const res = await fetch(`${API}/api/thread/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ thread_uuid: threadUUID }),
      })
      if (res.ok) {
        notify(done, { kind: 'success', icon: '🔒' })
      } else {
        notify('That didn’t work', {
          kind: 'error',
          detail: res.status === 404
            ? 'The server refused it: check you still have moderator access.'
            : `The server returned ${res.status}.`,
        })
      }
    } catch {
      notify('Couldn’t reach the server', { kind: 'error' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <button onClick={click} disabled={busy} style={{
      padding: '6px 12px', borderRadius: 6, border: '1px solid rgb(var(--ink-rgb) / 0.15)',
      background: 'rgb(var(--ink-rgb) / 0.06)', color: 'var(--ink-2)', fontSize: 12,
      cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
    }}>
      {label}
    </button>
  )
}

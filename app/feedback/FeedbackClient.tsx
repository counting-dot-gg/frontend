'use client'

import { useCallback, useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { avatarUrl } from '@/lib/counterUtils'
import { renderMarkdown } from '@/lib/markdown'
import {
  feedbackApi, feedbackDate, KIND_META, STATUS_META,
  type FeedbackItem, type FeedbackKind, type FeedbackStatus,
} from '@/lib/feedback'

type Sort = 'top' | 'new'

type StatusFilter = FeedbackStatus | 'all' | 'active'
const ACTIVE_STATUSES: FeedbackStatus[] = ['open', 'planned']

interface Props {
  meUuid: string | null
  isStaff: boolean
  canPost: boolean
}

export default function FeedbackClient({ meUuid, isStaff, canPost }: Props) {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [kind, setKind] = useState<FeedbackKind | 'all'>('all')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [sort, setSort] = useState<Sort>('top')
  const [mine, setMine] = useState(false)

  const [openId, setOpenId] = useState<number | null>(null)
  const [detail, setDetail] = useState<FeedbackItem | null>(null)
  const [composing, setComposing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { sort, limit: '100' }
      if (kind !== 'all') params.kind = kind
      if (status === 'active') params.status = ACTIVE_STATUSES.join(',')
      else if (status !== 'all') params.status = status
      if (mine) params.mine = 'true'
      const data = await feedbackApi.list(params)
      setItems(data.items)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load feedback.')
    } finally {
      setLoading(false)
    }
  }, [kind, status, sort, mine])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (openId == null) { setDetail(null); return }
    setDetail(null)
    let cancelled = false
    feedbackApi.get(openId)
      .then(d => { if (!cancelled) setDetail(d) })
      .catch(() => { if (!cancelled) setOpenId(null) })
    return () => { cancelled = true }
  }, [openId])

  const merge = (updated: FeedbackItem) => {
    setItems(prev => prev.map(i => (i.id === updated.id ? { ...i, ...updated } : i)))
    setDetail(prev => (prev && prev.id === updated.id ? updated : prev))
  }

  const vote = async (item: FeedbackItem) => {
    try {
      const res = await feedbackApi.vote(item.id)
      merge({ ...item, score: res.score, hasVoted: res.hasVoted })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not vote.')
    }
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '22px 14px 60px' }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: '-0.01em' }}>Feedback</h1>
      </header>

      {canPost ? (
        composing ? (
          <Composer
            onCancel={() => setComposing(false)}
            onCreated={item => { setComposing(false); setItems(prev => [item, ...prev]); setOpenId(item.id) }}
            onError={setError}
          />
        ) : (
          <button
            type="button"
            onClick={() => setComposing(true)}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
              background: 'var(--primary)', color: 'var(--primary-foreground)',
              fontWeight: 800, fontSize: 15, cursor: 'pointer', marginBottom: 18,
            }}
          >
            + Submit feedback
          </button>
        )
      ) : (
        <div style={{
          padding: '10px 12px', borderRadius: 9, marginBottom: 18, fontSize: 13,
          border: '1px solid var(--border)', background: 'var(--card)', opacity: 0.8,
        }}>
          Log in to submit feedback and vote.
        </div>
      )}

      {error && (
        <div role="alert" style={{
          display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14,
          padding: '9px 12px', borderRadius: 8, fontSize: 13,
          background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.35)', color: 'var(--danger)',
        }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer' }}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, marginBottom: 4 }}>
        <Pills
          value={kind}
          onPick={v => setKind(v as FeedbackKind | 'all')}
          options={[{ value: 'all', label: 'All' }, { value: 'bug', label: 'Bugs' }, { value: 'feature', label: 'Features' }]}
        />
        <Divider />
        <Pills
          value={sort}
          onPick={v => setSort(v as Sort)}
          options={[{ value: 'top', label: 'Top' }, { value: 'new', label: 'New' }]}
        />
        <Divider />
        <Pills
          value={status}
          onPick={v => setStatus(v as StatusFilter)}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'open', label: 'Open' },
            { value: 'planned', label: 'Planned' },
            { value: 'done', label: 'Done' },
            { value: 'all', label: 'Any' },
          ]}
        />
        {meUuid && (
          <>
            <Divider />
            <Pills value={mine ? 'mine' : ''} onPick={() => setMine(v => !v)} options={[{ value: 'mine', label: 'Mine' }]} />
          </>
        )}
      </div>

      {loading ? (
        <p style={{ fontSize: 13, opacity: 0.6 }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ fontSize: 14, opacity: 0.6 }}>Nothing here yet. Be the first to file something.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(item => (
            <Row
              key={item.id}
              item={item}
              expanded={openId === item.id}
              detail={detail && detail.id === item.id ? detail : null}
              canPost={canPost}
              isStaff={isStaff}
              meUuid={meUuid}
              onToggle={() => setOpenId(prev => (prev === item.id ? null : item.id))}
              onVote={() => vote(item)}
              onUpdated={merge}
              onError={setError}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Divider() {
  return <span style={{ width: 1, background: 'var(--border)', flexShrink: 0, margin: '2px 2px' }} />
}

function Pills({ options, value, onPick }: {
  options: Array<{ value: string; label: string }>
  value: string
  onPick: (v: string) => void
}) {
  return (
    <>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onPick(opt.value)}
            style={{
              flexShrink: 0, padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap',
              border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
              background: active ? 'var(--primary)' : 'transparent',
              color: active ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </>
  )
}

function Row({ item, expanded, detail, canPost, isStaff, meUuid, onToggle, onVote, onUpdated, onError }: {
  item: FeedbackItem
  expanded: boolean
  detail: FeedbackItem | null
  canPost: boolean
  isStaff: boolean
  meUuid: string | null
  onToggle: () => void
  onVote: () => void
  onUpdated: (item: FeedbackItem) => void
  onError: (msg: string) => void
}) {
  const st = STATUS_META[item.status] ?? STATUS_META.open
  const kd = KIND_META[item.kind] ?? KIND_META.bug

  return (
    <article style={{
      borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <button
          type="button"
          onClick={onVote}
          disabled={!canPost}
          aria-pressed={item.hasVoted}
          aria-label={item.hasVoted ? 'Remove your vote' : 'Vote for this'}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 1, width: 52, flexShrink: 0, border: 'none', borderRight: '1px solid var(--border)',
            background: item.hasVoted ? 'rgba(249,115,22,0.14)' : 'transparent',
            color: item.hasVoted ? '#f97316' : 'var(--muted-foreground)',
            cursor: canPost ? 'pointer' : 'default',
          }}
        >
          <span style={{ fontSize: 12, lineHeight: 1 }}>▲</span>
          <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{item.score}</span>
        </button>

        <button
          type="button"
          onClick={onToggle}
          style={{
            flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'none',
            padding: '10px 12px', cursor: 'pointer', color: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Badge fill="rgba(148,163,184,0.14)" ink="var(--muted-foreground)">{kd.label}</Badge>
            <span style={{ fontWeight: 700, fontSize: 14, overflowWrap: 'anywhere' }}>{item.title}</span>
            <Badge fill={st.fill} ink={st.ink}>{st.label}</Badge>
            {item.isPrivate && <Badge fill="rgba(148,163,184,0.16)" ink="#94a3b8">🔒 Private</Badge>}
          </div>
          <div style={{ fontSize: 11, opacity: 0.55, marginTop: 3 }}>
            {item.author.username} · {feedbackDate(item.createdAt)}
            {item.commentCount > 0 && ` · ${item.commentCount} comment${item.commentCount === 1 ? '' : 's'}`}
          </div>
        </button>
      </div>

      {expanded && (
        <Detail
          item={detail ?? item}
          loading={!detail}
          canPost={canPost}
          isStaff={isStaff}
          meUuid={meUuid}
          onUpdated={onUpdated}
          onError={onError}
        />
      )}
    </article>
  )
}

function Badge({ fill, ink, children }: { fill: string; ink: string; children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '2px 6px', borderRadius: 4, background: fill, color: ink, flexShrink: 0,
    }}>
      {children}
    </span>
  )
}

function Detail({ item, loading, canPost, isStaff, meUuid, onUpdated, onError }: {
  item: FeedbackItem
  loading: boolean
  canPost: boolean
  isStaff: boolean
  meUuid: string | null
  onUpdated: (item: FeedbackItem) => void
  onError: (msg: string) => void
}) {
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  const act = async (fn: () => Promise<FeedbackItem>) => {
    setBusy(true)
    try { onUpdated(await fn()) }
    catch (e) { onError(e instanceof Error ? e.message : 'Action failed.') }
    finally { setBusy(false) }
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px' }}>
      <div
        className="md"
        style={{ fontSize: 13.5, lineHeight: 1.55, overflowWrap: 'anywhere' }}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(item.body, 18) }}
      />

      {item.staffNote && (
        <div style={{
          marginTop: 12, padding: '9px 11px', borderRadius: 8, fontSize: 13,
          background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
        }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', opacity: 0.7, marginBottom: 3 }}>
            STAFF RESPONSE
          </div>
          {item.staffNote}
        </div>
      )}

      {isStaff && <StaffControls item={item} busy={busy} act={act} />}

      <div style={{ marginTop: 14 }}>
        {loading ? (
          <p style={{ fontSize: 12, opacity: 0.5, margin: 0 }}>Loading comments…</p>
        ) : (item.comments ?? []).length === 0 ? (
          <p style={{ fontSize: 12, opacity: 0.5, margin: 0 }}>No comments yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(item.comments ?? []).map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 8 }}>
                <Avatar size="sm">
                  <AvatarImage src={avatarUrl(c.author)} alt={c.author.username} />
                  <AvatarFallback>{(c.author.emoji ?? c.author.username[0] ?? '?').toUpperCase()}</AvatarFallback>
                </Avatar>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: c.author.color || undefined }}>
                      {c.author.username}
                    </span>
                    <span style={{ fontSize: 10, opacity: 0.45 }}>{feedbackDate(c.createdAt)}</span>
                    {!c.deleted && (isStaff || c.author.uuid === meUuid) && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act(() => feedbackApi.deleteComment(c.id))}
                        style={{
                          marginLeft: 'auto', border: 'none', background: 'none',
                          color: 'var(--danger)', cursor: 'pointer', fontSize: 11,
                        }}
                      >
                        delete
                      </button>
                    )}
                  </div>
                  <div style={{
                    fontSize: 13, opacity: c.deleted ? 0.45 : 1,
                    fontStyle: c.deleted ? 'italic' : undefined, overflowWrap: 'anywhere',
                  }}>
                    {c.deleted ? '[deleted]' : c.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {canPost && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <input
              value={comment}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && comment.trim()) {
                  act(() => feedbackApi.comment(item.id, comment.trim())).then(() => setComment(''))
                }
              }}
              placeholder="Add a comment…"
              maxLength={2000}
              style={{
                flex: 1, minWidth: 0, padding: '7px 10px', borderRadius: 7, fontSize: 13,
                border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)',
              }}
            />
            <button
              type="button"
              disabled={!comment.trim() || busy}
              onClick={() => act(() => feedbackApi.comment(item.id, comment.trim())).then(() => setComment(''))}
              style={{
                padding: '7px 14px', borderRadius: 7, border: 'none', fontWeight: 700, fontSize: 13,
                background: 'var(--primary)', color: 'var(--primary-foreground)',
                cursor: comment.trim() ? 'pointer' : 'default', opacity: comment.trim() ? 1 : 0.5,
              }}
            >
              Post
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function StaffControls({ item, busy, act }: {
  item: FeedbackItem
  busy: boolean
  act: (fn: () => Promise<FeedbackItem>) => Promise<void>
}) {
  const [note, setNote] = useState(item.staffNote ?? '')

  return (
    <div style={{
      marginTop: 12, padding: 10, borderRadius: 8,
      border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.07em', opacity: 0.5 }}>STAFF</div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {(Object.keys(STATUS_META) as FeedbackStatus[]).map(s => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => act(() => feedbackApi.moderate(item.id, { status: s }))}
            style={{
              padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${item.status === s ? STATUS_META[s].ink : 'var(--border)'}`,
              background: item.status === s ? STATUS_META[s].fill : 'transparent',
              color: item.status === s ? STATUS_META[s].ink : 'var(--muted-foreground)',
            }}
          >
            {STATUS_META[s].label}
          </button>
        ))}

        <button
          type="button"
          disabled={busy}
          onClick={() => act(() => feedbackApi.moderate(item.id, { isPrivate: !item.isPrivate }))}
          style={{
            padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)',
          }}
        >
          {item.isPrivate ? 'Make public' : 'Make private'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Public response…"
          style={{
            flex: 1, minWidth: 0, padding: '6px 9px', borderRadius: 6, fontSize: 12,
            border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)',
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => act(() => feedbackApi.moderate(item.id, { staffNote: note }))}
          style={{
            padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--foreground)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Save
        </button>
      </div>
    </div>
  )
}

function Composer({ onCancel, onCreated, onError }: {
  onCancel: () => void
  onCreated: (item: FeedbackItem) => void
  onError: (msg: string) => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [isPrivate, setIsPrivate] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!title.trim() || !body.trim()) return
    setBusy(true)
    try {
      onCreated(await feedbackApi.create({ title: title.trim(), body: body.trim(), kind, isPrivate }))
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not submit.')
    } finally {
      setBusy(false)
    }
  }

  const field: React.CSSProperties = {
    width: '100%', padding: '9px 11px', borderRadius: 8, fontSize: 14,
    border: '1px solid var(--border)', background: 'var(--background)',
    color: 'var(--foreground)', fontFamily: 'inherit',
  }

  return (
    <div style={{
      borderRadius: 11, border: '1px solid var(--border)', background: 'var(--card)',
      padding: 14, marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {(['bug', 'feature'] as FeedbackKind[]).map(k => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            style={{
              padding: '6px 12px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${kind === k ? 'var(--primary)' : 'var(--border)'}`,
              background: kind === k ? 'var(--primary)' : 'transparent',
              color: kind === k ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
            }}
          >
            {KIND_META[k].label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setIsPrivate(v => !v)}
          aria-pressed={isPrivate}
          style={{
            marginLeft: 'auto',
            padding: '6px 12px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: `1px solid ${isPrivate ? '#94a3b8' : 'var(--border)'}`,
            background: isPrivate ? 'rgba(148,163,184,0.18)' : 'transparent',
            color: isPrivate ? 'var(--foreground)' : 'var(--muted-foreground)',
          }}
        >
          {isPrivate ? '🔒 ' : ''}Private
        </button>
      </div>

      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder={KIND_META[kind].prompt}
        maxLength={200}
        autoFocus
        style={field}
      />

      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={KIND_META[kind].hint}
        rows={5}
        maxLength={8000}
        style={{ ...field, resize: 'vertical', lineHeight: 1.5 }}
      />

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '8px 14px', borderRadius: 7, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--muted-foreground)', fontSize: 13, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!title.trim() || !body.trim() || busy}
          onClick={submit}
          style={{
            padding: '8px 18px', borderRadius: 7, border: 'none', fontWeight: 800, fontSize: 13,
            background: 'var(--primary)', color: 'var(--primary-foreground)',
            cursor: title.trim() && body.trim() && !busy ? 'pointer' : 'default',
            opacity: title.trim() && body.trim() && !busy ? 1 : 0.5,
          }}
        >
          Submit
        </button>
      </div>
    </div>
  )
}

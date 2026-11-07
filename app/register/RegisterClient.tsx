'use client'

import { useMemo, useState } from 'react'
import { buildRowHTML, defaultRenderPrefs, setRowThreadName, type PostRow } from '@/components/thread/ThreadView'
import RulesAgreement from './RulesAgreement'

import { API } from '@/lib/apiBase'

const PRONOUNS: [string, string, string, string][] = [
  ['he', 'him', 'his', 'his'],
  ['she', 'her', 'her', 'hers'],
  ['they', 'them', 'their', 'theirs'],
]

const PRESET_COLORS = [
  '#006b99', '#1e88e5', '#00acc1', '#43a047', '#7cb342',
  '#fbc02d', '#fb8c00', '#e53935', '#d81b60', '#8e24aa',
  '#5e35b1', '#546e7a',
]

function validate(name: string, username: string, color: string, pronounIdx: number): string | null {
  const n = name.trim()
  const u = username.trim()
  const c = color.trim()

  if (n.length < 1) return 'Display name is required.'
  if (n.length > 25) return 'Display name must be 25 characters or fewer.'
  if (n.replace(/[\p{Letter}\p{Mark}\s_\d-]+/gu, '').length > 0) {
    return 'Display name contains characters that aren’t allowed.'
  }
  if (u.length < 1) return 'Username is required.'
  if (u.length > 25) return 'Username must be 25 characters or fewer.'
  if (/[^a-zA-Z0-9\-_]/gu.test(u)) {
    return 'Username can only use A–Z, 0–9, hyphens (-), and underscores (_).'
  }
  if (c.length !== 7 || c[0] !== '#') {
    return 'Color must be a # followed by 6 hex characters (no transparency).'
  }
  if (!/^[0-9A-Fa-f]{6}$/.test(c.slice(1))) return 'Color contains invalid characters.'
  if (pronounIdx < 0 || pronounIdx > 2) return 'Pick your pronouns.'
  return null
}

const STEPS = ['Rules', 'Name and colour'] as const

export default function RegisterClient({ initialName, initialUsername, initialColor, avatarUrl }: {
  initialName: string
  initialUsername: string
  initialColor: string
  avatarUrl?: string
}) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState(initialName)
  const [username, setUsername] = useState(initialUsername)
  const [color, setColor] = useState(initialColor)
  const [pronounIdx, setPronounIdx] = useState(2)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const previewHTML = useMemo(() => {
    setRowThreadName('')
    const post: PostRow = {
      uuid: 'preview',
      rawText: '1,234,567',
      countContent: '1,234,567',
      comment: 'my first count!',
      isValidCount: true,
      stricken: false,
      timestamp: String(Date.parse('2024-01-01T12:00:00Z')),
      timeSinceLastPost: 708,
      authorUUID: 'preview',
      authorUsername: username.trim() || 'username',
      authorName: name.trim() || 'Display Name',
      authorColor: /^#[0-9A-Fa-f]{6}$/.test(color.trim()) ? color.trim() : '#888888',
      authorAvatarUrl: avatarUrl,
    }
    return buildRowHTML(post, defaultRenderPrefs())
  }, [name, username, color, avatarUrl])

  const submit = async () => {
    const err = validate(name, username, color, pronounIdx)
    if (err) { setError(err); return }
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/counter/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          update: {
            name: name.trim(),
            username: username.trim(),
            color: color.trim(),
            pronouns: pronounIdx,
          },
        }),
      })
      if (res.ok) {
        window.location.href = '/register'
        return
      }
      let msg = 'The server rejected your registration.'
      try {
        const body = await res.json()
        if (typeof body?.message === 'string') msg = body.message
      } catch {}
      setError(`${msg} If that's a surprise, message the mods on Discord.`)
    } catch {
      setError('Couldn’t reach the server. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none ' +
    'focus:border-primary transition-colors'

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">

        <h1 className="text-3xl font-bold tracking-tight mb-1">Create your profile</h1>
        <p className="text-sm text-muted-foreground mb-7">
          Two quick steps and you&apos;re counting.
        </p>

        <ol className="flex items-center gap-3 mb-8">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={
                    'flex size-6 items-center justify-center rounded-full text-xs font-bold ' +
                    (i <= step ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')
                  }
                >
                  {i + 1}
                </span>
                <span className={i === step ? 'text-sm font-semibold' : 'text-sm text-muted-foreground'}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && <span className="h-px w-8 bg-border" />}
            </li>
          ))}
        </ol>

        {step === 0 && <RulesAgreement onDone={() => setStep(1)} />}

        {step === 1 && (
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold mb-1">Name and colour</h2>
            <p className="text-xs text-muted-foreground leading-relaxed mb-5">
              We recommend not using identifying information like your real name. Names
              may not be hurtful or derogatory, as judged by our moderators.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="reg-name" className="block text-xs font-semibold mb-1.5">
                  Display name
                </label>
                <input
                  id="reg-name"
                  value={name}
                  maxLength={25}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  placeholder="Display Name"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Spaces and some special characters allowed. {name.trim().length}/25
                </p>
              </div>

              <div>
                <label htmlFor="reg-username" className="block text-xs font-semibold mb-1.5">
                  Username
                </label>
                <input
                  id="reg-username"
                  value={username}
                  maxLength={25}
                  onChange={(e) => setUsername(e.target.value)}
                  className={inputCls}
                  placeholder="username"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  A&ndash;Z, 0&ndash;9, hyphens, underscores. {username.trim().length}/25
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="reg-pronouns" className="block text-xs font-semibold mb-1.5">
                Pronouns
              </label>
              <select
                id="reg-pronouns"
                value={pronounIdx}
                onChange={(e) => setPronounIdx(Number(e.target.value))}
                className={inputCls + ' sm:max-w-xs'}
              >
                {PRONOUNS.map((p, i) => (
                  <option key={i} value={i}>{p.join(', ')}</option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <span className="block text-xs font-semibold mb-1.5">Colour</span>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="color"
                  aria-label="Pick colour"
                  value={/^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#1e88e5'}
                  onChange={(e) => setColor(e.target.value)}
                  className="size-9 cursor-pointer rounded border border-border bg-transparent p-0.5"
                />
                <input
                  value={color}
                  maxLength={7}
                  onChange={(e) => setColor(e.target.value)}
                  className={inputCls + ' w-28 font-mono'}
                  aria-label="Colour hex code"
                  spellCheck={false}
                />
                <div className="flex gap-1 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      aria-label={`Use ${c}`}
                      className="size-6 rounded border border-white/15"
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <span className="block text-xs font-semibold mb-2">Preview</span>
              <div
                className="rounded-lg border border-border bg-[var(--surface-0)] px-1 py-2"
                dangerouslySetInnerHTML={{ __html: previewHTML }}
              />
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                {error}
              </p>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={submit}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Submitting…' : 'Submit registration'}
              </button>
              <button
                onClick={() => setStep(0)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              You can change any of this later from your settings.
            </p>
          </section>
        )}
      </div>
    </main>
  )
}

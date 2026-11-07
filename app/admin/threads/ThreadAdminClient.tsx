'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

import { API } from '@/lib/apiBase'

export interface AdminThread {
  uuid: string
  name: string
  title: string
  shortDescription?: string
  description?: string
  rules?: string
  firstValidCount?: string
  validationType?: string
  resetOnMistakes?: boolean
  allowDoublePosts?: boolean
  visibleTo?: string[]
  updatableBy?: string[]
  locked?: boolean
  autoValidated?: boolean
  moderators?: string[]
  verifiers?: string[]
  countBans?: string[]
  postBans?: string[]
  color1?: string
  color2?: string
  category?: string
  countsPerSplit?: number
  splitsPerGet?: number
  splitOffset?: number
}

const csv = (v: string[] | undefined) => (v ?? []).join(',')

interface FormState {
  uuid: string
  name: string
  title: string
  shortDescription: string
  description: string
  rules: string
  firstValidCount: string
  validationType: string
  visibleTo: string
  updatableBy: string
  moderators: string
  verifiers: string
  countBans: string
  postBans: string
  color1: string
  color2: string
  category: string
  countsPerSplit: number
  splitsPerGet: number
  splitOffset: number
  locked: boolean
  autoValidated: boolean
  resetOnMistakes: boolean
  allowDoublePosts: boolean
}

const BLANK: FormState = {
  uuid: '', name: '', title: '', shortDescription: '', description: '', rules: '',
  firstValidCount: '', validationType: '', visibleTo: 'all', updatableBy: 'counter',
  moderators: '', verifiers: '', countBans: '', postBans: '',
  color1: '', color2: '', category: '',
  countsPerSplit: 100, splitsPerGet: 10, splitOffset: 0,
  locked: false, autoValidated: false, resetOnMistakes: false, allowDoublePosts: false,
}

function fromThread(t: AdminThread): FormState {
  return {
    uuid: t.uuid ?? '',
    name: t.name ?? '',
    title: t.title ?? '',
    shortDescription: t.shortDescription ?? '',
    description: t.description ?? '',
    rules: t.rules ?? '',
    firstValidCount: t.firstValidCount ?? '',
    validationType: t.validationType ?? '',
    visibleTo: csv(t.visibleTo),
    updatableBy: csv(t.updatableBy),
    moderators: csv(t.moderators),
    verifiers: csv(t.verifiers),
    countBans: csv(t.countBans),
    postBans: csv(t.postBans),
    color1: t.color1 ?? '',
    color2: t.color2 ?? '',
    category: t.category ?? '',
    countsPerSplit: t.countsPerSplit ?? 100,
    splitsPerGet: t.splitsPerGet ?? 10,
    splitOffset: t.splitOffset ?? 0,
    locked: !!t.locked,
    autoValidated: !!t.autoValidated,
    resetOnMistakes: !!t.resetOnMistakes,
    allowDoublePosts: !!t.allowDoublePosts,
  }
}

const inputCls =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary transition-colors'
const labelCls = 'block text-xs font-semibold mb-1.5'

function Text({ id, label, value, onChange, hint, mono, area }: {
  id: string; label: string; value: string; onChange: (v: string) => void
  hint?: string; mono?: boolean; area?: boolean
}) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      {area ? (
        <textarea
          id={id} rows={3} value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls + ' resize-y'}
        />
      ) : (
        <input
          id={id} value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls + (mono ? ' font-mono text-xs' : '')}
          spellCheck={false}
        />
      )}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Num({ id, label, value, onChange }: {
  id: string; label: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      <input
        id={id} type="number" value={value}
        onChange={(e) => onChange(Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0)}
        className={inputCls}
      />
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: {
  label: string; hint: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
      <input
        type="checkbox" checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-[var(--primary)] shrink-0"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
    </label>
  )
}

export default function ThreadAdminClient({ threads }: { threads: AdminThread[] }) {
  const [form, setForm] = useState<FormState>(BLANK)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null)

  const isEdit = form.uuid.length > 0

  const sorted = useMemo(
    () => [...threads].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    [threads],
  )

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const selectThread = (uuid: string) => {
    setResult(null)
    if (!uuid) { setForm(BLANK); return }
    const t = threads.find(x => x.uuid === uuid)
    setForm(t ? fromThread(t) : BLANK)
  }

  const submit = async () => {
    if (!form.name.trim() || saving) return
    setSaving(true)
    setResult(null)
    try {
      const res = await fetch(`${API}/api/thread/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name.trim(),
          title: form.title,
          description: form.description,
          rules: form.rules,
          firstValidCount: form.firstValidCount,
          validationType: form.validationType,
          visibleTo: form.visibleTo,
          updatableBy: form.updatableBy,
          locked: form.locked,
          autoValidated: form.autoValidated,
          resetOnMistakes: form.resetOnMistakes,
          allowDoublePosts: form.allowDoublePosts,
          moderators: form.moderators,
          verifiers: form.verifiers,
          countBans: form.countBans,
          postBans: form.postBans,
          shortDescription: form.shortDescription,
          color1: form.color1,
          color2: form.color2,
          category: form.category,
          countsPerSplit: form.countsPerSplit,
          splitsPerGet: form.splitsPerGet,
          splitOffset: form.splitOffset,
          ...(isEdit ? { uuid: form.uuid } : {}),
        }),
      })
      if (res.ok) {
        setResult({
          text: isEdit ? `Updated “${form.name}”. Reload to see it in the list.` : `Created “${form.name}”.`,
          ok: true,
        })
      } else {
        setResult({ text: `Server rejected the request (${res.status}). Nothing was saved.`, ok: false })
      }
    } catch {
      setResult({ text: 'Couldn’t reach the server. Nothing was saved.', ok: false })
    } finally {
      setSaving(false)
    }
  }

  const txt = (id: keyof FormState, label: string, opts?: { hint?: string; mono?: boolean; area?: boolean }) => (
    <Text
      id={String(id)} label={label} value={String(form[id])}
      onChange={(v) => set(id, v as FormState[typeof id])}
      hint={opts?.hint} mono={opts?.mono} area={opts?.area}
    />
  )
  const num = (id: keyof FormState, label: string) => (
    <Num id={String(id)} label={label} value={Number(form[id])} onChange={(v) => set(id, v as FormState[typeof id])} />
  )
  const tog = (id: keyof FormState, label: string, hint: string) => (
    <Toggle label={label} hint={hint} checked={Boolean(form[id])} onChange={(v) => set(id, v as FormState[typeof id])} />
  )

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/admin" className="text-xs font-semibold text-primary hover:underline underline-offset-4">
          ← Admin
        </Link>

        <h1 className="mt-3 text-3xl font-bold tracking-tight mb-1">Threads</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Pick a thread to edit, or leave it on “New thread” to create one.
          {' '}{threads.length} thread{threads.length === 1 ? '' : 's'} exist.
        </p>

        <div className="mb-6">
          <label htmlFor="thread-select" className={labelCls}>Editing</label>
          <select
            id="thread-select"
            value={form.uuid}
            onChange={(e) => selectThread(e.target.value)}
            className={inputCls + ' sm:max-w-sm'}
          >
            <option value="">New thread</option>
            {sorted.map(t => (
              <option key={t.uuid} value={t.uuid}>{t.name}</option>
            ))}
          </select>
        </div>

        {result && (
          <p
            role="status"
            className={
              'mb-5 rounded-lg border px-3 py-2 text-sm ' +
              (result.ok ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-destructive/40 bg-destructive/10')
            }
          >
            {result.text}
          </p>
        )}

        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card/40 p-4">
            <h2 className="text-sm font-semibold mb-3">Identity</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className={labelCls}>Name (URL slug)</label>
                <input
                  id="name"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  disabled={isEdit}
                  className={inputCls + ' disabled:opacity-50 disabled:cursor-not-allowed'}
                  spellCheck={false}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {isEdit ? 'Locked: renaming an existing thread would break its URLs.' : 'Used in /thread/<name>.'}
                </p>
              </div>
              {txt("title","Title")}
              {txt("shortDescription","Short description")}
              {txt("category","Category")}
            </div>
            <div className="mt-4 grid gap-4">
              {txt("description","Description",{area:true})}
              {txt("rules","Rules",{area:true,hint:"Markdown, shown in the thread’s About tab."})}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card/40 p-4">
            <h2 className="text-sm font-semibold mb-3">Counting behaviour</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {txt("firstValidCount","First valid count")}
              {txt("validationType","Validation type")}
              {num("countsPerSplit","Counts per split")}
              {num("splitsPerGet","Splits per get")}
              {num("splitOffset","Split offset")}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {tog("resetOnMistakes","Reset on mistakes","A stricken count sends the thread back to the start.")}
              {tog("allowDoublePosts","Allow double posts","One counter may count twice in a row.")}
              {tog("locked","Locked","Nobody can post.")}
              {tog("autoValidated","Auto validated","Counts validate without a checker.")}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card/40 p-4">
            <h2 className="text-sm font-semibold mb-1">Appearance</h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              Colour 1 and 2 drive the navbar gradient on this thread.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {(['color1', 'color2'] as const).map(key => (
                <div key={key}>
                  <label htmlFor={key} className={labelCls}>{key === 'color1' ? 'Colour 1' : 'Colour 2'}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={`${key} picker`}
                      value={/^#[0-9A-Fa-f]{6}$/.test(form[key]) ? form[key] : '#006b99'}
                      onChange={(e) => set(key, e.target.value)}
                      className="size-9 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
                    />
                    <input
                      id={key}
                      value={form[key]}
                      onChange={(e) => set(key, e.target.value)}
                      className={inputCls + ' font-mono text-xs'}
                      spellCheck={false}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card/40 p-4">
            <h2 className="text-sm font-semibold mb-1">Access</h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              Comma-separated, no spaces. Roles for visibility/updates; counter UUIDs for
              moderators, verifiers and bans.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {txt("visibleTo","Visible to",{mono:true,hint:"Roles, e.g. all"})}
              {txt("updatableBy","Updatable by",{mono:true,hint:"Roles, e.g. counter"})}
              {txt("moderators","Moderators",{mono:true,hint:"Counter UUIDs"})}
              {txt("verifiers","Verifiers",{mono:true,hint:"Counter UUIDs"})}
              {txt("countBans","Count bans",{mono:true,hint:"Counter UUIDs"})}
              {txt("postBans","Post bans",{mono:true,hint:"Counter UUIDs"})}
            </div>
          </section>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={submit}
            disabled={saving || !form.name.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create thread'}
          </button>
          {isEdit && (
            <button
              onClick={() => { setForm(BLANK); setResult(null) }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Start a new thread instead
            </button>
          )}
        </div>
      </div>
    </main>
  )
}

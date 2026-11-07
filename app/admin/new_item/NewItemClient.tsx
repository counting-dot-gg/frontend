'use client'

import { useState } from 'react'
import Link from 'next/link'

import { API } from '@/lib/apiBase'

const CATEGORIES = ['emoji', 'title', 'card', 'border', 'emote_slot']
const UNLOCK_METHODS = ['shop', 'xp', 'achievement', 'default', 'bot']

interface Form {
  name: string
  internalName: string
  description: string
  category: string
  unlockMethod: string
  unlockDescription: string
  price: string
  quantity: string
  levelToUnlock: string
  achievementId: string
}

const BLANK: Form = {
  name: '', internalName: '', description: '', category: 'emoji',
  unlockMethod: 'shop', unlockDescription: '', price: '0', quantity: '0',
  levelToUnlock: '0', achievementId: '0',
}

export default function NewItemClient() {
  const [form, setForm] = useState<Form>(BLANK)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null)

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(p => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!form.name.trim() || !form.internalName.trim() || saving) return
    setSaving(true)
    setResult(null)
    const int = (v: string) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0 }
    const flt = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }
    try {
      const res = await fetch(`${API}/api/counter/createItem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name.trim(),
          internal_name: form.internalName.trim(),
          description: form.description,
          category: form.category,
          unlockMethod: form.unlockMethod,
          unlockDescription: form.unlockDescription,
          price: flt(form.price),
          quantity: int(form.quantity),
          levelToUnlock: int(form.levelToUnlock),
          achievementId: int(form.achievementId),
        }),
      })
      if (res.ok) {
        setResult({ text: `Created “${form.name}”.`, ok: true })
        setForm(BLANK)
      } else {
        setResult({ text: `Server rejected the request (${res.status}). Nothing was created.`, ok: false })
      }
    } catch {
      setResult({ text: 'Couldn’t reach the server. Nothing was created.', ok: false })
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary transition-colors'
  const labelCls = 'block text-xs font-semibold mb-1.5'

  const field = (k: keyof Form, label: string, opts?: { hint?: string; numeric?: boolean; mono?: boolean }) => (
    <div>
      <label htmlFor={k} className={labelCls}>{label}</label>
      <input
        id={k}
        value={form[k]}
        inputMode={opts?.numeric ? 'numeric' : undefined}
        onChange={(e) => set(k, e.target.value)}
        className={inputCls + (opts?.mono ? ' font-mono text-xs' : '')}
        spellCheck={false}
      />
      {opts?.hint && <p className="mt-1 text-[11px] text-muted-foreground">{opts.hint}</p>}
    </div>
  )

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/admin" className="text-xs font-semibold text-primary hover:underline underline-offset-4">
          ← Admin
        </Link>

        <h1 className="mt-3 text-3xl font-bold tracking-tight mb-1">New item</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Adds an item to the shop. The API has no edit or delete endpoint, so
          double-check before creating.
        </p>

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
              {field('name', 'Display name')}
              {field('internalName', 'Internal name', { mono: true, hint: 'Stable key used in code.' })}
            </div>
            <div className="mt-4">
              {field('description', 'Description')}
            </div>
            <div className="mt-4">
              <label htmlFor="category" className={labelCls}>Category</label>
              <select
                id="category"
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                className={inputCls + ' sm:max-w-xs'}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card/40 p-4">
            <h2 className="text-sm font-semibold mb-1">Unlocking</h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              Only the field matching the unlock method matters: the others can stay 0.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="unlockMethod" className={labelCls}>Unlock method</label>
                <select
                  id="unlockMethod"
                  value={form.unlockMethod}
                  onChange={(e) => set('unlockMethod', e.target.value)}
                  className={inputCls}
                >
                  {UNLOCK_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {field('unlockDescription', 'Unlock description')}
              {field('price', 'Price', { numeric: true, hint: 'For unlockMethod “shop”.' })}
              {field('levelToUnlock', 'Level to unlock', { numeric: true, hint: 'For unlockMethod “xp”.' })}
              {field('achievementId', 'Achievement id', { numeric: true, hint: 'For unlockMethod “achievement”.' })}
              {field('quantity', 'Quantity', { numeric: true, hint: '0 for unlimited.' })}
            </div>
          </section>
        </div>

        <button
          onClick={submit}
          disabled={saving || !form.name.trim() || !form.internalName.trim()}
          className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Creating…' : 'Create item'}
        </button>
      </div>
    </main>
  )
}

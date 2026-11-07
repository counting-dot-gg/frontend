'use client'

import { useState } from 'react'
import Link from 'next/link'

import { API } from '@/lib/apiBase'

export default function SystemMessageClient() {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null)

  const trimmed = message.trim()

  const send = async () => {
    if (!trimmed || sending) return
    setSending(true)
    setResult(null)
    try {
      const res = await fetch(`${API}/api/counter/adminSendSystemMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: trimmed }),
      })
      if (res.ok) {
        setResult({ text: 'Message broadcast.', ok: true })
        setMessage('')
      } else {
        setResult({ text: `Server rejected the request (${res.status}). Nothing was sent.`, ok: false })
      }
    } catch {
      setResult({ text: 'Couldn’t reach the server. Nothing was sent.', ok: false })
    } finally {
      setSending(false)
      setConfirming(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-10">
        <Link href="/admin" className="text-xs font-semibold text-primary hover:underline underline-offset-4">
          ← Admin
        </Link>

        <h1 className="mt-3 text-3xl font-bold tracking-tight mb-1">Send system message</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Broadcasts to everyone currently connected. There&apos;s no undo and no
          edit: it goes out as written.
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

        <label htmlFor="sysmsg" className="block text-xs font-semibold mb-1.5">
          Message
        </label>
        <textarea
          id="sysmsg"
          value={message}
          onChange={(e) => { setMessage(e.target.value); setConfirming(false) }}
          rows={4}
          className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
          placeholder="e.g. Scheduled maintenance in 10 minutes."
        />
        <p className="mt-1 text-[11px] text-muted-foreground">{trimmed.length} characters</p>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={!trimmed}
            className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Review and send
          </button>
        ) : (
          <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold mb-2">Send this to everyone?</p>
            <p className="mb-4 whitespace-pre-wrap rounded-lg border border-border bg-card px-3 py-2 text-sm">
              {trimmed}
            </p>
            <div className="flex gap-2">
              <button
                onClick={send}
                disabled={sending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Send now'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'

import { API } from '@/lib/apiBase'

export default function DiscordRolesClient() {
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null)

  const sync = async () => {
    if (sending) return
    setSending(true)
    setResult(null)
    try {
      const res = await fetch(`${API}/api/counter/adminSyncDiscordRoles`, {
        method: 'POST',
        credentials: 'include',
      })
      setResult(res.ok ? { text: 'Sync started.', ok: true } : { text: `Failed (${res.status}).`, ok: false })
    } catch {
      setResult({ text: 'Couldn’t reach the server.', ok: false })
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-10">
        <Link href="/admin" className="text-xs font-semibold text-primary hover:underline underline-offset-4">
          ← Admin
        </Link>

        <h1 className="mt-3 text-3xl font-bold tracking-tight mb-6">Discord roles</h1>

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

        <button
          type="button"
          onClick={sync}
          disabled={sending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {sending ? 'Starting…' : 'Sync level and rank roles'}
        </button>
      </div>
    </main>
  )
}

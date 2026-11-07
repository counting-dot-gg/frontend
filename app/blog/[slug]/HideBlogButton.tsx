'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { API } from '@/lib/apiBase'

export default function HideBlogButton({ uuid, hidden }: { uuid: string; hidden: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [isHidden, setIsHidden] = useState(hidden)

  const toggle = async () => {
    const next = !isHidden
    if (next && !window.confirm('Unpublish this post? It will no longer be listed publicly.')) return
    setBusy(true)
    try {
      const res = await fetch(`${API}/api/api/hideBlogPost`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid, hidden: next }),
      })
      if (!res.ok) throw new Error()
      setIsHidden(next)
      router.refresh()
    } catch {
      window.alert('Could not change the post’s visibility.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '10px 20px', borderRadius: 10,
        background: isHidden ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
        border: `1px solid ${isHidden ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'}`,
        color: isHidden ? 'var(--success-ink)' : 'var(--danger)',
        fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
        cursor: busy ? 'wait' : 'pointer',
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? 'Saving…' : isHidden ? 'Republish' : 'Unpublish'}
    </button>
  )
}

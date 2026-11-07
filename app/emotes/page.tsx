import type { Metadata } from 'next'
import { apiFetch } from '@/lib/apiFetch'
import { getSession } from '@/lib/session'
import EmotesClient, { type AdminEmote } from './EmotesClient'
import SubmitEmote from './SubmitEmote'
import PendingQueue from './PendingQueue'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

export const metadata: Metadata = {
  title: 'Emotes | counting.gg',
}

async function getEmotes(): Promise<AdminEmote[]> {
  try {
    const res = await apiFetch(`${API}/api/emote`, { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function EmotesPage() {
  const [session, emotes] = await Promise.all([getSession(), getEmotes()])
  const roles = session?.counter?.roles ?? []
  const isAdmin = roles.includes('admin') || roles.includes('mod')
  const publicApi = process.env.NEXT_PUBLIC_API_HOST || API

  const isCounter = roles.includes('counter')

  return (
    <>
      {(isAdmin || isCounter) && (
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px 0' }}>
          {isAdmin && <PendingQueue apiHost={publicApi} />}
          {isCounter && <SubmitEmote apiHost={publicApi} />}
        </div>
      )}
      <EmotesClient emotes={emotes} isAdmin={isAdmin} apiHost={publicApi} />
    </>
  )
}

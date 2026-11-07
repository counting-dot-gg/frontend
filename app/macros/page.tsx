import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getSession } from '@/lib/session'
import MacrosClient from './MacrosClient'

export const metadata: Metadata = {
  title: 'Macro Presets | counting.gg',
}

export default async function MacrosPage() {
  const session = await getSession()

  if (!session) {
    return (
      <div style={{ maxWidth: 680, margin: '48px auto', padding: '0 16px', color: 'var(--ink-1)' }}>
        <div style={{ background: 'rgba(33,150,243,0.15)', border: '1px solid rgba(33,150,243,0.4)', borderRadius: 8, padding: 16, color: 'var(--primary)' }}>
          You must be logged in to use macro presets.
        </div>
      </div>
    )
  }

  return (
    <Suspense>
      <MacrosClient username={session.username} userDiscordId={session.counter?.discordId ?? null} />
    </Suspense>
  )
}

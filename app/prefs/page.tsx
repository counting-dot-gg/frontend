import type { Metadata } from 'next'
import { getSession } from '@/lib/session'
import { resolvePrefs } from '@/lib/prefs'
import PrefsPageClient from './PrefsPageClient'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

export const metadata: Metadata = {
  title: 'Preferences | counting.gg',
}

export interface PrefStats {
  [prefKey: string]: { [optionValue: string]: number }
}

async function getPrefStats(): Promise<PrefStats> {
  try {
    const res = await fetch(`${API}/api/user/prefStats`, { next: { revalidate: 300 } })
    if (!res.ok) return {}
    return res.json()
  } catch {
    return {}
  }
}

export default async function PrefsPage() {
  const [session, prefStats] = await Promise.all([getSession(), getPrefStats()])

  if (!session) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 12 }}>Sign in to edit preferences</h1>
        <p style={{ color: '#888', marginBottom: 24, lineHeight: 1.6 }}>
          Preferences are tied to your counting.gg account.
        </p>
        <a
          href={process.env.NEXT_PUBLIC_LOGIN ?? '/api/auth/login'}
          style={{
            display: 'inline-block', padding: '10px 24px', borderRadius: 8,
            background: '#f97316', color: '#fff', fontWeight: 700, textDecoration: 'none',
          }}
        >
          Login with Discord
        </a>
      </div>
    )
  }

  if (!session.counter) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 12 }}>Registration pending</h1>
        <p style={{ color: '#888', lineHeight: 1.6 }}>
          Your account is still being verified. Preferences unlock once registration is complete.
        </p>
      </div>
    )
  }

  const prefs = resolvePrefs(session.userPrefs, null)

  return (
    <PrefsPageClient
      initialPrefs={prefs}
      prefStats={prefStats}
      username={session.username}
      counter={session.counter}
      items={session.items ?? []}
    />
  )
}

import WarmThreadRoute from '@/components/WarmThreadRoute'
import type { Metadata } from 'next'
import { apiFetch } from '@/lib/apiFetch'
import { Lexend, JetBrains_Mono } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import { Providers } from './providers'
import { Navbar } from '@/components/layout/Navbar'
import SessionRecovery from '@/components/layout/SessionRecovery'
import SiteChatMount from '@/components/layout/SiteChatMount'
import RewardNotifications from '@/components/layout/RewardNotifications'
import FeatTicker from '@/components/layout/FeatTicker'
import AvatarFallback from '@/components/layout/AvatarFallback'
import { getSessionResult } from '@/lib/session'
import { resolveServerTheme, THEME_BOOTSTRAP } from '@/lib/theme'
import ApiDownBanner from '@/components/layout/ApiDownBanner'
import ClientHealthBeacon from '@/components/layout/ClientHealthBeacon'
import HydrationBanner, { HydrationBeacon, HYDRATION_WATCH_SCRIPT } from '@/components/layout/HydrationBanner'

const lexend = Lexend({ variable: '--font-geist-sans', subsets: ['latin'] })
const jetbrainsMono = JetBrains_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'counting.gg',
  description: 'The largest counting site on the internet',
  openGraph: {
    siteName: 'counting.gg',
    type: 'website',
    images: [{ url: '/logo/cgg-128.png', width: 228, height: 128, alt: 'counting.gg' }],
  },
  twitter: {
    card: 'summary',
    images: ['/logo/cgg-128.png'],
  },
}

async function getEmotes(): Promise<{ id: string; names: string[]; imgUrl: string }[]> {
  try {
    const res = await apiFetch(`${API}/api/emote`, { next: { revalidate: 60 } })
    if (!res.ok) return []
    const rows: { name: string; filename: string }[] = await res.json()
    const publicApi = process.env.NEXT_PUBLIC_API_HOST || API
    return rows.map(r => ({
      id: r.name,
      names: [r.name],
      imgUrl: `${publicApi}/uploads/emotes/${encodeURIComponent(r.filename)}`,
    }))
  } catch {
    return []
  }
}

async function getInitialThreadColors(): Promise<{ color1: string | null; color2: string | null }> {
  const headerList = await headers()
  const pathname = headerList.get('x-pathname')
  const match = pathname?.match(/^\/thread\/(.+)$/)
  if (!match) return { color1: null, color2: null }

  try {
    const threadName = decodeURIComponent(match[1])
    const res = await apiFetch(`${API}/api/thread/${encodeURIComponent(threadName)}`, { cache: 'no-store' })
    if (!res.ok) return { color1: null, color2: null }
    const thread = await res.json()
    return { color1: thread?.color1 ?? null, color2: thread?.color2 ?? null }
  } catch {
    return { color1: null, color2: null }
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [sessionResult, initialColors, initialEmotes] = await Promise.all([
    getSessionResult(),
    getInitialThreadColors(),
    getEmotes(),
  ])
  const session = sessionResult.user

  const nightMode = session?.userPrefs?.pref_nightMode ?? 'System'
  const serverTheme = resolveServerTheme(nightMode)

  return (
    <html
      lang="en"
      data-night-mode={nightMode}
      data-theme={serverTheme ?? undefined}
      style={serverTheme ? { colorScheme: serverTheme } : undefined}
      className={`${lexend.variable} ${jetbrainsMono.variable} h-full antialiased${serverTheme === 'dark' ? ' dark' : ''}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <script dangerouslySetInnerHTML={{ __html: HYDRATION_WATCH_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers initialColors={initialColors} initialEmotes={initialEmotes}>
          {!sessionResult.reachable && <ApiDownBanner />}
          <HydrationBanner />
          <HydrationBeacon />
          <SessionRecovery isLoggedIn={!!session} />
          <Navbar user={session} miscSettings={session?.miscSettings} />
          <div className="flex-1">
            <WarmThreadRoute />
            {children}
          </div>
          <SiteChatMount user={session} />
          {session && <RewardNotifications username={session.counter?.username} />}
          <AvatarFallback />
          {session && <ClientHealthBeacon />}
          <FeatTicker me={session?.counter ?? null} enabled={session?.userPrefs?.pref_milestones !== false} />
        </Providers>
      </body>
    </html>
  )
}

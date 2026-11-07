import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import RegisterClient from './RegisterClient'

export const metadata: Metadata = {
  title: 'Register | counting.gg',
}


const DISCORD_INVITE = 'https://discord.gg/bfS9RQht6M'

export default async function RegisterPage() {
  const session = await getSession()

  if (!session) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-3">Log in first</h1>
          <p className="text-sm text-muted-foreground mb-6">
            You need to sign in with Discord before creating your counting.gg profile.
          </p>
          <a
            href={process.env.NEXT_PUBLIC_LOGIN ?? '/api/auth/login'}
            className="inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white"
          >
            Login with Discord
          </a>
        </div>
      </main>
    )
  }

  const roles: string[] = session.counter?.roles ?? []

  if (roles.includes('counter')) redirect('/')

  if (roles.includes('manual_verification_needed')) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-xl mx-auto px-4 py-16">
          <h1 className="text-2xl font-bold mb-3">Registration submitted</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Your profile is waiting on manual approval: this is a spam measure, not
            anything you did. It usually means someone has counted from this connection
            before, or your Discord account is very new. Approvals are quick if you ask:
            say hello in the Discord and a moderator will sort it out.
          </p>
          <div className="flex items-center gap-4">
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white"
            >
              Join the Discord
            </a>
            <Link href="/" className="text-sm font-semibold text-primary underline underline-offset-4">
              Back to the site
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (roles.includes('denied')) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-xl mx-auto px-4 py-16">
          <h1 className="text-2xl font-bold mb-3">Registration declined</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your registration wasn&apos;t approved. If you think that&apos;s a mistake,
            reach out to the moderators on Discord.
          </p>
        </div>
      </main>
    )
  }

  return (
    <RegisterClient
      initialName={session.counter?.name ?? ''}
      initialUsername={session.counter?.username ?? session.username ?? ''}
      initialColor={session.counter?.color ?? '#1e88e5'}
      avatarUrl={session.counter?.avatarUrl}
    />
  )
}

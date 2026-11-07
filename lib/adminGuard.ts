import { notFound } from 'next/navigation'
import { getSession } from './session'
import type { SessionUser } from './types'

export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSession()
  if (!session?.counter?.roles?.includes('admin')) notFound()
  return session
}

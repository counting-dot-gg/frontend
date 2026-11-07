import type { Metadata } from 'next'
import { apiFetch } from '@/lib/apiFetch'
import { getSession } from '@/lib/session'
import AchievementClient from './AchievementClient'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params
  try {
    const res = await apiFetch(`${API}/api/counter/achievement/${Number(id)}`, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      const a = data.achievement
      if (a?.isPublic && a.name) {
        return {
          title: `${a.name} | counting.gg`,
          description: a.description || undefined,
        }
      }
    }
  } catch {
  }
  return { title: 'Achievement | counting.gg' }
}

async function getPayloads(id: string, userUUID: string | null) {
  try {
    const [detailRes, listRes] = await Promise.all([
      apiFetch(`${API}/api/counter/achievement/${Number(id)}`, { cache: 'no-store' }),
      apiFetch(`${API}/api/counter/achievements/${userUUID ?? 'undefined'}`, { cache: 'no-store' }),
    ])
    if (!detailRes.ok) return null
    return {
      detail: await detailRes.json(),
      list: listRes.ok ? await listRes.json() : null,
    }
  } catch {
    return null
  }
}

export default async function AchievementDetailPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await getSession()
  const userUUID = session?.counter?.uuid ?? null
  return (
    <AchievementClient
      achievementId={Number(id)}
      userUUID={userUUID}
      initial={await getPayloads(id, userUUID)}
    />
  )
}

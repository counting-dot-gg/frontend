import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/adminGuard'
import AwardAchievementClient, { type AchievementOption } from './AwardAchievementClient'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

export const metadata: Metadata = {
  title: 'Award achievements | counting.gg',
}

async function getAchievements(uuid: string): Promise<AchievementOption[]> {
  try {
    const res = await fetch(`${API}/api/counter/achievements/${encodeURIComponent(uuid)}`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const data = await res.json()
    const all = data?.all_achievements
    if (!Array.isArray(all)) return []
    return all
      .map((a: any) => ({
        id: a.id,
        name: a.name ?? `Achievement ${a.id}`,
        description: a.description ?? '',
        hidden: a.isPublic === false,
      }))
      .sort((a: AchievementOption, b: AchievementOption) => a.id - b.id)
  } catch {
    return []
  }
}

export default async function AdminAchievementsPage() {
  const session = await requireAdmin()
  const achievements = await getAchievements(session.uuid)
  return <AwardAchievementClient achievements={achievements} />
}

export interface CounterInfo {
  uuid: string
  name: string
  username: string
  color: string
  discordId: string
  avatar: string
  emoji?: string
  roles?: string[]
}

export function avatarUrl(
  c: { discordId: string; avatar: string },
  size: 16 | 32 | 64 | 128 | 256 | 512 = 64,
): string | undefined {
  return c.discordId && c.avatar && c.avatar.length > 5
    ? `https://cdn.discordapp.com/avatars/${c.discordId}/${c.avatar}?size=${size}`
    : undefined
}

export const SYSTEM_UUID = '[SYSTEM]'

export const SYSTEM_COUNTER: CounterInfo = {
  uuid: SYSTEM_UUID,
  name: SYSTEM_UUID,
  username: SYSTEM_UUID,
  color: '#069420',
  discordId: '0',
  avatar: '0',
  emoji: '🤖',
  roles: ['counter'],
}

export function buildCounterMap<T extends { uuid: string }>(
  counters: readonly (T | null | undefined)[] | null | undefined,
): Map<string, T> {
  const map = new Map<string, T>([[SYSTEM_UUID, SYSTEM_COUNTER as unknown as T]])
  for (const c of counters ?? []) {
    if (c && c.uuid) map.set(c.uuid, c)
  }
  return map
}

export function medal(rank: number): { bg: string; color: string } | null {
  if (rank === 1) return { bg: 'gold', color: '#000' }
  if (rank === 2) return { bg: 'silver', color: '#000' }
  if (rank === 3) return { bg: '#cd7f32', color: '#000' }
  return null
}

export function displayName(c: Pick<CounterInfo, 'name' | 'emoji'>): string {
  return c.emoji ? `${c.emoji} ${c.name} ${c.emoji}` : c.name
}

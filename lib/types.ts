export interface CategoryWithoutFullThreads {
  name: string
  threadUUIDs: string[]
  expanded: boolean
}

export interface MiscSettings {
  categories: CategoryWithoutFullThreads[]
  lastUpdated: number
}

export type Counter = {
  uuid: string
  id: number
  discordId: string
  avatarUrl: string
  name: string
  username: string
  color: string
  roles: string[]
  rainbow: number
  avatar: string
  cardStyle: string
  cardBorderStyle: string
  pronouns: [string, string, string, string]
  title: string
  xp: number
  lastRob?: string
  emoji?: string
}

export type Item = {
  id: number
  name: string
  internal_name: string
  description: string
  category: string
  unlockMethod: string
  unlockDescription: string
  price: number
  quantity: number
  levelToUnlock: number
  achievementId: number
  season: number | null
}

import type { UserPrefs } from './prefs'

export type SessionUser = {
  uuid: string
  username: string
  bingoGameId?: number | null
  counter?: Counter
  items?: Item[]
  money?: number
  unreadMentionCount?: number
  userPrefs?: UserPrefs
  miscSettings?: MiscSettings
  reddit?: string
  redditAccess?: string
}

import { getAllEmotes, getEmotesVersion } from './emotes'

export type IndexEntry =
  | { kind: 'native'; id: string; native: string; label: string; search: string }
  | { kind: 'custom'; id: string; imgUrl: string; label: string; search: string }

let cachedIndex: IndexEntry[] | null = null
let cachedVersion = -1

export function getIndex(): IndexEntry[] {
  if (cachedIndex && cachedVersion === getEmotesVersion()) return cachedIndex

  const entries: IndexEntry[] = []

  for (const c of getAllEmotes()) {
    entries.push({
      kind: 'custom',
      id: c.id,
      imgUrl: c.imgUrl,
      label: c.id,
      search: c.names.join(' '),
    })
  }

  try {
    const data = require('@emoji-mart/data')
    for (const emoji of Object.values(data.emojis) as any[]) {
      const native = emoji.skins?.[0]?.native
      if (!native) continue
      entries.push({
        kind: 'native',
        id: emoji.id,
        native,
        label: emoji.id,
        search: [emoji.id, emoji.name, ...(emoji.keywords ?? [])].join(' ').toLowerCase(),
      })
    }
  } catch {
  }

  cachedIndex = entries
  cachedVersion = getEmotesVersion()
  return entries
}

export function searchEmoji(query: string, limit = 8): IndexEntry[] {
  if (query.length < 1) return []
  const q = query.toLowerCase()
  const results: IndexEntry[] = []
  for (const e of getIndex()) {
    if (e.search.includes(q)) {
      results.push(e)
      if (results.length >= limit) break
    }
  }
  return results
}

export function insertionTextFor(entry: IndexEntry): string {
  return entry.kind === 'native' ? entry.native : `\`${entry.id}\``
}

import { getEmote } from './emotes'

import { NATIVE_BY_ID } from './nativeEmojiMap'

let nativeById: Map<string, string> | null = null

function getNativeById(): Map<string, string> {
  if (nativeById) return nativeById
  const map = new Map<string, string>()
  for (const [id, native] of Object.entries(NATIVE_BY_ID)) {
    map.set(id.toLowerCase(), native)
  }
  nativeById = map
  return map
}

export function getNativeEmoji(id: string): string | undefined {
  if (!id) return undefined
  return getNativeById().get(id.toLowerCase())
}

const SHORTCODE_RE = /:([a-zA-Z0-9_+-]{1,40}):/g

export function normalizeShortcodes(text: string): string {
  return text.replace(SHORTCODE_RE, (full, name: string) => {
    const emote = getEmote(name)
    if (emote) return `\`${emote.id}\``
    const native = getNativeById().get(name.toLowerCase())
    if (native) return native
    return full
  })
}

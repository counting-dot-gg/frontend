import type React from 'react'

export type EmoteEntry = { id: string; names: string[]; imgUrl: string }

export const CUSTOM_EMOJIS: EmoteEntry[] = [
  { id: 'pog',           names: ['pog'],                          imgUrl: '/emotes/pog.png' },
  { id: 'got_it',        names: ['got_it', 'gotit'],              imgUrl: '/emotes/gotit.png' },
  { id: 'dafek',         names: ['dafek', 'dafuq', 'wtf'],        imgUrl: '/emotes/dafek.png' },
  { id: 'fr-emoji',      names: ['fr', 'forreal', 'lowkey'],      imgUrl: '/emotes/fr-emoji.png' },
  { id: 'soaked',        names: ['soaked', 'fox'],                imgUrl: '/emotes/soaked.png' },
  { id: 'PLEASE',        names: ['please'],                       imgUrl: '/emotes/please.png' },
  { id: 'THANKS',        names: ['thanks'],                       imgUrl: '/emotes/thanks.png' },
  { id: 'wholesome',     names: ['wholesome', 'award'],           imgUrl: '/emotes/wholesome.png' },
  { id: 'upvote',        names: ['upvote', 'vote'],               imgUrl: '/emotes/upvote.png' },
  { id: 'downvote',      names: ['downvote', 'vote'],             imgUrl: '/emotes/downvote.png' },
  { id: 'beenaday',      names: ['beenaday', 'bruh'],             imgUrl: '/emotes/beenaday.png' },
  { id: 'angery',        names: ['angery', 'angry', 'mad'],       imgUrl: '/emotes/angery.png' },
  { id: 'catcry',        names: ['catcry', 'cat', 'sad'],         imgUrl: '/emotes/catcry.png' },
  { id: 'cuteballgames', names: ['cuteballgames', 'cute'],        imgUrl: '/emotes/cuteballgames.png' },
  { id: 'gg',            names: ['gg', 'good'],                   imgUrl: '/emotes/gg.png' },
  { id: 'goldpincus',    names: ['goldpincus', 'gold'],           imgUrl: '/emotes/goldpincus.png' },
  { id: 'happyegg',      names: ['happyegg', 'egg'],              imgUrl: '/emotes/happyegg.png' },
  { id: 'letsgo',        names: ['letsgo', 'lfg'],                imgUrl: '/emotes/letsgo.png' },
  { id: 'phazer',        names: ['phazer', 'bread'],              imgUrl: '/emotes/phazer.png' },
  { id: 'pincushd',      names: ['pincushd', 'pincus'],           imgUrl: '/emotes/pincushd.png' },
  { id: 's1bronze',      names: ['s1bronze', 'bronze'],           imgUrl: '/emotes/s1bronze.png' },
  { id: 's1plat',        names: ['s1plat', 'plat'],               imgUrl: '/emotes/s1plat.png' },
  { id: 'sadge',         names: ['sadge', 'sad', 'frog'],         imgUrl: '/emotes/sadge.png' },
  { id: 'pogfish',       names: ['pogfish', 'pog', 'fish'],       imgUrl: '/emotes/pogfish.gif' },
  { id: 'sussy',         names: ['sussy', 'sus', 'amogus'],       imgUrl: '/emotes/sussy.gif' },
]

let dynamicEmotes: EmoteEntry[] = []
let emoteById = new Map(CUSTOM_EMOJIS.map(e => [e.id.toLowerCase(), e]))

function rebuildIndex() {
  const merged = new Map<string, EmoteEntry>()
  for (const e of dynamicEmotes) merged.set(e.id.toLowerCase(), e)
  for (const e of CUSTOM_EMOJIS) merged.set(e.id.toLowerCase(), e)
  emoteById = merged
}

let emotesVersion = 0
export function getEmotesVersion() {
  return emotesVersion
}

export function registerEmotes(list: EmoteEntry[]) {
  dynamicEmotes = list
  rebuildIndex()
  emotesVersion++
}

export function getAllEmotes(): EmoteEntry[] {
  return Array.from(emoteById.values())
}

export function getEmote(id: string): EmoteEntry | undefined {
  return emoteById.get(id.toLowerCase())
}

const EMOTE_RE = /`([^`\n]{1,40})`/g

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const imgStyle = (size: number) =>
  `height:${size}px;width:auto;vertical-align:${Math.round(size * -0.22)}px;display:inline-block;`

export function renderCommentHTML(text: string, size = 20): string {
  return escapeHtml(text).replace(EMOTE_RE, (full, name: string) => {
    const emote = getEmote(name)
    if (!emote) return full
    const id = escapeHtml(emote.id)
    return `<img src="${escapeHtml(emote.imgUrl)}" alt="${id}" title="${id}" style="${imgStyle(size)}">`
  })
}

export function renderCommentNodes(text: string, size = 20): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0
  EMOTE_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = EMOTE_RE.exec(text)) !== null) {
    const emote = getEmote(match[1])
    if (!emote) continue
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    parts.push(
      <img
        key={key++}
        src={emote.imgUrl}
        alt={emote.id}
        title={emote.id}
        style={{ height: size, width: 'auto', verticalAlign: -4, display: 'inline-block' }}
      />
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length > 0 ? parts : [text]
}

'use client'

import { useMemo } from 'react'
import { useFollowedGame } from './useBingo'

const TEAM_EMOJI: Record<string, string> = { wave: '🌊', blaze: '🔥', radiant: '⭐' }
const UUID = /^[0-9a-f-]{8,64}$/i

export default function BingoTeamEmoji() {
  const g = useFollowedGame()
  const css = useMemo(() => {
    if (!g || g.game.status !== 'running') return ''
    const keyOf = new Map(g.teams.map(t => [t.id, t.key]))
    return g.members
      .filter(m => m.status === 'active')
      .map(m => {
        const e = TEAM_EMOJI[keyOf.get(m.teamId) ?? '']
        if (!e || !UUID.test(m.counter.uuid)) return ''
        const sel = `.post-name[data-u="${m.counter.uuid}"]`
        return `${sel} .post-emoji{display:none}${sel}::before{content:"${e} "}${sel}::after{content:" ${e}"}`
      })
      .join('')
  }, [g])
  return css ? <style>{css}</style> : null
}

import { cache } from 'react'
import { headers } from 'next/headers'
import { internalHeaders } from './apiFetch'
import type { SessionUser, MiscSettings } from './types'
import type { UserPrefs } from './prefs'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

export interface SessionResult {
  user: SessionUser | null
  reachable: boolean
  detail?: string
}

export const getSessionResult = cache(async (): Promise<SessionResult> => {
  try {
    const cookieHeader = (await headers()).get('cookie') ?? ''

    const res = await fetch(`${API}/api/auth/status`, {
      headers: { ...(await internalHeaders()), cookie: cookieHeader },
      cache: 'no-store',
    })

    if (res.status >= 500) {
      return { user: null, reachable: false, detail: `status ${res.status}` }
    }
    if (!res.ok) return { user: null, reachable: true }

    const data = await res.json()
    if (!data.user) return { user: null, reachable: true }

    const miscSettings: MiscSettings | undefined = data.miscSettings ?? undefined
    const counter = data.counter ?? undefined
    if (counter && counter.discordId && counter.avatar && counter.avatar.length > 5) {
      counter.avatarUrl = `https://cdn.discordapp.com/avatars/${counter.discordId}/${counter.avatar}`
    } else if (counter) {
      counter.avatarUrl = `https://cdn.discordapp.com/embed/avatars/0.png`
    }

    const u = data.user
    const userPrefs: UserPrefs = {
      pref_online:                     u.pref_online,
      pref_discord_pings:              u.pref_discord_pings,
      pref_load_from_bottom:           u.pref_load_from_bottom,
      pref_chat_default:               u.pref_chat_default,
      pref_milestones:                 u.pref_milestones,
      pref_strike_color:               u.pref_strike_color,
      pref_submit_shortcut:            u.pref_submit_shortcut,
      pref_clear:                      u.pref_clear,
      pref_nightMode:                  u.pref_nightMode,
      pref_standardize_format:         u.pref_standardize_format,
      pref_time_since_last_count:      u.pref_time_since_last_count,
      pref_custom_stricken:            u.pref_custom_stricken,
      pref_post_style:                 u.pref_post_style,
      pref_post_style_mobile:          u.pref_post_style_mobile,
      pref_reply_time_interval:        u.pref_reply_time_interval,
      pref_night_mode_colors:          u.pref_night_mode_colors,
      pref_post_position:              u.pref_post_position,
      pref_hide_stricken:              u.pref_hide_stricken,
      pref_highlight_last_count:       u.pref_highlight_last_count,
      pref_highlight_last_count_color: u.pref_highlight_last_count_color,
      pref_sound_on_stricken:          u.pref_sound_on_stricken,
      pref_hide_thread_picker:         u.pref_hide_thread_picker,
      pref_stricken_count_opacity:     u.pref_stricken_count_opacity,
      pref_timestamp_display:          u.pref_timestamp_display,
      pref_show_latency:               u.pref_show_latency,
      pref_post_font_size:             u.pref_post_font_size,
      threadPreferences:               u.threadPreferences ?? [],
    }

    return {
      reachable: true,
      user: {
        uuid: u.uuid,
        username: u.username,
        counter,
        items: data.items ?? [],
        money: Number(u.money ?? 0),
        unreadMentionCount: data.unreadMentionCount ?? 0,
        reddit: u.reddit ?? undefined,
        redditAccess: u.redditAccess ?? undefined,
        userPrefs,
        miscSettings,
        bingoGameId: data.bingoGameId ?? null,
      },
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'fetch failed'
    console.error(`[session] API unreachable: ${detail}`)
    return { user: null, reachable: false, detail }
  }
})

export async function getSession(): Promise<SessionUser | null> {
  return (await getSessionResult()).user
}

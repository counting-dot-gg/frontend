export interface ThreadPrefs {
  enabled?: boolean
  pref_online?: boolean | null
  pref_discord_pings?: boolean | null
  pref_load_from_bottom?: boolean | null
  pref_strike_color?: string | null
  pref_submit_shortcut?: string | null
  pref_clear?: string | null
  pref_nightMode?: string | null
  pref_standardize_format?: string | null
  pref_time_since_last_count?: boolean | null
  pref_custom_stricken?: string | null
  pref_post_style?: string | null
  pref_post_style_mobile?: string | null
  pref_reply_time_interval?: number | null
  pref_night_mode_colors?: string | null
  pref_post_position?: string | null
  pref_hide_stricken?: string | null
  pref_highlight_last_count?: boolean | null
  pref_highlight_last_count_color?: string | null
  pref_sound_on_stricken?: string | null
  pref_hide_thread_picker?: boolean | null
  pref_stricken_count_opacity?: number | null
  pref_timestamp_display?: string | null
  pref_pace_mode?: string
  pref_pace_counts?: number | null
  pref_pace_target_ms?: number | null
  pref_show_latency?: boolean | null
  pref_post_font_size?: number | null
  thread?: { uuid: string }
}

export interface UserPrefs {
  pref_online?: boolean
  pref_discord_pings?: boolean
  pref_load_from_bottom?: boolean
  pref_strike_color?: string
  pref_submit_shortcut?: string
  pref_clear?: string
  pref_nightMode?: string
  pref_standardize_format?: string
  pref_time_since_last_count?: boolean
  pref_custom_stricken?: string
  pref_post_style?: string
  pref_post_style_mobile?: string
  pref_reply_time_interval?: number
  pref_night_mode_colors?: string
  pref_post_position?: string
  pref_hide_stricken?: string
  pref_highlight_last_count?: boolean
  pref_highlight_last_count_color?: string
  pref_sound_on_stricken?: string
  pref_hide_thread_picker?: boolean
  pref_stricken_count_opacity?: number
  pref_timestamp_display?: string
  pref_pace_mode?: string
  pref_pace_counts?: number
  pref_pace_target_ms?: number
  pref_show_latency?: boolean
  pref_post_font_size?: number
  threadPreferences?: ThreadPrefs[]
  pref_chat_default?: string
  pref_milestones?: boolean
}

export interface ResolvedPrefs {
  pref_online: boolean
  pref_discord_pings: boolean
  pref_load_from_bottom: boolean
  pref_strike_color: string
  pref_submit_shortcut: string
  pref_clear: string
  pref_nightMode: string
  pref_standardize_format: string
  pref_time_since_last_count: boolean
  pref_custom_stricken: string
  pref_post_style: string
  pref_post_style_mobile: string
  pref_reply_time_interval: number
  pref_night_mode_colors: string
  pref_post_position: string
  pref_hide_stricken: string
  pref_highlight_last_count: boolean
  pref_highlight_last_count_color: string
  pref_sound_on_stricken: string
  pref_hide_thread_picker: boolean
  pref_stricken_count_opacity: number
  pref_timestamp_display: string
  pref_pace_mode: string
  pref_pace_counts: number
  pref_pace_target_ms: number
  pref_show_latency: boolean
  pref_post_font_size: number
  pref_chat_default: string
  pref_milestones: boolean
}

export const DEFAULT_PREFS: ResolvedPrefs = {
  pref_online: false,
  pref_discord_pings: false,
  pref_load_from_bottom: false,
  pref_strike_color: '#cccccc',
  pref_submit_shortcut: 'Enter',
  pref_clear: 'Clear',
  pref_nightMode: 'System',
  pref_standardize_format: 'Disabled',
  pref_time_since_last_count: false,
  pref_custom_stricken: 'Disabled',
  pref_post_style: 'Default',
  pref_post_style_mobile: 'Default',
  pref_reply_time_interval: 100,
  pref_night_mode_colors: 'Default',
  pref_post_position: 'Left',
  pref_hide_stricken: 'Disabled',
  pref_highlight_last_count: false,
  pref_highlight_last_count_color: '#006b99',
  pref_sound_on_stricken: 'Disabled',
  pref_hide_thread_picker: false,
  pref_stricken_count_opacity: 1,
  pref_timestamp_display: 'Milliseconds',
  pref_chat_default: 'Hidden',
  pref_milestones: true,
  pref_pace_mode: 'Split',
  pref_pace_counts: 100,
  pref_pace_target_ms: 0,
  pref_show_latency: true,
  pref_post_font_size: 16,
}

export function resolvePrefs(user: UserPrefs | null | undefined, threadUUID: string | null | undefined): ResolvedPrefs {
  const tp = (user?.threadPreferences ?? []).find(
    (p) => p.thread?.uuid === threadUUID && p.enabled,
  )

  function r<K extends keyof ResolvedPrefs>(key: K): ResolvedPrefs[K] {
    const threadVal = tp?.[key as keyof ThreadPrefs]
    const userVal = user?.[key as keyof UserPrefs]
    const def = DEFAULT_PREFS[key]
    const resolved = threadVal != null ? threadVal : userVal != null ? userVal : def
    return resolved as ResolvedPrefs[K]
  }

  return {
    pref_online:                    r('pref_online'),
    pref_discord_pings:             r('pref_discord_pings'),
    pref_load_from_bottom:          r('pref_load_from_bottom'),
    pref_strike_color:              r('pref_strike_color'),
    pref_submit_shortcut:           r('pref_submit_shortcut'),
    pref_clear:                     r('pref_clear'),
    pref_nightMode:                 r('pref_nightMode'),
    pref_standardize_format:        r('pref_standardize_format'),
    pref_time_since_last_count:     r('pref_time_since_last_count'),
    pref_custom_stricken:           r('pref_custom_stricken'),
    pref_post_style:                r('pref_post_style'),
    pref_post_style_mobile:         r('pref_post_style_mobile'),
    pref_reply_time_interval:       r('pref_reply_time_interval'),
    pref_night_mode_colors:         r('pref_night_mode_colors'),
    pref_post_position:             r('pref_post_position'),
    pref_hide_stricken:             r('pref_hide_stricken'),
    pref_highlight_last_count:      r('pref_highlight_last_count'),
    pref_highlight_last_count_color:r('pref_highlight_last_count_color'),
    pref_sound_on_stricken:         r('pref_sound_on_stricken'),
    pref_hide_thread_picker:        r('pref_hide_thread_picker'),
    pref_stricken_count_opacity:    r('pref_stricken_count_opacity'),
    pref_timestamp_display:         r('pref_timestamp_display'),
    pref_chat_default:              r('pref_chat_default'),
    pref_milestones:                r('pref_milestones'),
    pref_pace_mode:                 r('pref_pace_mode'),
    pref_pace_counts:               r('pref_pace_counts'),
    pref_pace_target_ms:            r('pref_pace_target_ms'),
    pref_show_latency:              r('pref_show_latency'),
    pref_post_font_size:            r('pref_post_font_size'),
  }
}

export const UNIMPLEMENTED_PREFS: ReadonlySet<string> = new Set([
  'pref_time_since_last_count',
  'pref_night_mode_colors',
  'pref_online',
  'pref_discord_pings',
])

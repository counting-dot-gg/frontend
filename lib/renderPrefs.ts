import { DEFAULT_PREFS, type ResolvedPrefs } from './prefs'

export interface RenderPrefs {
  pref_custom_stricken: string
  pref_strike_color: string
  pref_stricken_count_opacity: number
  pref_hide_stricken: string
  pref_standardize_format: string
  pref_show_latency: boolean
  pref_reply_time_interval: number
  pref_post_font_size: number
  pref_timestamp_display: string
}

export function toRenderPrefs(p: ResolvedPrefs): RenderPrefs {
  return {
    pref_custom_stricken: p.pref_custom_stricken,
    pref_strike_color: p.pref_strike_color,
    pref_stricken_count_opacity: p.pref_stricken_count_opacity,
    pref_hide_stricken: p.pref_hide_stricken,
    pref_standardize_format: p.pref_standardize_format,
    pref_show_latency: p.pref_show_latency,
    pref_reply_time_interval: p.pref_reply_time_interval,
    pref_post_font_size: p.pref_post_font_size,
    pref_timestamp_display: p.pref_timestamp_display,
  }
}

export function defaultRenderPrefs(): RenderPrefs {
  return toRenderPrefs(DEFAULT_PREFS)
}

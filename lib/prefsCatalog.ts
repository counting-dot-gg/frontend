import type { ResolvedPrefs } from './prefs'

export type PrefKind = 'toggle' | 'select' | 'number' | 'color'

export interface PrefDef {
  key: keyof ResolvedPrefs
  label: string
  hint?: string
  kind: PrefKind
  options?: string[]
  optionLabels?: Record<string, string>
  min?: number
  max?: number
  step?: number
  threadScoped?: boolean
}

export const PREF_CATALOG: PrefDef[] = [
  {
    key: 'pref_load_from_bottom',
    label: 'Load from bottom',
    hint: 'Newest counts appear at the bottom and the feed grows upward, the way a chat does.',
    kind: 'toggle',
  },
  {
    key: 'pref_post_style',
    label: 'Post style',
    hint: 'LC is the old site’s look: Verdana, no avatar. Minimal drops the whole meta column and puts the name first.',
    kind: 'select',
    options: ['Default', 'LC', 'Minimal'],
  },
  {
    key: 'pref_post_style_mobile',
    label: 'Post style (mobile)',
    hint: 'Used below 640px, so a phone can run a denser style than the desktop.',
    kind: 'select',
    options: ['Default', 'LC', 'Minimal'],
  },
  {
    key: 'pref_timestamp_display',
    label: 'Timestamp',
    hint: 'Milliseconds matter here in a way they would not elsewhere: a get is decided well inside one second.',
    kind: 'select',
    options: ['Milliseconds', 'Seconds', 'Hidden'],
  },
  {
    key: 'pref_post_position',
    label: 'Post position',
    hint: 'Which side of the row the timestamp, avatar and reply time sit on.',
    kind: 'select',
    options: ['Left', 'Right'],
  },
  {
    key: 'pref_hide_thread_picker',
    label: 'Hide thread picker',
    hint: 'Hides the left column. The picker is still reachable from the navbar.',
    kind: 'toggle',
  },
  {
    key: 'pref_pace_mode',
    label: 'Pace clock',
    hint: 'What the clock counts toward: the next split, the next get, or a run of your own length.',
    kind: 'select',
    options: ['Split', 'Get', 'Counts'],
  },
  {
    key: 'pref_pace_counts',
    label: 'Counts per run',
    hint: 'How many counts a run is, when the pace clock is set to Counts.',
    kind: 'number',
  },
  {
    key: 'pref_chat_default',
    label: 'Chat on load',
    hint: 'How the site chat starts. Hidden shows only the navbar button.',
    kind: 'select',
    options: ['Hidden', 'Collapsed', 'Open'],
    threadScoped: false,
  },
  {
    key: 'pref_milestones',
    label: 'Milestones',
    hint: 'The one-line notices for levels, ranks, PBs and records, and their tab in chat.',
    kind: 'toggle',
    threadScoped: false,
  },
]

export const PREF_BY_KEY: Record<string, PrefDef> = Object.fromEntries(
  PREF_CATALOG.map(d => [d.key as string, d]),
)

export const THREAD_SCOPED_KEYS = PREF_CATALOG
  .filter(d => d.threadScoped !== false)
  .map(d => d.key as string)

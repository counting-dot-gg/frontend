export type Theme = 'light' | 'dark'
export type NightModePref = 'System' | 'On' | 'Off'

export const SYSTEM_THEME_ENABLED = false

export const DEFAULT_THEME: Theme = 'dark'

export const THEME_STORAGE_KEY = 'cgg-theme'

export function resolveServerTheme(pref?: string | null): Theme | null {
  if (pref === 'On') return 'dark'
  if (pref === 'Off') return 'light'
  if (!SYSTEM_THEME_ENABLED) return DEFAULT_THEME
  return null
}

export const THEME_BOOTSTRAP = `(function(){try{
var e=document.documentElement;
var p=e.getAttribute('data-night-mode');
var t;
if(p==='On'){t='dark'}
else if(p==='Off'){t='light'}
else if(${String(SYSTEM_THEME_ENABLED)}){
  var s=null;try{s=localStorage.getItem('${THEME_STORAGE_KEY}')}catch(_){}
  t=(s==='light'||s==='dark')?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')
}
else{t='${DEFAULT_THEME}'}
e.classList.toggle('dark',t==='dark');
e.setAttribute('data-theme',t);
e.style.colorScheme=t;
}catch(_){}})()`

export function applyTheme(pref: string | null | undefined): void {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  let theme: Theme
  if (pref === 'On') theme = 'dark'
  else if (pref === 'Off') theme = 'light'
  else if (!SYSTEM_THEME_ENABLED) theme = DEFAULT_THEME
  else {
    let stored: string | null = null
    try { stored = localStorage.getItem(THEME_STORAGE_KEY) } catch {}
    theme = stored === 'light' || stored === 'dark'
      ? stored
      : window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  el.setAttribute('data-night-mode', pref ?? 'System')
  el.classList.toggle('dark', theme === 'dark')
  el.setAttribute('data-theme', theme)
  el.style.colorScheme = theme
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUpToLine, Expand, ExternalLink, Hash, Settings2, X } from 'lucide-react'

type Density = 'compact' | 'comfortable'
type CompactPreferences = {
  fontSize: number
  density: Density
  timestamps: boolean
  splits: boolean
  extras: boolean
}

const PREFS_KEY = 'counting-compact-prefs-v1'
const SIZE_KEY = 'counting-compact-size-v1'
const DEFAULT_PREFERENCES: CompactPreferences = {
  fontSize: 16,
  density: 'compact',
  timestamps: true,
  splits: true,
  extras: true,
}

function readPreferences(): CompactPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<CompactPreferences> | null
    if (!saved || typeof saved !== 'object') return { ...DEFAULT_PREFERENCES }
    return {
      fontSize: Number.isFinite(saved.fontSize) ? Math.max(12, Math.min(28, Math.round(saved.fontSize!))) : 16,
      density: saved.density === 'comfortable' ? 'comfortable' : 'compact',
      timestamps: typeof saved.timestamps === 'boolean' ? saved.timestamps : true,
      splits: typeof saved.splits === 'boolean' ? saved.splits : true,
      extras: typeof saved.extras === 'boolean' ? saved.extras : true,
    }
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

function applyPreferences(prefs: CompactPreferences) {
  const root = document.documentElement
  root.style.setProperty('--cgg-compact-font', `${prefs.fontSize}px`)
  root.style.setProperty('--cgg-compact-row-pad', prefs.density === 'comfortable' ? '8px' : '5px')
  root.dataset.cggCompactTimes = prefs.timestamps ? 'on' : 'off'
  root.dataset.cggCompactSplits = prefs.splits ? 'on' : 'off'
  root.dataset.cggCompactExtras = prefs.extras ? 'on' : 'off'
}

function readWindowSize(): { width: number; height: number } {
  try {
    const saved = JSON.parse(localStorage.getItem(SIZE_KEY) ?? 'null') as { width?: number; height?: number } | null
    const maxWidth = Math.max(360, screen.availWidth || 1920)
    const maxHeight = Math.max(300, screen.availHeight || 1080)
    return {
      width: Math.round(Math.max(360, Math.min(Number(saved?.width) || 600, maxWidth))),
      height: Math.round(Math.max(300, Math.min(Number(saved?.height) || 640, maxHeight))),
    }
  } catch {
    return { width: 600, height: 640 }
  }
}

export function CompactCountLauncher({ threadName }: { threadName: string }) {
  const open = () => {
    const url = new URL(`/thread/${encodeURIComponent(threadName)}`, location.origin)
    url.searchParams.set('compact', '1')
    const { width, height } = readWindowSize()
    const left = Math.round(window.screenX + (window.outerWidth - width) / 2)
    const top = Math.round(window.screenY + 40)
    const features = `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    const popup = window.open(url.href, `counting-compact-${threadName}`, features)
    if (popup) popup.focus()
    else window.location.assign(url.href)
  }

  return (
    <button type="button" className="cgg-compact-launch" onClick={open} title="Pop out counting window" aria-label="Pop out counting window">
      <ExternalLink size={15} aria-hidden="true" />
      <span>Pop out</span>
    </button>
  )
}

export function CompactCountToolbar({
  threadTitle,
  threadName,
  status,
  onLatest,
}: {
  threadTitle: string
  threadName: string
  status: string
  onLatest: () => void
}) {
  const [preferences, setPreferences] = useState<CompactPreferences>(DEFAULT_PREFERENCES)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    applyPreferences(readPreferences())
    let resizeTimer: ReturnType<typeof setTimeout> | undefined
    const saveSize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        try {
          localStorage.setItem(SIZE_KEY, JSON.stringify({ width: innerWidth, height: innerHeight }))
        } catch {}
      }, 350)
    }
    if (window.opener) window.addEventListener('resize', saveSize)
    return () => {
      window.removeEventListener('resize', saveSize)
      clearTimeout(resizeTimer)
      const root = document.documentElement
      root.style.removeProperty('--cgg-compact-font')
      root.style.removeProperty('--cgg-compact-row-pad')
      delete root.dataset.cggCompactTimes
      delete root.dataset.cggCompactSplits
      delete root.dataset.cggCompactExtras
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (settingsOpen && !dialog.open) dialog.showModal()
    if (!settingsOpen && dialog.open) dialog.close()
  }, [settingsOpen])

  const update = (change: Partial<CompactPreferences>) => {
    const next = { ...preferences, ...change }
    setPreferences(next)
    applyPreferences(next)
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch {}
  }

  const openSettings = () => {
    setPreferences(readPreferences())
    setSettingsOpen(true)
  }

  const fullHref = `/thread/${encodeURIComponent(threadName)}`
  const connection = status === 'live' ? 'Live' : status === 'disconnected' ? 'Offline' : 'Connecting'

  return (
    <>
      <div className="cgg-compact-toolbar" role="toolbar" aria-label="Compact counting controls">
        <span className="cgg-compact-mark"><Hash size={20} aria-hidden="true" /></span>
        <div className="cgg-compact-identity">
          <span className="cgg-compact-title" title={threadTitle}>{threadTitle}</span>
          <span className="cgg-compact-subtitle">
            counting.gg
            <span className="cgg-compact-status" data-state={status}>{connection === 'Live' ? '●' : '◌'} {connection}</span>
          </span>
        </div>
        <div className="cgg-compact-tools">
          <button type="button" onClick={onLatest} title="Latest counts" aria-label="Latest counts"><ArrowUpToLine size={17} /></button>
          <button type="button" onClick={openSettings} title="Display settings" aria-label="Display settings"><Settings2 size={17} /></button>
          <a href={fullHref} title="Full site" aria-label="Full site"><Expand size={17} /></a>
        </div>
      </div>

      <dialog ref={dialogRef} className="cgg-compact-dialog" onClose={() => setSettingsOpen(false)} aria-label="Compact counting display">
        <div className="cgg-compact-dialog-head">
          <h2>Display</h2>
          <button type="button" onClick={() => setSettingsOpen(false)} title="Close" aria-label="Close"><X size={17} /></button>
        </div>
        <label className="cgg-compact-font-row">
          <span>Count text</span>
          <output>{preferences.fontSize}px</output>
          <input type="range" min="12" max="28" step="1" value={preferences.fontSize} onChange={e => update({ fontSize: Number(e.target.value) })} />
        </label>
        <div className="cgg-compact-density" role="group" aria-label="Row spacing">
          <button type="button" aria-pressed={preferences.density === 'compact'} onClick={() => update({ density: 'compact' })}>Compact</button>
          <button type="button" aria-pressed={preferences.density === 'comfortable'} onClick={() => update({ density: 'comfortable' })}>Comfortable</button>
        </div>
        {([
          ['timestamps', 'Timestamps'],
          ['splits', 'Split times'],
          ['extras', 'Composer extras'],
        ] as const).map(([name, label]) => (
          <label key={name} className="cgg-compact-toggle">
            <span>{label}</span>
            <input type="checkbox" checked={preferences[name]} onChange={e => update({ [name]: e.target.checked })} />
          </label>
        ))}
      </dialog>
    </>
  )
}

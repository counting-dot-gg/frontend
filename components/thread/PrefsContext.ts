import { createContext, useContext } from 'react'
import { DEFAULT_PREFS, type ResolvedPrefs } from '@/lib/prefs'

export const PrefsContext = createContext<ResolvedPrefs>(DEFAULT_PREFS)
export const usePrefs = () => useContext(PrefsContext)

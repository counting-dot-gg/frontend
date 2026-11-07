'use client'

import { useEffect } from 'react'

const HYDRATION_TIMEOUT_MS = 8000

export const HYDRATION_FLAG = '__cggHydrated'
export const HYDRATION_BANNER_ID = 'cgg-hydration-warning'

export function HydrationBeacon() {
  useEffect(() => {
    ;(window as any)[HYDRATION_FLAG] = true
    const el = document.getElementById(HYDRATION_BANNER_ID)
    if (el) el.hidden = true
  }, [])
  return null
}

export const HYDRATION_WATCH_SCRIPT = `(function(){try{
setTimeout(function(){
  if(window['${HYDRATION_FLAG}'])return;
  var e=document.getElementById('${HYDRATION_BANNER_ID}');
  if(e)e.hidden=false;
},${HYDRATION_TIMEOUT_MS});
}catch(_){}})()`

export default function HydrationBanner() {
  return (
    <div
      id={HYDRATION_BANNER_ID}
      hidden
      role="alert"
      style={{
        background: '#78350f',
        color: '#fde68a',
        borderBottom: '1px solid #92400e',
        padding: '10px 16px',
        fontSize: 14,
        lineHeight: 1.45,
        textAlign: 'center',
      }}
    >
      <strong style={{ color: '#fff' }}>This page didn&apos;t finish loading.</strong>{' '}
      It rendered, but the interactive part never started, so buttons and live
      updates won&apos;t work.{' '}
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault()
          window.location.reload()
        }}
        style={{ color: '#fff', textDecoration: 'underline' }}
      >
        Reload the page
      </a>
      <span style={{ opacity: 0.85 }}> — if it keeps happening, let us know.</span>
    </div>
  )
}

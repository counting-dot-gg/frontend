'use client'

import { useEffect } from 'react'

const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png'

const isAvatar = (img: HTMLImageElement) => img.src.includes('cdn.discordapp.com/avatars/')

export default function AvatarFallback() {
  useEffect(() => {
    const swap = (img: HTMLImageElement) => {
      if (isAvatar(img)) {
        img.srcset = ''
        img.src = DEFAULT_AVATAR
      }
    }
    for (const img of document.images) {
      if (img.complete && img.naturalWidth === 0) swap(img)
    }
    const onError = (e: Event) => {
      if (e.target instanceof HTMLImageElement) swap(e.target)
    }
    document.addEventListener('error', onError, true)
    return () => document.removeEventListener('error', onError, true)
  }, [])
  return null
}

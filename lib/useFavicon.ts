'use client'

import { useCallback, useEffect, useRef } from 'react'

interface IconSnapshot {
  href: string
  type: string | null
  sizes: string | null
}

function setOrRemove(link: HTMLLinkElement, attr: string, value: string | null) {
  if (value == null) link.removeAttribute(attr)
  else link.setAttribute(attr, value)
}

const SIZE = 64
const BADGE = '#dc2626'
const BADGE_INK = '#ffffff'

export function useFavicon(iconHref = '/favicon.ico') {
  const count = useRef(0)
  const baseImage = useRef<HTMLImageElement | null>(null)
  const originals = useRef(new Map<HTMLLinkElement, IconSnapshot>())

  const iconLinks = useCallback((): HTMLLinkElement[] => {
    const links = [...document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']")]
    if (links.length) return links
    const link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
    return [link]
  }, [])

  const remember = useCallback((links: HTMLLinkElement[]) => {
    for (const link of links) {
      if (originals.current.has(link)) continue
      originals.current.set(link, {
        href: link.href || iconHref,
        type: link.getAttribute('type'),
        sizes: link.getAttribute('sizes'),
      })
    }
  }, [iconHref])

  const restore = useCallback((links: HTMLLinkElement[]) => {
    for (const link of links) {
      const snap = originals.current.get(link)
      if (!snap) continue
      link.href = snap.href
      setOrRemove(link, 'type', snap.type)
      setOrRemove(link, 'sizes', snap.sizes)
    }
  }, [])

  const draw = useCallback(() => {
    const img = baseImage.current
    const links = iconLinks()
    remember(links)

    if (count.current <= 0) {
      restore(links)
      return
    }
    if (!img?.complete || img.naturalWidth === 0) return

    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(img, 0, 0, SIZE, SIZE)

    const label = count.current > 99 ? '99+' : String(count.current)
    const fontSize = label.length > 2 ? 26 : 32
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`
    const textWidth = ctx.measureText(label).width
    const padding = 8
    const w = Math.max(28, textWidth + padding * 2)
    const h = 30
    const x = SIZE - w
    const y = SIZE - h
    const r = h / 2

    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
    ctx.fillStyle = BADGE
    ctx.fill()

    ctx.fillStyle = BADGE_INK
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x + w / 2, y + h / 2 + 1)

    const badged = canvas.toDataURL('image/png')
    for (const link of links) {
      link.setAttribute('sizes', 'any')
      link.type = 'image/png'
      link.href = badged
    }
  }, [iconLinks, remember, restore])

  useEffect(() => {
    const links = iconLinks()
    remember(links)
    const source = originals.current.get(links[0])?.href ?? iconHref

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = source
    baseImage.current = img

    const onVisibility = () => {
      if (document.hidden) return
      count.current = 0
      draw()
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      count.current = 0
      restore(iconLinks())
    }
  }, [draw, iconHref, iconLinks, remember, restore])

  return useCallback(() => {
    if (!document.hidden) return
    count.current += 1
    draw()
  }, [draw])
}

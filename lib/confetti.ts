'use client'

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  w: number
  h: number
  color: string
}

const COLORS = ['#f97316', 'var(--success)', '#38bdf8', '#e879f9', '#facc15', '#f43f5e']

let active = false

export function confettiBurst(pieceCount = 140): void {
  if (typeof window === 'undefined') return
  if (active) return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  active = true

  const canvas = document.createElement('canvas')
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.cssText =
    `position:fixed;inset:0;width:${w}px;height:${h}px;pointer-events:none;z-index:10000`
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) { canvas.remove(); active = false; return }
  ctx.scale(dpr, dpr)

  const pieces: Piece[] = Array.from({ length: pieceCount }, () => ({
    x: Math.random() * w,
    y: -20 - Math.random() * h * 0.3,
    vx: (Math.random() - 0.5) * 2.4,
    vy: 2 + Math.random() * 3.5,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.3,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }))

  let raf = 0
  const started = performance.now()

  const frame = (now: number) => {
    ctx.clearRect(0, 0, w, h)
    let visible = 0

    for (const p of pieces) {
      p.vy += 0.05
      p.vx *= 0.995
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr

      if (p.y < h + 40) {
        visible++
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot)))
        ctx.restore()
      }
    }

    if (visible === 0 || now - started > 6000) {
      canvas.remove()
      active = false
      return
    }
    raf = requestAnimationFrame(frame)
  }

  raf = requestAnimationFrame(frame)

  setTimeout(() => {
    if (canvas.isConnected) {
      cancelAnimationFrame(raf)
      canvas.remove()
      active = false
    }
  }, 6500)
}

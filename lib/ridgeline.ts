export const RIDGE_H = 120

export const RIDGE_VISIBLE_PX = Math.round(RIDGE_H * 0.62)

export function hashUnit(seed: string, salt: number): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

const SAMPLES = 72

function ridgeYs(seed: string, salt: number, peaked: boolean, scale: number): number[] {
  const octaves = [
    { freq: 0.9 + hashUnit(seed, salt) * 0.5, amp: 1, phase: hashUnit(seed, salt + 1) },
    { freq: 2.3 + hashUnit(seed, salt + 2) * 1.4, amp: 0.45, phase: hashUnit(seed, salt + 3) },
    { freq: 5.1 + hashUnit(seed, salt + 4) * 2.6, amp: 0.18, phase: hashUnit(seed, salt + 5) },
  ]
  const total = octaves.reduce((s, o) => s + o.amp, 0)

  const ys: number[] = []
  for (let i = 0; i <= SAMPLES; i++) {
    const x = i / SAMPLES
    let h = 0
    for (const o of octaves) {
      h += o.amp * (0.5 + 0.5 * Math.sin(2 * Math.PI * (x * o.freq + o.phase)))
    }
    h /= total
    if (peaked) h = Math.pow(h, 1.7)
    ys.push(RIDGE_H - (0.18 + h * 0.82) * RIDGE_H * scale)
  }
  return ys
}

function toPath(ys: number[]): string {
  const pts = ys.map((y, i) => `${((i / SAMPLES) * 100).toFixed(2)},${y.toFixed(2)}`)
  return `M0,${RIDGE_H} L${pts.join(' L')} L100,${RIDGE_H} Z`
}

export function farRidgePath(seed: string): string {
  return toPath(ridgeYs(seed, 101, true, 1))
}

export function nearRidgePath(seed: string): string {
  return toPath(ridgeYs(seed, 211, false, 0.5))
}

export function ridgeMaskDataUri(seed: string): string {
  const far = ridgeYs(seed, 101, true, 1)
  const near = ridgeYs(seed, 211, false, 0.5)
  const envelope = far.map((y, i) => Math.min(y, near[i]))

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${RIDGE_H}" ` +
    `preserveAspectRatio="none">` +
    `<path fill="#fff" fill-rule="evenodd" ` +
    `d="M0,0 H100 V${RIDGE_H} H0 Z ${toPath(envelope)}"/>` +
    `</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

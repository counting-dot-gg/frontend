const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const HSL = /^hsl\(\d{1,3}(?:\.\d+)?, ?\d{1,3}(?:\.\d+)?%, ?\d{1,3}(?:\.\d+)?%\)$/i

export function safeColor(color: string | null | undefined, fallback = '#888888'): string {
  const value = (color ?? '').trim()
  return HEX.test(value) || HSL.test(value) ? value : fallback
}

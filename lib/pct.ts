export function truncatedPercent(
  pct: number,
  digits = 2,
  parts?: { part: number; whole: number },
): string {
  const scale = 10 ** digits
  let units: number
  if (parts && Number.isFinite(parts.part) && Number.isFinite(parts.whole) && parts.whole > 0) {
    units = Math.floor((parts.part * 100 * scale) / parts.whole)
  } else if (Number.isFinite(pct)) {
    units = Math.floor(pct * scale + 1e-7)
  } else {
    return (0).toFixed(digits)
  }
  return (units / scale).toFixed(digits)
}

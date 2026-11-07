export function isPointerPress(e: { detail?: number }): boolean {
  return (e?.detail ?? 0) > 0
}

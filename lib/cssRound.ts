export function alpha8(a: number): string {
  return (Math.round(Math.max(0, Math.min(1, a)) * 255) / 255).toFixed(3)
}

export function px(n: number): string {
  return `${n.toFixed(2)}px`
}

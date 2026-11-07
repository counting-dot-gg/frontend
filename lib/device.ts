import { headers } from 'next/headers'

export async function isProbablyMobile(): Promise<boolean> {
  const h = await headers()

  const chMobile = h.get('sec-ch-ua-mobile')
  if (chMobile === '?1') return true
  if (chMobile === '?0') return false

  const ua = h.get('user-agent') ?? ''
  return /Android.*Mobile|iPhone|iPod|Windows Phone/i.test(ua)
}

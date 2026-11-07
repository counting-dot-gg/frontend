import type { Metadata } from 'next'
import { getSession } from '@/lib/session'
import ShopClient from './ShopClient'

export const metadata: Metadata = {
  title: 'Shop | counting.gg',
}

export default async function ShopPage() {
  const session = await getSession()
  return (
    <ShopClient
      userUUID={session?.uuid ?? null}
      isLoggedIn={!!session}
      initialMoney={session?.money ?? 0}
      initialOwned={(session?.items ?? []).map(i => i.id)}
    />
  )
}

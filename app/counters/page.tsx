import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { apiFetch } from '@/lib/apiFetch'
import CountersClient from './CountersClient'

export const metadata: Metadata = {
  title: 'Counters | counting.gg',
}

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'
const PER_PAGE = 50

interface Counter {
  uuid: string
  discordId: string
  name: string
  username: string
  color: string
  roles: string[]
  avatar: string
  emoji?: string
  title?: string
  xp: number
  pronouns?: [string, string, string, string]
}

async function fetchCounters(page: number): Promise<{ counters: Counter[]; totalCount: number } | null> {
  try {
    const cookieHeader = (await headers()).get('cookie') ?? ''
    const res = await apiFetch(`${API}/api/counter/counters/${page}`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    return { counters: data.counters ?? [], totalCount: data.pageCount ?? 0 }
  } catch {
    return null
  }
}

export default async function CountersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1') || 1)
  const data = await fetchCounters(page)

  const totalPages = data ? Math.ceil(data.totalCount / PER_PAGE) : 1
  const safePage = Math.min(page, totalPages)

  const counters = (safePage !== page && data)
    ? (await fetchCounters(safePage))?.counters ?? []
    : data?.counters ?? []

  return (
    <CountersClient
      counters={counters}
      page={safePage}
      totalPages={totalPages}
      totalCount={data?.totalCount ?? 0}
    />
  )
}

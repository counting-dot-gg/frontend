import 'server-only'
import { buildColorTable, type UserColorTable } from './redditUserColors'
import type { LiveThreadSnapshot } from './reddit'

const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token'
const UA = 'web:gg.counting:v1.0 (by /u/countinggg)'
const COLORS_URL =
  'https://raw.githubusercontent.com/co3carbonate/live-counting-extension/master/src/data/user-colors.json'

let cachedToken: { value: string; expiresAt: number } | null = null

export async function appToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value

  const id = process.env.REDDIT_CLIENT_ID
  const secret = process.env.REDDIT_CLIENT_SECRET
  if (!id || !secret) throw new Error('reddit app credentials not configured')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`token ${res.status}`)
  const json = await res.json()
  if (!json.access_token) throw new Error('no access_token')
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
  }
  return cachedToken.value
}

export async function fetchLiveThreadServer(
  threadId: string,
  limit: number,
  after?: string,
): Promise<LiveThreadSnapshot> {
  const token = await appToken()
  const auth = {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': UA },
    cache: 'no-store' as const,
  }
  const [aboutRes, listRes] = await Promise.all([
    fetch(`https://oauth.reddit.com/live/${threadId}/about`, auth),
    fetch(`https://oauth.reddit.com/live/${threadId}?limit=${limit}${after ? `&after=${encodeURIComponent(after)}` : ''}`, auth),
  ])
  if (!aboutRes.ok) throw new Error(`about ${aboutRes.status}`)
  const about = (await aboutRes.json())?.data ?? {}
  const children = listRes.ok ? (await listRes.json())?.data?.children ?? [] : []
  return {
    about,
    posts: children.map((c: any) => ({
      id: c.data.id,
      author: c.data.author,
      body: c.data.body,
      stricken: !!c.data.stricken,
    })),
  }
}

export async function loadColorTableServer(): Promise<UserColorTable> {
  try {
    const res = await fetch(COLORS_URL, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(String(res.status))
    return buildColorTable(await res.json())
  } catch {
    return { overrides: new Map(), defaults: [] }
  }
}

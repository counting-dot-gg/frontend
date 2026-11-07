import { fetchLiveThreadServer } from '@/lib/redditServer'

const ALLOWED = new Set(['ta535s1hq2je', '14ny3ur3axhd4'])

export async function GET(req: Request) {
  const url = new URL(req.url)
  const thread = url.searchParams.get('thread') ?? ''
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 25))
  const afterRaw = url.searchParams.get('after') ?? ''
  const after = /^LiveUpdate_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(afterRaw)
    ? afterRaw
    : undefined

  if (!ALLOWED.has(thread)) {
    return Response.json({ error: 'unknown thread' }, { status: 400 })
  }

  try {
    const snapshot = await fetchLiveThreadServer(thread, limit, after)
    return Response.json(snapshot, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'reddit unavailable' },
      { status: 502 },
    )
  }
}

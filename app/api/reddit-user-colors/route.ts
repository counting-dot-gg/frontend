const SOURCE =
  'https://raw.githubusercontent.com/co3carbonate/live-counting-extension/master/src/data/user-colors.json'

export const revalidate = 3600

export async function GET() {
  try {
    const res = await fetch(SOURCE, { next: { revalidate } })
    if (!res.ok) throw new Error(String(res.status))
    const data = await res.json()
    return Response.json(data, {
      headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=86400' },
    })
  } catch {
    return Response.json({ defaults: [], overrides: {} }, { status: 200 })
  }
}

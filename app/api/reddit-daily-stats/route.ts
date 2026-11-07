const SOURCE = 'https://raw.githubusercontent.com/MaybeNotWrong/lc-sep/master/data.txt'

export const revalidate = 15

export async function GET() {
  try {
    const res = await fetch(SOURCE, { next: { revalidate } })
    if (!res.ok) throw new Error(String(res.status))
    const data = JSON.parse(await res.text())
    return Response.json(data, {
      headers: { 'Cache-Control': 'public, max-age=10, stale-while-revalidate=60' },
    })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'unavailable' },
      { status: 502 },
    )
  }
}

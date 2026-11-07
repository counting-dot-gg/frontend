import { readFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { easternDayKey } from '@/lib/daylight'
import { wisdomForDay } from '@/lib/dailyWisdom'

const API = process.env.API_HOST || process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:3001'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

async function isUnlocked(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/api/site-goals`, { cache: 'no-store' })
    if (!res.ok) return false
    const goals = await res.json()
    if (!Array.isArray(goals)) return false
    return goals.some((g: any) => g?.goalKey === 'crystal_ball' && g?.unlocked)
  } catch {
    return false
  }
}

export async function GET() {
  if (!(await isUnlocked())) {
    return new NextResponse('Not found', { status: 404 })
  }

  const wisdom = wisdomForDay(easternDayKey())
  if (!wisdom) return new NextResponse('Not found', { status: 404 })

  const ext = path.extname(wisdom.file).toLowerCase()
  const type = CONTENT_TYPES[ext]
  if (!type) return new NextResponse('Not found', { status: 404 })

  try {
    const file = await readFile(
      path.join(process.cwd(), 'private', 'dailyWisdom', wisdom.file),
    )
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'private, max-age=900',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}

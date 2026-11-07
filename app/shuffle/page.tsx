import type { Metadata } from 'next'
import { getSession } from '@/lib/session'
import { decodeShuffleResult, describeShuffleResult, isPerfect } from '@/lib/shuffleShare'
import ShuffleClient from './ShuffleClient'

type PageProps = {
  searchParams: Promise<{ seed?: string; r?: string; size?: string; u?: string; d?: string }>
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams
  const result = decodeShuffleResult(sp.r)

  if (!result) {
    return {
      title: 'Number Shuffle | counting.gg',
      description:
        '10 random numbers between 1 and 1000. Order the numbers from smallest to largest. ' +
        'Once you place a number, you cannot move it. The game ends when you place all numbers, ' +
        'or there are no more possible moves.',
    }
  }

  const headline = isPerfect(result)
    ? `Perfect ${result.size}/${result.size} in Number Shuffle`
    : `${result.score}/${result.size} in Number Shuffle`
  const description = `${describeShuffleResult(result)} Play the same seed and try to beat it.`

  const ogParams = new URLSearchParams({
    score: String(result.score),
    size: String(result.size),
    seed: result.seed,
  })

  return {
    title: `${headline} | counting.gg`,
    description,
    openGraph: {
      title: headline,
      description,
      siteName: 'counting.gg',
      images: [{ url: `/api/og/shuffle?${ogParams}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: headline,
      description,
      images: [`/api/og/shuffle?${ogParams}`],
    },
  }
}

export default async function ShufflePage({ searchParams }: PageProps) {
  const [sp, session] = await Promise.all([searchParams, getSession()])
  const sharedResult = decodeShuffleResult(sp.r)
  const size = Number(sp.size)

  return (
    <ShuffleClient
      isLoggedIn={!!session}
      username={session?.counter?.username ?? session?.username}
      initialSeed={sp.seed ?? null}
      sharedResult={sharedResult}
      initialSize={Number.isInteger(size) && size >= 2 && size <= 20 ? size : null}
    />
  )
}

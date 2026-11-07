const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}

function iso(stamp: string | number | undefined): string | undefined {
  if (stamp === undefined || stamp === null) return undefined
  const ms = Number(stamp)
  if (!Number.isFinite(ms) || ms <= 0) return undefined
  return new Date(ms).toISOString()
}

export function articleJsonLd(opts: {
  title: string
  description: string
  path: string
  published?: string | number
  modified?: string | number
  authorName?: string
  authorPath?: string
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.title,
    description: opts.description,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}${opts.path}` },
    datePublished: iso(opts.published),
    dateModified: iso(opts.modified) ?? iso(opts.published),
    author: opts.authorName
      ? {
          '@type': 'Person',
          name: opts.authorName,
          ...(opts.authorPath ? { url: `${SITE_URL}${opts.authorPath}` } : {}),
        }
      : undefined,
    publisher: {
      '@type': 'Organization',
      name: 'counting.gg',
      url: SITE_URL,
    },
  }
}

export function profileJsonLd(opts: {
  name: string
  username: string
  path: string
  avatarUrl?: string
  joined?: string | number
  description?: string
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    dateCreated: iso(opts.joined),
    mainEntity: {
      '@type': 'Person',
      name: opts.name,
      alternateName: opts.username,
      identifier: opts.username,
      url: `${SITE_URL}${opts.path}`,
      ...(opts.avatarUrl ? { image: opts.avatarUrl } : {}),
      ...(opts.description ? { description: opts.description } : {}),
    },
  }
}

import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'counting.gg',
    short_name: 'counting.gg',
    description: 'The largest counting site on the internet.',
    start_url: '/threads',
    display: 'standalone',
    background_color: 'var(--surface-0)',
    theme_color: 'var(--surface-0)',
    orientation: 'any',
    categories: ['games', 'social'],
    icons: [
      {
        src: '/app-icon',
        sizes: '512x512 192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/app-icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}

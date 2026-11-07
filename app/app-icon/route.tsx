import { ImageResponse } from 'next/og'

export const dynamic = 'force-static'

const size = { width: 512, height: 512 }

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0f',
          color: '#f97316',
          fontSize: 300,
          fontWeight: 900,
          letterSpacing: '-0.06em',
        }}
      >
        gg
      </div>
    ),
    size,
  )
}

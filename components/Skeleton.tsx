export function SkeletonStyles() {
  return (
    <style>{`
      @keyframes cggSkeleton { 0% { background-position: -420px 0 } 100% { background-position: 420px 0 } }
      .cg-sk {
        background: linear-gradient(90deg,
          rgb(var(--ink-rgb) / 0.04) 25%,
          rgb(var(--ink-rgb) / 0.085) 50%,
          rgb(var(--ink-rgb) / 0.04) 75%);
        background-size: 420px 100%;
        animation: cggSkeleton 1.25s infinite linear;
      }
      @media (prefers-reduced-motion: reduce) {
        .cg-sk { animation: none; background: rgb(var(--ink-rgb) / 0.06) }
      }
    `}</style>
  )
}

export function Bar({ w = '100%', h = 12, r = 4, style }: {
  w?: number | string
  h?: number
  r?: number
  style?: React.CSSProperties
}) {
  return <div className="cg-sk" style={{ width: w, height: h, borderRadius: r, ...style }} />
}

export function Circle({ size = 32 }: { size?: number }) {
  return <div className="cg-sk" style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0 }} />
}

export function CardSkeleton({ height = 120 }: { height?: number }) {
  return (
    <div style={{
      height, borderRadius: 10, padding: 14,
      border: '1px solid rgb(var(--ink-rgb) / 0.07)', background: 'rgb(var(--ink-rgb) / 0.02)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <Bar w="60%" h={14} />
      <Bar w="85%" h={10} />
      <Bar w="40%" h={10} />
    </div>
  )
}

export function CardGridSkeleton({ count = 12, minWidth = 240, height = 120 }: {
  count?: number
  minWidth?: number
  height?: number
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`,
      gap: 12,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} height={height} />
      ))}
    </div>
  )
}

export function RowSkeleton({ avatar = 32 }: { avatar?: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
      borderBottom: '1px solid rgb(var(--ink-rgb) / 0.05)',
    }}>
      <Bar w={22} h={10} />
      <Circle size={avatar} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Bar w="35%" h={12} />
        <Bar w="20%" h={9} />
      </div>
      <Bar w={54} h={12} />
    </div>
  )
}

export function ListSkeleton({ count = 10, avatar = 32 }: { count?: number; avatar?: number }) {
  return (
    <div style={{ border: '1px solid rgb(var(--ink-rgb) / 0.07)', borderRadius: 10, overflow: 'hidden' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ opacity: 1 - i * 0.07 }}>
          <RowSkeleton avatar={avatar} />
        </div>
      ))}
    </div>
  )
}

export function HeaderSkeleton({ width = 200 }: { width?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
      <Bar w={width} h={26} r={6} />
      <Bar w={Math.round(width * 1.6)} h={11} />
    </div>
  )
}

export function PageSkeleton({ maxWidth = 900, padding = '24px 16px', children }: {
  maxWidth?: number
  padding?: string
  children: React.ReactNode
}) {
  return (
    <main style={{ minHeight: '100vh' }}>
      <SkeletonStyles />
      <div style={{ maxWidth, margin: '0 auto', padding }}>{children}</div>
    </main>
  )
}

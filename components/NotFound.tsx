import Link from 'next/link'

export default function NotFound({
  emoji = '🔍',
  title,
  links,
}: {
  emoji?: string
  title: string
  links: { href: string; label: string }[]
}) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 14, padding: '64px 20px', textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 40, lineHeight: 1 }} aria-hidden="true">{emoji}</div>

      <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
        {title}
      </h1>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
        {links.map((l, i) => (
          <Link
            key={l.href}
            href={l.href}
            style={i === 0
              ? {
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 13,
                  textDecoration: 'none',
                }
              : {
                  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  border: '1px solid rgb(var(--ink-rgb) / 0.15)', color: '#ccc', textDecoration: 'none',
                }}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

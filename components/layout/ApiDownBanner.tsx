export default function ApiDownBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: '#7f1d1d',
        color: '#fecaca',
        borderBottom: '1px solid #991b1b',
        padding: '10px 16px',
        fontSize: 14,
        lineHeight: 1.45,
        textAlign: 'center',
      }}
    >
      <strong style={{ color: '#fff' }}>counting.gg is having trouble.</strong>{' '}
      We can&apos;t reach the server right now, so counts, logins and live
      updates won&apos;t work. Anything shown below is out of date.{' '}
      <span style={{ opacity: 0.85 }}>Try again shortly.</span>
    </div>
  )
}

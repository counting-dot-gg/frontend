import { PageSkeleton, HeaderSkeleton, CardSkeleton, Bar, Circle } from '@/components/Skeleton'

export default function Loading() {
  return (
    <PageSkeleton maxWidth={1100} padding="24px 16px">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Circle size={96} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <HeaderSkeleton width={220} />
          <Bar w={140} h={14} style={{ marginTop: 10 }} />
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 12,
        marginBottom: 24,
      }}>
        {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} height={84} />)}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ opacity: 1 - i * 0.15 }}><CardSkeleton height={120} /></div>
        ))}
      </div>
    </PageSkeleton>
  )
}

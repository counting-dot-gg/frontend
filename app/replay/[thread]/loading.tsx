import { PageSkeleton, HeaderSkeleton, CardSkeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <PageSkeleton maxWidth={1100}>
      <HeaderSkeleton width={220} />
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ opacity: 1 - i * 0.15 }}><CardSkeleton height={200} /></div>
        ))}
      </div>
    </PageSkeleton>
  )
}

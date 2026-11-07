import { PageSkeleton, HeaderSkeleton, CardSkeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <PageSkeleton maxWidth={860} padding="24px 16px">
      <HeaderSkeleton width={150} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ opacity: 1 - i * 0.1 }}>
            <CardSkeleton height={104} />
          </div>
        ))}
      </div>
    </PageSkeleton>
  )
}

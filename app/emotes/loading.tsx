import { PageSkeleton, HeaderSkeleton, CardGridSkeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <PageSkeleton maxWidth={1000}>
      <HeaderSkeleton width={160} />
      <div style={{ marginTop: 20 }}>
        <CardGridSkeleton count={24} minWidth={120} height={96} />
      </div>
    </PageSkeleton>
  )
}

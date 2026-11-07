import { PageSkeleton, HeaderSkeleton, CardGridSkeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <PageSkeleton maxWidth={1000}>
      <HeaderSkeleton width={180} />
      <div style={{ marginTop: 20 }}>
        <CardGridSkeleton count={12} minWidth={200} height={140} />
      </div>
    </PageSkeleton>
  )
}

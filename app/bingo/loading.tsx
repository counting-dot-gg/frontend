import { PageSkeleton, HeaderSkeleton, CardGridSkeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <PageSkeleton maxWidth={1100}>
      <HeaderSkeleton width={200} />
      <div style={{ marginTop: 20 }}>
        <CardGridSkeleton count={6} minWidth={260} height={180} />
      </div>
    </PageSkeleton>
  )
}

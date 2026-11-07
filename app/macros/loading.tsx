import { PageSkeleton, HeaderSkeleton, ListSkeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <PageSkeleton maxWidth={900}>
      <HeaderSkeleton width={160} />
      <div style={{ marginTop: 20 }}>
        <ListSkeleton count={10} avatar={0} />
      </div>
    </PageSkeleton>
  )
}

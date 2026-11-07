import { PageSkeleton, HeaderSkeleton, ListSkeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <PageSkeleton maxWidth={900}>
      <HeaderSkeleton width={200} />
      <div style={{ marginTop: 20 }}>
        <ListSkeleton count={10} avatar={36} />
      </div>
    </PageSkeleton>
  )
}

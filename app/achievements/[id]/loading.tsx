import { PageSkeleton, HeaderSkeleton, ListSkeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <PageSkeleton maxWidth={900}>
      <HeaderSkeleton width={260} />
      <div style={{ marginTop: 20 }}>
        <ListSkeleton count={10} avatar={32} />
      </div>
    </PageSkeleton>
  )
}

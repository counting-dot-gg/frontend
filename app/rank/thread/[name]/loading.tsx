import { PageSkeleton, HeaderSkeleton, ListSkeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <PageSkeleton maxWidth={1000}>
      <HeaderSkeleton width={240} />
      <div style={{ marginTop: 20 }}>
        <ListSkeleton count={12} avatar={32} />
      </div>
    </PageSkeleton>
  )
}

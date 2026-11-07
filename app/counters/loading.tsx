import { PageSkeleton, HeaderSkeleton, ListSkeleton, Bar } from '@/components/Skeleton'

export default function Loading() {
  return (
    <PageSkeleton maxWidth={700}>
      <HeaderSkeleton width={130} />
      <Bar w="100%" h={34} r={8} style={{ marginBottom: 16 }} />
      <ListSkeleton count={12} />
    </PageSkeleton>
  )
}

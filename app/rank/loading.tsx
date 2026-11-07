import { PageSkeleton, HeaderSkeleton, Bar, ListSkeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <PageSkeleton maxWidth={900} padding="32px 16px">
      <HeaderSkeleton width={200} />
      <Bar w="100%" h={120} r={12} style={{ marginBottom: 18 }} />
      <ListSkeleton count={10} avatar={28} />
    </PageSkeleton>
  )
}

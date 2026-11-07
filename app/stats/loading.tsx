import { PageSkeleton, HeaderSkeleton, Bar } from '@/components/Skeleton'

export default function Loading() {
  return (
    <PageSkeleton maxWidth={1100} padding="24px 16px">
      <HeaderSkeleton width={120} />
      <Bar w="100%" h={40} r={8} style={{ marginBottom: 14 }} />
      <Bar w="100%" h={260} r={12} style={{ marginBottom: 18 }} />
      <Bar w="100%" h={200} r={10} />
    </PageSkeleton>
  )
}

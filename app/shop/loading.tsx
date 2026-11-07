import { PageSkeleton, HeaderSkeleton, CardGridSkeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <PageSkeleton maxWidth={1200} padding="24px 16px">
      <HeaderSkeleton width={110} />
      <CardGridSkeleton count={18} minWidth={160} height={170} />
    </PageSkeleton>
  )
}

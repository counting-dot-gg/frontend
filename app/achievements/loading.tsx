import { PageSkeleton, HeaderSkeleton, CardGridSkeleton } from '@/components/Skeleton'

export default function Loading() {
  return (
    <PageSkeleton maxWidth={1200} padding="24px 16px">
      <HeaderSkeleton width={210} />
      <CardGridSkeleton count={12} minWidth={240} height={128} />
    </PageSkeleton>
  )
}

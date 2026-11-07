import { PageSkeleton, HeaderSkeleton, Bar } from '@/components/Skeleton'

const LINES = [100, 96, 98, 92, 99, 70, 0, 97, 94, 99, 88, 96, 61]

export default function Loading() {
  return (
    <PageSkeleton maxWidth={760} padding="32px 16px">
      <HeaderSkeleton width={420} />
      <Bar w={180} h={14} style={{ margin: '14px 0 28px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {LINES.map((w, i) =>
          w === 0
            ? <div key={i} style={{ height: 12 }} />
            : <Bar key={i} w={`${w}%`} h={14} />,
        )}
      </div>
    </PageSkeleton>
  )
}

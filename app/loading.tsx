import { SkeletonStyles } from '@/components/Skeleton'
import { easternHourFraction, skyAt } from '@/lib/daylight'

const CARD = '#FFF4DF'
const CARD_INK = '#241C12'

const STACK_BELOW = 1024
const PARK_PEEK_PX = 460
const SLANT = 'polygon(20px 0, 100% 0, calc(100% - 20px) 100%, 0 100%)'
const TILE_BORDER = 3

const MENU = [
  { color: '#f97316', height: 104, span: 2 },
  { color: '#a78bfa', height: 56, span: 1 },
  { color: '#38bdf8', height: 56, span: 1 },
  { color: '#475569', height: 56, span: 1 },
]

const DISCORD_FACE = '#5865F2'

const GAMES = [
  { color: '#2dd4bf', span: 2 },
  { color: 'var(--success-ink)', span: 1 },
  { color: '#f472b6', span: 1 },
]

function CardBar({ w = '100%', h = 12, r = 6 }: { w?: number | string; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'rgba(36, 28, 18, 0.10)',
    }} />
  )
}

function TileBar({ w = '42%', h = 11 }: { w?: number | string; h?: number }) {
  return (
    <div style={{ width: w, height: h, borderRadius: 5, background: 'rgba(0, 0, 0, 0.20)' }} />
  )
}

function Avatar({ size }: { size: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'rgba(36, 28, 18, 0.10)', flexShrink: 0,
    }} />
  )
}

function SkelTile({ color, height = 56, span = 1 }: {
  color: string; height?: number; span?: number
}) {
  return (
    <div style={{
      gridColumn: `span ${span}`,
      clipPath: SLANT,
      background: CARD_INK,
      padding: TILE_BORDER,
    }}>
      <div style={{
        clipPath: SLANT,
        height,
        background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <TileBar />
      </div>
    </div>
  )
}

function BlogRailSkeleton() {
  return (
    <section style={{
      marginTop: 22, paddingTop: 16, minWidth: 0,
      borderTop: '1px solid rgb(var(--ink-rgb) / 0.28)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 12, marginBottom: 10,
      }}>
        <div style={{ width: 54, height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.30)' }} />
        <div style={{ width: 66, height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.22)' }} />
      </div>

      <div style={{
        padding: '13px 15px', borderRadius: 12, marginBottom: 7,
        background: CARD,
        border: `2px solid ${CARD_INK}`,
        boxShadow: `0 4px 0 ${CARD_INK}`,
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Avatar size={34} />
          <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <CardBar w="78%" h={13} />
            <CardBar w="92%" h={10} />
            <CardBar w="64%" h={10} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '6px 10px', borderRadius: 8,
              background: CARD,
              border: `2px solid ${CARD_INK}`,
              opacity: 1 - i * 0.14,
            }}
          >
            <Avatar size={26} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <CardBar w={`${72 - i * 8}%`} h={11} />
              <CardBar w={`${54 - i * 7}%`} h={8} />
            </div>
            <CardBar w={30} h={8} />
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Loading() {
  const sky = skyAt(easternHourFraction())

  return (
    <>
      <SkeletonStyles />

      <style>{`
        .cgg-home-skel {
          display: flex;
          flex-direction: row;
          min-height: calc(100vh - 65px);
          overflow-x: clip;
        }
        .cgg-home-skel-l {
          flex: 0 0 50%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: clamp(28px, 4vw, 64px);
          padding-right: clamp(20px, 3vw, 40px);
        }
        .cgg-home-skel-r {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: clamp(32px, 5vw, 72px);
          padding-left: clamp(24px, 3.5vw, 52px);
        }
        .cgg-home-skel-blogs-narrow { display: none; }
        @media (max-width: ${STACK_BELOW - 1}px) {
          .cgg-home-skel { flex-direction: column; }
          .cgg-home-skel-l {
            flex: none;
            padding: 40px 28px 24px;
            padding-right: 28px;
          }
          .cgg-home-skel-r {
            flex: none;
            padding: 24px 28px 40px;
            padding-left: 28px;
            padding-bottom: ${PARK_PEEK_PX}px;
          }
          .cgg-home-skel-blogs-wide { display: none; }
          .cgg-home-skel-blogs-narrow { display: block; }
        }
      `}</style>

      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: 56, left: 0, right: 0, bottom: 0,
          background: sky.gradient,
          overflow: 'hidden',
          zIndex: 0,
          userSelect: 'none',
        }}
      />

      <div className="cgg-home-skel" style={{ position: 'relative', zIndex: 1 }}>
        <div className="cgg-home-skel-l">
          <div style={{
            padding: 'clamp(16px, 2.2vw, 26px) clamp(16px, 2.2vw, 28px)',
            borderRadius: 18,
            background: CARD,
            border: `3px solid ${CARD_INK}`,
            boxShadow: `0 7px 0 ${CARD_INK}, 0 14px 24px rgba(20,16,10,0.28)`,
          }}>
            <div style={{
              height: 'clamp(34px, 7vw, 96px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CardBar w="62%" h={44} r={10} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
              <CardBar w={140} h={10} />
            </div>
            <div style={{
              marginTop: 22, paddingTop: 16,
              borderTop: '1px solid rgba(36, 28, 18, 0.22)',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <CardBar w={90} h={10} />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 1 - i * 0.16 }}>
                  <Avatar size={26} />
                  <CardBar w={`${58 - i * 9}%`} h={11} />
                </div>
              ))}
            </div>
          </div>

          <div className="cgg-home-skel-blogs-wide">
            <BlogRailSkeleton />
          </div>
        </div>

        <div className="cgg-home-skel-r">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {MENU.map((t, i) => (
              <SkelTile key={i} color={t.color} height={t.height} span={t.span} />
            ))}
          </div>

          <div style={{
            height: 1,
            margin: '18px 0 14px',
            background: 'linear-gradient(90deg, rgb(var(--shadow-rgb) / 0.35), rgb(var(--shadow-rgb) / 0.08) 70%, transparent)',
          }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <SkelTile color={DISCORD_FACE} span={2} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
            {GAMES.map((g, i) => (
              <SkelTile key={i} color={g.color} span={g.span} />
            ))}
          </div>

          <div className="cgg-home-skel-blogs-narrow">
            <BlogRailSkeleton />
          </div>
        </div>
      </div>
    </>
  )
}
